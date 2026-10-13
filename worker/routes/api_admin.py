import hmac
import json
import re
import secrets
from datetime import datetime, timedelta
from urllib.parse import urlsplit
from flask import Blueprint, g, jsonify, redirect, request
import mysql.connector
from services import admin_store as store, admin_storage as storage, admin_jobs as jobs
from services.admin_auth import COOKIE, current_session, login, require_admin
from services import admin_youtube as youtube

bp = Blueprint('admin', __name__, url_prefix='/api/v1/admin')


@bp.errorhandler(ValueError)
def invalid(error):
    return jsonify(error=str(error), code='invalid_request'), 400


@bp.errorhandler(jobs.Conflict)
def conflict(error):
    return jsonify(error=str(error), code='busy'), 409


@bp.errorhandler(OSError)
def disk_error(error):
    return jsonify(error=str(error), code='disk_full' if error.errno == 28 else 'storage_error'), 507


@bp.errorhandler(mysql.connector.Error)
def database_error(error):
    print(f'CMS database error: {error}', flush=True)
    return jsonify(error='Không thể kết nối kho trạng thái quản trị.', code='database_unavailable'), 503


@bp.route('/session', methods=['POST'])
def sign_in():
    origin = request.headers.get('Origin')
    allowed = youtube.oauth_config()['public_url'] or request.host_url.rstrip('/')
    if origin and urlsplit(origin).netloc != urlsplit(allowed).netloc:
        return jsonify(error='Nguồn đăng nhập không hợp lệ.'), 403
    return login((request.get_json(silent=True) or {}).get('password'))


@bp.route('/session', methods=['GET'])
@require_admin
def session_info():
    return jsonify(csrf=g.admin_session['csrf'], expires_at=g.admin_session['expires_at'].isoformat() + 'Z')


@bp.route('/session', methods=['DELETE'])
@require_admin
def sign_out():
    store.query('DELETE FROM admin_sessions WHERE id=%s', (g.admin_session['id'],), write=True)
    store.audit('logout', {})
    response = jsonify(status='ok')
    response.delete_cookie(COOKIE, path='/')
    return response


@bp.route('/overview')
@require_admin
def overview():
    return jsonify(storage=storage.disk(), inventory=storage.inventory(), settings=store.settings(),
                   jobs=[jobs.serialize(row) for row in store.query('SELECT * FROM admin_jobs ORDER BY created_at DESC LIMIT 100')],
                   youtube=store.settings().get('youtube_status', {'connected': False}))


@bp.route('/inventory', methods=['GET', 'POST'])
@require_admin
def inventory():
    return jsonify(storage.inventory(force=request.method == 'POST'))


@bp.route('/cleanup/preview', methods=['POST'])
@require_admin
def cleanup_preview():
    data = request.get_json(silent=True) or {}
    with store.connection() as conn:
        if not jobs.gate(conn):
            raise jobs.Conflict('Không dọn dữ liệu khi tác vụ video đang chạy.')
        try:
            if jobs.active():
                raise jobs.Conflict('Không dọn dữ liệu khi có tác vụ trong hàng đợi.')
            files = storage.targets(data.get('date'), data.get('stream'), data.get('category'))
            token = secrets.token_hex(32)
            payload = dict(date=data['date'], stream=data.get('stream'), category=data['category'], files=files)
            store.query('DELETE FROM admin_previews WHERE expires_at<=UTC_TIMESTAMP()', write=True)
            store.query('INSERT INTO admin_previews(id,session_id,payload,expires_at) VALUES(%s,%s,%s,%s)',
                        (token, g.admin_session['id'], json.dumps(payload), datetime.utcnow() + timedelta(minutes=10)), write=True)
        finally:
            jobs.release(conn)
    return jsonify(id=token, files=files, bytes=sum(file['size'] for file in files), expires_in=600)


@bp.route('/cleanup/execute', methods=['POST'])
@require_admin
def cleanup_execute():
    data = request.get_json(silent=True) or {}
    if data.get('confirm') is not True:
        raise ValueError('Cần xác nhận xóa dữ liệu.')
    with store.connection() as conn:
        if not jobs.gate(conn):
            raise jobs.Conflict('Tác vụ video đang chạy.')
        try:
            if jobs.active():
                raise jobs.Conflict('Có tác vụ đang chờ.')
            preview = store.query('SELECT * FROM admin_previews WHERE id=%s AND session_id=%s AND expires_at>UTC_TIMESTAMP()',
                                  (data.get('id'), g.admin_session['id']), one=True)
            if not preview:
                raise ValueError('Bản xem trước hết hạn hoặc đã được sử dụng.')
            store.query('DELETE FROM admin_previews WHERE id=%s', (preview['id'],), write=True)
            payload = json.loads(preview['payload'])
            store.audit('cleanup_started', {key: value for key, value in payload.items() if key != 'files'})
            reclaimed = storage.delete_snapshot(payload)
            store.audit('cleanup_completed', {'date': payload['date'], 'bytes': reclaimed, 'files': len(payload['files'])})
        finally:
            jobs.release(conn)
    return jsonify(bytes=reclaimed, status='completed')


