import json
import os
import sys
from pathlib import Path

import pytest

os.environ.update(DB_HOST='127.0.0.1', DB_PORT=os.environ.get('TEST_DB_PORT', '3307'),
                  DB_USER='root', DB_PASSWORD='admin-test-password', DB_NAME='admin_test',
                  ADMIN_PASSWORD='test-admin', ADMIN_COOKIE_SECURE='true')
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services import admin_store as store, admin_storage as storage, admin_jobs as jobs, admin_auth as auth
from services import admin_youtube as youtube, video_service as video
import utils
from routes.api_admin import bp
from routes.api_recordings import bp as recording_bp
from routes import api_recordings as recordings_api
from flask import Flask


@pytest.fixture(autouse=True)
def sandbox(tmp_path, monkeypatch):
    store.initialize()
    for table in ('admin_sessions', 'admin_jobs', 'admin_settings', 'admin_audit', 'admin_previews'):
        store.query(f'DELETE FROM {table}', write=True)
    for module in (storage, video, youtube, jobs, recordings_api):
        monkeypatch.setattr(module, 'DATA_DIR', str(tmp_path))
    monkeypatch.setattr(youtube, 'TOKEN', str(tmp_path / 'youtube_token.json'))
    monkeypatch.setattr(youtube, 'SECRETS', str(tmp_path / 'youtube_secrets.json'))
    monkeypatch.setattr(utils, 'LOG_FILE', str(tmp_path / 'recordings.json'))
    monkeypatch.setattr(jobs, '_current', None)
    auth._attempts.clear()
    (tmp_path / 'live').mkdir()
    (tmp_path / 'replays').mkdir()
    (tmp_path / 'recordings.json').write_text('{}')
    (tmp_path / 'metadata.json').write_text('{}')
    return tmp_path


@pytest.fixture
def client():
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.register_blueprint(bp)
    app.register_blueprint(recording_bp)
    return app.test_client()


@pytest.fixture
def authenticated(client):
    response = client.post('/api/v1/admin/session', json={'password': 'test-admin'})
    assert response.status_code == 200
    return client, {'X-CSRF-Token': response.json['csrf']}


@pytest.fixture
def sample(sandbox):
    date, stream = '2026-10-12', 'team2-2'
    original = sandbox / 'live' / stream / (date + '-12-00-00.flv')
    original.parent.mkdir()
    original.write_bytes(b'original video')
    replay = sandbox / 'replays' / date / stream
    replay.mkdir(parents=True)
    (replay / 'segment_0.ts').write_bytes(b'hls segment')
    (replay / 'index.m3u8').write_text('#EXTM3U\nsegment_0.ts\n')
    (replay / 'ts_tmp').mkdir()
    (replay / 'ts_tmp' / 'seg_0000.ts').write_bytes(b'temporary')
    for file in (original, replay / 'segment_0.ts', replay / 'index.m3u8', replay / 'ts_tmp' / 'seg_0000.ts'):
        os.utime(file, (1, 1))
    (sandbox / 'recordings.json').write_text(json.dumps({date: [{'stream': stream, 'file': str(original)}]}))
    (sandbox / 'metadata.json').write_text(json.dumps({date: {'status': 'processing', 'progress_percent': 74, 'streams': {stream: {'hls': f'replays/{date}/{stream}/index.m3u8'}}}}))
    return {'date': date, 'stream': stream, 'original': original, 'replay': replay}
