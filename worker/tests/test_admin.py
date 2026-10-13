import json
import os
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from services import admin_jobs as jobs, admin_storage as storage, admin_store as store
from services import admin_youtube as youtube, video_service as video
import utils


def test_session_secure_and_csrf(client):
    assert client.get('/api/v1/admin/overview').status_code == 401
    response = client.post('/api/v1/admin/session', json={'password': 'test-admin'})
    cookie = response.headers['Set-Cookie']
    assert all(value in cookie for value in ('HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=28800'))
    assert client.get('/api/v1/admin/session').json['csrf'] == response.json['csrf']
    assert client.put('/api/v1/admin/settings', json={}).status_code == 403
    response = client.delete('/api/v1/admin/session', headers={'X-CSRF-Token': response.json['csrf']})
    assert response.status_code == 200
    assert client.get('/api/v1/admin/session').status_code == 401


def test_login_throttle_and_origin(client):
    assert client.post('/api/v1/admin/session', json={'password': 'test-admin'}, headers={'Origin': 'https://evil.example'}).status_code == 403
    for _ in range(5):
        assert client.post('/api/v1/admin/session', json={'password': 'wrong'}).status_code == 401
    assert client.post('/api/v1/admin/session', json={'password': 'test-admin'}).status_code == 429


def test_expired_session(authenticated):
    client, headers = authenticated
    store.query('UPDATE admin_sessions SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 SECOND', write=True)
    assert client.get('/api/v1/admin/session').status_code == 401


def test_cleanup_preview_and_confirm(authenticated, sample):
    client, headers = authenticated
    target = dict(date=sample['date'], stream=sample['stream'], category='temporary')
    response = client.post('/api/v1/admin/cleanup/preview', json=target, headers=headers)
    assert response.status_code == 200
    assert len(response.json['files']) == 1
    token = response.json['id']
    assert client.post('/api/v1/admin/cleanup/execute', json={'id': token}, headers=headers).status_code == 400
    response = client.post('/api/v1/admin/cleanup/execute', json={'id': token, 'confirm': True}, headers=headers)
    assert response.status_code == 200
    assert sample['original'].exists()
    assert (sample['replay'] / 'index.m3u8').exists()
    assert client.post('/api/v1/admin/cleanup/execute', json={'id': token, 'confirm': True}, headers=headers).status_code == 400


def test_cleanup_rejects_changed_files(authenticated, sample):
    client, headers = authenticated
    preview = client.post('/api/v1/admin/cleanup/preview', json=dict(date=sample['date'], stream=sample['stream'], category='raw'), headers=headers).json
    sample['original'].write_bytes(b'changed')
    response = client.post('/api/v1/admin/cleanup/execute', json={'id': preview['id'], 'confirm': True}, headers=headers)
    assert response.status_code == 400
    assert sample['original'].exists()


def test_cleanup_session_bound(authenticated, sample):
    client, headers = authenticated
    preview = client.post('/api/v1/admin/cleanup/preview', json=dict(date=sample['date'], stream=sample['stream'], category='raw'), headers=headers).json
    next_session = client.post('/api/v1/admin/session', json={'password': 'test-admin'}).json
    response = client.post('/api/v1/admin/cleanup/execute', json={'id': preview['id'], 'confirm': True}, headers={'X-CSRF-Token': next_session['csrf']})
    assert response.status_code == 400


def test_cleanup_expired_preview(authenticated, sample):
    client, headers = authenticated
    preview = client.post('/api/v1/admin/cleanup/preview', json=dict(date=sample['date'], stream=sample['stream'], category='raw'), headers=headers).json
    store.query('UPDATE admin_previews SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 SECOND', write=True)
    assert client.post('/api/v1/admin/cleanup/execute', json={'id': preview['id'], 'confirm': True}, headers=headers).status_code == 400


