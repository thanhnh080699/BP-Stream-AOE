import json
import os
import threading
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo
from config import DATA_DIR
from services import admin_store as store
from services import admin_storage as storage
from services.admin_youtube import error_code

_wake = threading.Event()
_current = None
_started = False


class Conflict(ValueError):
    pass


def active():
    return store.query("SELECT * FROM admin_jobs WHERE status IN ('queued','running') ORDER BY created_at")


def serialize(row):
    row = dict(row)
    row['payload'] = json.loads(row['payload'])
    for field in ('created_at', 'updated_at'):
        if row.get(field):
            row[field] = row[field].isoformat() + 'Z'
    return row


def gate(conn, wait=0):
    cursor = conn.cursor()
    cursor.execute('SET SESSION wait_timeout=86400')
    cursor.execute('SELECT GET_LOCK(%s,%s)', ('bp_admin_video', wait))
    acquired = cursor.fetchone()[0] == 1
    cursor.close()
    return acquired


def release(conn):
    cursor = conn.cursor()
    cursor.execute('SELECT RELEASE_LOCK(%s)', ('bp_admin_video',))
    cursor.fetchone()
    cursor.close()


def submit(kind, payload):
    if kind not in ('merge', 'youtube'):
        raise ValueError('Loại tác vụ không hợp lệ.')
    if kind == 'merge' and not payload.get('date'):
        raise ValueError('Chọn ngày cần tổng hợp.')
    if payload.get('date'):
        storage.validate_target(payload['date'], payload.get('stream'))
    with store.connection() as conn:
        if not gate(conn):
            raise Conflict('Hệ thống đang xử lý video. Hãy chờ tác vụ kết thúc.')
        try:
            if active():
                raise Conflict('Đã có tác vụ trong hàng đợi.')
            storage.check_space(kind, payload)
            job = uuid.uuid4().hex
            store.query('INSERT INTO admin_jobs(id,kind,payload,status,message) VALUES(%s,%s,%s,%s,%s)',
                        (job, kind, json.dumps(payload), 'queued', 'Đang chờ xử lý'), write=True)
            store.audit('job_created', {'id': job, 'kind': kind, **payload})
        finally:
            release(conn)
    _wake.set()
    return job


def progress(percent, message):
    if _current:
        store.query('UPDATE admin_jobs SET progress=COALESCE(%s,progress),message=%s,updated_at=UTC_TIMESTAMP() WHERE id=%s',
                    (None if percent is None else max(0, min(100, int(percent))), message[:2000], _current), write=True)


def recover():
    store.query("UPDATE admin_jobs SET status='interrupted',error_code='worker_restarted',"
                "message='Worker đã khởi động lại; hãy kiểm tra và thử lại.',updated_at=UTC_TIMESTAMP() "
                "WHERE status='running'", write=True)
    with storage.meta_lock:
        meta = storage.metadata()
        changed = False
        for date, day in meta.items():
            if day.get('status') == 'processing':
                recorded = store.query("SELECT id FROM admin_jobs WHERE kind='merge' AND status='interrupted' "
                                       "AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.date'))=%s LIMIT 1", (date,), one=True)
                if not recorded:
                    job_id = uuid.uuid4().hex
                    store.query("INSERT INTO admin_jobs(id,kind,payload,status,progress,message,error_code) VALUES(%s,'merge',%s,'interrupted',%s,%s,'worker_restarted')",
                                (job_id, json.dumps({'date': date, 'stream': None}), day.get('progress_percent', 0),
                                 'Tác vụ cũ đã gián đoạn. Tiến độ cuối: ' + day.get('progress_text', 'Không xác định')), write=True)
                    store.audit('job_interrupted', {'id': job_id, 'date': date})
                day.update(status='interrupted', progress_text='Tác vụ bị gián đoạn; có thể tổng hợp lại từ CMS.')
                changed = True
        if changed:
            try:
                storage.safe_save_json(os.path.join(DATA_DIR, 'metadata.json'), meta)
            except OSError as error:
                if error.errno != 28:
                    raise
                print('Không thể ghi metadata do hết dung lượng; trạng thái gián đoạn đã lưu trong MariaDB.', flush=True)