@bp.route('/jobs', methods=['GET', 'POST'])
@require_admin
def tasks():
    if request.method == 'GET':
        return jsonify([jobs.serialize(row) for row in store.query('SELECT * FROM admin_jobs ORDER BY created_at DESC LIMIT 100')])
    data = request.get_json(silent=True) or {}
    job = jobs.submit(data.get('kind'), dict(date=data.get('date'), stream=data.get('stream')))
    return jsonify(id=job, status='queued'), 202


@bp.route('/jobs/<job_id>/retry', methods=['POST'])
@require_admin
def retry_task(job_id):
    job = store.query('SELECT * FROM admin_jobs WHERE id=%s', (job_id,), one=True)
    if not job or job['status'] not in ('failed', 'interrupted'):
        raise ValueError('Chỉ thử lại tác vụ thất bại hoặc gián đoạn.')
    return jsonify(id=jobs.submit(job['kind'], json.loads(job['payload']))), 202


@bp.route('/audit')
@require_admin
def audit():
    rows = store.query('SELECT * FROM admin_audit ORDER BY id DESC LIMIT 200')
    for row in rows:
        row['detail'] = json.loads(row['detail'])
        row['created_at'] = row['created_at'].isoformat() + 'Z'
    return jsonify(rows)


@bp.route('/settings', methods=['GET', 'PUT'])
@require_admin
def settings():
    if request.method == 'PUT':
        data = request.get_json(silent=True) or {}
        warning, critical = data.get('warning_percent'), data.get('critical_percent')
        if type(warning) is not int or type(critical) is not int or not 1 <= warning < critical <= 99:
            raise ValueError('Ngưỡng dung lượng phải là số nguyên: 1 ≤ cảnh báo < nguy cấp ≤ 99.')
        if type(data.get('sync_enabled')) is not bool or not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', str(data.get('sync_time', ''))):
            raise ValueError('Lịch đồng bộ không hợp lệ.')
        values = {key: data[key] for key in store.DEFAULTS}
        for key, value in values.items():
            store.set_setting(key, value)
        store.audit('settings_updated', values)
    return jsonify(store.settings())


@bp.route('/youtube/status', methods=['GET', 'POST'])
@require_admin
def youtube_status():
    status = store.settings().get('youtube_status', {'connected': False})
    if request.method == 'POST':
        try:
            status = dict(connected=True, channel=youtube.channel(), checked_at=datetime.utcnow().isoformat() + 'Z')
        except Exception as error:
            status = dict(connected=False, code=youtube.error_code(error), error=str(error),
                          checked_at=datetime.utcnow().isoformat() + 'Z')
        store.set_setting('youtube_status', status)
        store.audit('youtube_checked', {'connected': status['connected'], 'code': status.get('code')})
    return jsonify(**status, oauth=youtube.oauth_config())


@bp.route('/youtube/oauth/start', methods=['POST'])
@require_admin
def oauth_start():
    flow = youtube.flow()
    url, state = flow.authorization_url(access_type='offline', prompt='consent select_account', include_granted_scopes='true')
    store.query('UPDATE admin_sessions SET oauth_state=%s,oauth_expires=%s,oauth_verifier=%s WHERE id=%s',
                (state, datetime.utcnow() + timedelta(minutes=10), flow.code_verifier, g.admin_session['id']), write=True)
    return jsonify(url=url)


@bp.route('/youtube/oauth/callback')
def oauth_callback():
    session = current_session()
    state = request.args.get('state', '')
    if not session or not state or not session['oauth_state'] or not hmac.compare_digest(state, session['oauth_state']):
        return jsonify(error='OAuth state không hợp lệ.'), 400
    consumed = store.query('UPDATE admin_sessions SET oauth_state=NULL,oauth_expires=NULL,oauth_verifier=NULL '
                           'WHERE id=%s AND oauth_state=%s AND oauth_expires>UTC_TIMESTAMP()',
                           (session['id'], state), write=True)
    if not consumed:
        return jsonify(error='Phiên kết nối hết hạn hoặc đã sử dụng.'), 400
    try:
        if request.args.get('error'):
            raise youtube.YouTubeError('access_denied', 'Bạn đã hủy cấp quyền Google.')
        code = request.args.get('code')
        if not code:
            raise ValueError('Thiếu mã xác thực Google.')
        flow = youtube.flow(state, code_verifier=session['oauth_verifier'])
        flow.fetch_token(code=code)
        youtube.save_credentials(flow.credentials)
        status = dict(connected=True, channel=youtube.channel(), checked_at=datetime.utcnow().isoformat() + 'Z')
    except Exception as error:
        status = dict(connected=False, code=youtube.error_code(error), error=str(error))
    store.set_setting('youtube_status', status)
    store.audit('youtube_connected', {'connected': status['connected'], 'code': status.get('code')})
    return redirect('/admin/youtube')