def test_paths_symlinks_and_today(sandbox):
    with pytest.raises(ValueError):
        storage.safe_path('../secret')
    (sandbox / 'live' / 'outside').symlink_to(sandbox.parent, target_is_directory=True)
    with pytest.raises(ValueError):
        storage.safe_path('live/outside/secret')
    with pytest.raises(ValueError):
        storage.targets('2999-01-01', None, 'raw')
    with pytest.raises(ValueError):
        storage.validate_target('2026-10-12', '../../secret')


def test_busy_and_disk_guard(authenticated, sample, monkeypatch):
    client, headers = authenticated
    monkeypatch.setattr(storage, 'disk', lambda: {'free': 1})
    response = client.post('/api/v1/admin/jobs', json=dict(kind='merge', date=sample['date'], stream=sample['stream']), headers=headers)
    assert response.status_code == 507
    assert not jobs.active()
    monkeypatch.setattr(storage, 'disk', lambda: {'free': 100 * storage.GIB})
    response = client.post('/api/v1/admin/jobs', json=dict(kind='merge', date=sample['date'], stream=sample['stream']), headers=headers)
    assert response.status_code == 202
    assert client.post('/api/v1/admin/jobs', json=dict(kind='merge', date=sample['date']), headers=headers).status_code == 409
    assert client.post('/api/v1/admin/cleanup/preview', json=dict(date=sample['date'], category='raw'), headers=headers).status_code == 409


def test_recovery_preserves_original(sample):
    store.query("INSERT INTO admin_jobs(id,kind,payload,status) VALUES(%s,'merge','{}','running')", ('a' * 32,), write=True)
    jobs.recover()
    assert all(row['status'] == 'interrupted' for row in store.query('SELECT status FROM admin_jobs'))
    assert storage.metadata()[sample['date']]['status'] == 'interrupted'
    assert sample['original'].exists()


def test_named_lock_prevents_overlap():
    with store.connection() as conn:
        assert jobs.gate(conn)
        with store.connection() as other:
            assert not jobs.gate(other)
        jobs.release(conn)


def test_failed_job_persisted(sample, monkeypatch):
    job_id = 'b' * 32
    store.query("INSERT INTO admin_jobs(id,kind,payload,status) VALUES(%s,'merge',%s,'queued')", (job_id, json.dumps({'date': sample['date'], 'stream': sample['stream']})), write=True)
    monkeypatch.setattr(storage, 'check_space', lambda *args: 1)
    monkeypatch.setattr(video, 'do_merge', Mock(side_effect=OSError(28, 'disk full')))
    jobs.execute(store.query('SELECT * FROM admin_jobs WHERE id=%s', (job_id,), one=True))
    row = store.query('SELECT * FROM admin_jobs WHERE id=%s', (job_id,), one=True)
    assert row['status'] == 'failed' and row['error_code'] == 'disk_full'
    assert sample['original'].exists()


def test_metadata_write_failure_is_raised(sandbox, monkeypatch):
    monkeypatch.setattr(utils.os, 'replace', Mock(side_effect=OSError(28, 'disk full')))
    with pytest.raises(OSError):
        utils.safe_save_json(str(sandbox / 'metadata.json'), {'changed': True})
    assert json.loads((sandbox / 'metadata.json').read_text()) == {}


def test_stream_directory_failure_is_not_completed(sample, monkeypatch):
    monkeypatch.setattr(video.os, 'makedirs', Mock(side_effect=OSError(28, 'disk full')))
    result = video.process_one_stream(sample['stream'], [str(sample['original'])], sample['date'], str(sample['original'].parents[2] / 'metadata.json'), storage.metadata(), 0, 100)
    assert result[1] is False


def test_partial_merge_is_failed(sample, monkeypatch):
    monkeypatch.setattr(video, 'process_one_stream', lambda *args: (args[0], False, 'bad segment'))
    with pytest.raises(RuntimeError, match='bad segment'):
        video.do_merge(sample['date'])
    assert storage.metadata()[sample['date']]['status'] == 'failed'
    assert sample['original'].exists()