def heartbeat(stop):
    while not stop.wait(15):
        try:
            if _current:
                store.query('UPDATE admin_jobs SET updated_at=UTC_TIMESTAMP() WHERE id=%s', (_current,), write=True)
        except Exception as error:
            print(f'Admin heartbeat: {error}', flush=True)


def clean_temporary(payload):
    date = payload.get('date')
    if not date:
        return
    try:
        storage.input_size('merge', payload)
        storage.delete_snapshot(dict(date=date, stream=payload.get('stream'), category='temporary',
                                     files=storage.targets(date, payload.get('stream'), 'temporary')))
    except (ValueError, OSError) as error:
        print(f'Tạm hoãn dọn file tạm: {error}', flush=True)


def execute(row):
    global _current
    from services.video_service import do_merge, do_youtube_sync
    payload = json.loads(row['payload'])
    _current = row['id']
    stop = threading.Event()
    threading.Thread(target=heartbeat, args=(stop,), daemon=True).start()
    store.query("UPDATE admin_jobs SET status='running',updated_at=UTC_TIMESTAMP() WHERE id=%s", (_current,), write=True)
    try:
        storage.check_space(row['kind'], payload)
        if row['kind'] == 'merge':
            do_merge(payload['date'], payload.get('stream'))
        else:
            do_youtube_sync(payload.get('date'), payload.get('stream'),
                            force=payload.get('force', False), is_test=payload.get('is_test', False))
        store.query("UPDATE admin_jobs SET status='completed',progress=100,message='Hoàn thành',updated_at=UTC_TIMESTAMP() WHERE id=%s",
                    (_current,), write=True)
        store.audit('job_completed', {'id': _current})
    except Exception as error:
        code = 'disk_full' if (isinstance(error, OSError) and error.errno == 28) or 'No space left on device' in str(error) or '[Errno 28]' in str(error) else error_code(error) if row['kind'] == 'youtube' else 'processing_error'
        if row['kind'] == 'youtube' and code in ('signup_required', 'token_expired', 'permission_denied', 'quota_exceeded', 'not_connected'):
            store.set_setting('youtube_status', dict(connected=False, code=code, error=str(error)))
        store.query("UPDATE admin_jobs SET status='failed',error_code=%s,message=%s,updated_at=UTC_TIMESTAMP() WHERE id=%s",
                    (code, str(error)[:4000], _current), write=True)
        store.audit('job_failed', {'id': _current, 'code': code, 'message': str(error)[:1000]})
    finally:
        stop.set()
        _current = None
        clean_temporary(payload)
        storage.inventory(force=True)


def schedule():
    settings = store.settings()
    now = datetime.now(ZoneInfo('Asia/Ho_Chi_Minh'))
    day = now.strftime('%Y-%m-%d')
    if settings['sync_enabled'] and now.strftime('%H:%M') >= settings['sync_time'] and settings.get('last_sync_date') != day:
        try:
            submit('youtube', {})
            store.set_setting('last_sync_date', day)
        except Conflict:
            pass


def loop():
    recovered = False
    while True:
        try:
            with store.connection() as conn:
                if gate(conn):
                    try:
                        if not recovered:
                            recover()
                            recovered = True
                        row = store.query("SELECT * FROM admin_jobs WHERE status='queued' ORDER BY created_at LIMIT 1", one=True)
                        if row:
                            execute(row)
                    finally:
                        release(conn)
            schedule()
            storage.inventory()
            if recovered:
                with store.connection() as cleanup_conn:
                    if gate(cleanup_conn):
                        try:
                            if not active():
                                for job in store.query("SELECT payload FROM admin_jobs WHERE status IN ('failed','completed','interrupted') "
                                                       "AND updated_at>UTC_TIMESTAMP()-INTERVAL 1 DAY"):
                                    clean_temporary(json.loads(job['payload']))
                        finally:
                            release(cleanup_conn)
        except Exception as error:
            print(f'Admin worker: {error}', flush=True)
        _wake.wait(30)
        _wake.clear()


def start():
    global _started
    if not _started:
        store.initialize()
        from services.admin_youtube import migrate_private_files
        migrate_private_files()
        if not store.settings().get("last_sync_date"):
            store.set_setting("last_sync_date", datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).strftime("%Y-%m-%d"))
        _started = True
        threading.Thread(target=loop, daemon=True).start()