def test_missing_channel_and_error_classification():
    client = Mock()
    client.channels.return_value.list.return_value.execute.return_value = {'items': []}
    with pytest.raises(youtube.YouTubeError) as error:
        youtube.channel(client)
    assert error.value.code == 'signup_required'
    assert youtube.error_code(RuntimeError('youtubeSignupRequired')) == 'signup_required'
    assert youtube.error_code(RuntimeError('quotaExceeded')) == 'quota_exceeded'
    assert youtube.error_code(SimpleNamespace(resp=SimpleNamespace(status=401))) == 'token_expired'


def test_network_retry_limit(monkeypatch):
    operation = Mock(side_effect=ConnectionError('offline'))
    sleep = Mock()
    monkeypatch.setattr(youtube.time, 'sleep', sleep)
    with pytest.raises(youtube.YouTubeError):
        youtube.retry(operation)
    assert operation.call_count == 3
    assert sleep.call_count == 2


def test_quota_does_not_retry(monkeypatch):
    operation = Mock(side_effect=RuntimeError('quotaExceeded'))
    with pytest.raises(youtube.YouTubeError):
        youtube.retry(operation)
    assert operation.call_count == 1


def test_refresh_error(monkeypatch, sandbox):
    (sandbox / 'youtube_token.json').write_text('{}')
    creds = Mock(valid=False, refresh_token='token')
    creds.refresh.side_effect = RuntimeError('invalid_grant')
    monkeypatch.setattr(youtube.Credentials, 'from_authorized_user_file', lambda *args: creds)
    with pytest.raises(youtube.YouTubeError) as error:
        youtube.credentials()
    assert error.value.code == 'token_expired'


def test_token_file_permissions(monkeypatch, sandbox):
    creds = Mock()
    creds.to_json.return_value = '{"refresh_token":"private"}'
    youtube.save_credentials(creds)
    assert os.stat(sandbox / 'youtube_token.json').st_mode & 0o777 == 0o600


def test_oauth_state_invalid_expired_and_single_use(authenticated, monkeypatch):
    client, headers = authenticated
    assert client.get('/api/v1/admin/youtube/oauth/callback?state=forged&code=x').status_code == 400
    state = 's' * 32
    store.query('UPDATE admin_sessions SET oauth_state=%s,oauth_expires=%s', (state, datetime.utcnow() - timedelta(seconds=1)), write=True)
    assert client.get(f'/api/v1/admin/youtube/oauth/callback?state={state}&code=x').status_code == 400
    store.query('UPDATE admin_sessions SET oauth_state=%s,oauth_expires=%s', (state, datetime.utcnow() + timedelta(minutes=10)), write=True)
    response = client.get(f'/api/v1/admin/youtube/oauth/callback?state={state}&error=access_denied')
    assert response.status_code == 302 and response.headers['Location'] == '/admin/youtube'
    assert client.get(f'/api/v1/admin/youtube/oauth/callback?state={state}&code=x').status_code == 400


def test_failed_upload_keeps_hls(sample, monkeypatch):
    from services.youtube_service import YouTubeService
    fake = Mock()
    fake.create_playlist.return_value = 'playlist'
    fake.upload_video.side_effect = youtube.YouTubeError('signup_required', 'No channel')
    monkeypatch.setattr(YouTubeService, '_get_authenticated_service', lambda self: fake)
    monkeypatch.setattr(YouTubeService, 'create_playlist', fake.create_playlist)
    monkeypatch.setattr(YouTubeService, 'upload_video', fake.upload_video)
    monkeypatch.setattr(youtube, 'channel', lambda *args: {'id': 'channel', 'title': 'Test'})
    monkeypatch.setattr(storage, 'check_space', lambda *args: 1)
    monkeypatch.setattr(video, 'merge_hls_to_mp4', lambda *args: (True, None))
    with pytest.raises(youtube.YouTubeError):
        video.do_youtube_sync(sample['date'])
    assert sample['original'].exists() and (sample['replay'] / 'index.m3u8').exists()
    assert storage.metadata()[sample['date']]['streams'][sample['stream']]['hls']


def test_legacy_mutations_require_auth(client):
    for path in ('/api/v1/youtube/sync', '/api/v1/youtube/test-upload', '/api/v1/metadata/rename'):
        assert client.post(path, json={}).status_code == 401


def test_settings_validation(authenticated):
    client, headers = authenticated
    assert client.put('/api/v1/admin/settings', json={'warning_percent': 95, 'critical_percent': 85}, headers=headers).status_code == 400
    values = dict(warning_percent=85, critical_percent=95, sync_time='02:00', sync_enabled=False)
    assert client.put('/api/v1/admin/settings', json=values, headers=headers).status_code == 200
    assert store.settings()['sync_enabled'] is False


def test_restricted_legacy_reader_rejects_executable_pickle():
    import io
    import pickle
    with pytest.raises(ValueError):
        youtube.LegacyCredentialsReader(io.BytesIO(pickle.dumps(os.system))).load()


def test_restricted_legacy_credentials_migration(sandbox):
    import pickle
    from google.oauth2.credentials import Credentials
    creds = Credentials(token='old', refresh_token='refresh', token_uri='https://oauth2.googleapis.com/token', client_id='test', client_secret='test', scopes=youtube.SCOPES)
    creds.expiry = datetime.utcnow() + timedelta(hours=1)
    with open(sandbox / 'youtube_token.pickle', 'wb') as target:
        pickle.dump(creds, target)
    assert youtube.credentials().token == 'old'
    assert (sandbox / 'youtube_token.json').exists()


def test_inventory_finds_unindexed_files(sample, sandbox):
    extra = sandbox / 'live' / sample['stream'] / (sample['date'] + '-12-01-00.flv')
    extra.write_bytes(b'extra original')
    storage.inventory_scan()
    row = next(row for row in storage._cache['rows'] if row['stream'] == sample['stream'])
    assert row['raw_count'] == 2
    assert row['temp_bytes'] == len(b'temporary')


def test_recording_path_cannot_target_secrets(sample, sandbox):
    with pytest.raises(ValueError):
        storage.recording_path({'stream': sample['stream'], 'file': str(sandbox / 'youtube_secrets.json')}, sample['date'])


def test_successful_upload_keeps_local_files(sample, monkeypatch):
    from services.youtube_service import YouTubeService
    fake = Mock()
    fake.create_playlist.return_value = 'playlist'
    fake.upload_video.return_value = 'video123'
    monkeypatch.setattr(YouTubeService, '_get_authenticated_service', lambda self: fake)
    monkeypatch.setattr(YouTubeService, 'create_playlist', fake.create_playlist)
    monkeypatch.setattr(YouTubeService, 'upload_video', fake.upload_video)
    monkeypatch.setattr(YouTubeService, 'add_video_to_playlist', Mock())
    monkeypatch.setattr(youtube, 'channel', lambda *args: {'id': 'channel', 'title': 'Test'})
    monkeypatch.setattr(storage, 'check_space', lambda *args: 1)
    monkeypatch.setattr(video, 'merge_hls_to_mp4', lambda *args: (True, None))
    video.do_youtube_sync(sample['date'])
    info = storage.metadata()[sample['date']]['streams'][sample['stream']]
    assert info['youtube_id'] == 'video123' and info['hls']
    assert sample['original'].exists() and (sample['replay'] / 'index.m3u8').exists()


def test_disk_full_recovery_still_records_interruption(sample, monkeypatch):
    monkeypatch.setattr(storage, 'safe_save_json', Mock(side_effect=OSError(28, 'disk full')))
    jobs.recover()
    rows = store.query('SELECT * FROM admin_jobs')
    assert rows and rows[0]['status'] == 'interrupted'
    assert sample['original'].exists()


def test_public_metadata_uses_durable_failed_status(client, sample):
    store.query("INSERT INTO admin_jobs(id,kind,payload,status,progress,message) VALUES(%s,'merge',%s,'failed',74,'Không đủ dung lượng')", ('d'*32, json.dumps({'date': sample['date']})), write=True)
    response = client.get('/api/v1/metadata')
    assert response.json[sample['date']]['status'] == 'failed'
    assert response.json[sample['date']]['progress_percent'] == 74


def test_dvr_bucket_follows_filename_across_timezones(client, sample):
    response = client.post('/api/v1/dvr', json={'action': 'on_dvr', 'stream': sample['stream'], 'file': str(sample['original'])})
    assert response.status_code == 200
    assert len(utils.get_recordings()[sample['date']]) == 2


def test_credentials_migrate_outside_public_media(sandbox, monkeypatch):
    private = sandbox.parent / (sandbox.name + '-private')
    monkeypatch.setattr(youtube, 'PRIVATE_DIR', str(private))
    source = sandbox / 'youtube_secrets.json'
    source.write_text('{"web":{}}')
    youtube.migrate_private_files()
    assert not source.exists()
    assert (private / 'youtube_secrets.json').read_text() == '{"web":{}}'
    assert os.stat(private).st_mode & 0o777 == 0o700
    assert os.stat(private / 'youtube_secrets.json').st_mode & 0o777 == 0o600


def test_private_directory_cannot_be_public(sandbox, monkeypatch):
    monkeypatch.setattr(youtube, 'PRIVATE_DIR', str(sandbox / 'private'))
    with pytest.raises(ValueError):
        youtube.migrate_private_files()


def test_youtube_disk_estimate_is_for_serial_video(sample, sandbox):
    other = sandbox / 'replays' / sample['date'] / 'team1-1'
    other.mkdir()
    (other / 'segment_0.ts').write_bytes(b'x' * 20)
    meta = storage.metadata()
    meta[sample['date']]['streams']['team1-1'] = {'hls': f"replays/{sample['date']}/team1-1/index.m3u8"}
    utils.safe_save_json(str(sandbox / 'metadata.json'), meta)
    assert storage.input_size('youtube', {'date': sample['date']}) == 20


def test_oauth_pkce_survives_redirect(authenticated, sandbox, monkeypatch):
    import base64
    import hashlib
    from urllib.parse import urlsplit, parse_qs
    client, headers = authenticated
    callback = 'https://admin.example/api/v1/admin/youtube/oauth/callback'
    monkeypatch.setenv('ADMIN_PUBLIC_URL', 'https://admin.example')
    (sandbox / 'youtube_secrets.json').write_text(json.dumps({'web': {'client_id': 'test', 'client_secret': 'test', 'auth_uri': 'https://accounts.google.com/o/oauth2/auth', 'token_uri': 'https://oauth2.googleapis.com/token', 'redirect_uris': [callback]}}))
    response = client.post('/api/v1/admin/youtube/oauth/start', json={}, headers=headers)
    assert response.status_code == 200
    query = parse_qs(urlsplit(response.json['url']).query)
    session = store.query('SELECT * FROM admin_sessions', one=True)
    verifier = session['oauth_verifier']
    expected = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
    assert query['code_challenge'] == [expected]
    fake_flow = Mock()
    fake_flow.credentials.to_json.return_value = '{}'
    factory = Mock(return_value=fake_flow)
    monkeypatch.setattr(youtube, 'flow', factory)
    monkeypatch.setattr(youtube, 'channel', lambda: {'id': 'channel', 'title': 'Test'})
    response = client.get(f"/api/v1/admin/youtube/oauth/callback?state={session['oauth_state']}&code=test")
    assert response.status_code == 302
    factory.assert_called_once_with(session['oauth_state'], code_verifier=verifier)
    assert store.query('SELECT oauth_verifier FROM admin_sessions', one=True)['oauth_verifier'] is None
