import os
import json
import shutil
from datetime import datetime
from flask import Blueprint, request, jsonify
from config import DATA_DIR
from utils import get_recordings, save_recordings, meta_lock, save_meta, admin_required, recordings_lock
from services.admin_jobs import submit, Conflict
from services.admin_storage import validate_target, safe_path
from services import admin_jobs as jobs, admin_store as store
from functools import wraps

bp = Blueprint('recordings', __name__)

def exclusive_write(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        with store.connection() as conn:
            if not jobs.gate(conn):
                return jsonify(error='Tác vụ video đang chạy; hãy thử lại sau.'), 409
            try:
                if jobs.active():
                    return jsonify(error='Có tác vụ trong hàng đợi.'), 409
                return fn(*args, **kwargs)
            finally:
                jobs.release(conn)
    return wrapped


@bp.route('/api/v1/metadata', methods=['GET'])
def get_metadata():
    recordings = get_recordings()
    meta_file = os.path.join(DATA_DIR, 'metadata.json')
    meta = {}
    with meta_lock:
        if os.path.exists(meta_file):
            for _ in range(3): # Retry up to 3 times if file is being written
                try:
                    with open(meta_file, 'r') as f:
                        meta = json.load(f)
                    break 
                except Exception:
                    import time
                    time.sleep(0.1)
    for date, files in recordings.items():
        if date not in meta or meta[date].get('status') != 'completed':
            meta[date] = meta.get(date, {"streams": {}, "status": "recording"})
    # MariaDB remains authoritative when a full video disk prevented metadata writes.
    try:
        latest_dates = set()
        for job in store.query("SELECT * FROM admin_jobs WHERE kind='merge' ORDER BY created_at DESC LIMIT 100"):
            date = json.loads(job['payload']).get('date')
            if date in latest_dates:
                continue
            latest_dates.add(date)
            if date in meta and meta[date].get('status') == 'processing' and job['status'] in ('failed', 'interrupted'):
                meta[date].update(status=job['status'], progress_percent=job['progress'], progress_text=job['message'])
    except Exception as error:
        print(f'Metadata job status unavailable: {error}', flush=True)
    return jsonify(meta)

@bp.route('/api/v1/dvr', methods=['POST'])
def on_dvr():
    data = request.get_json(silent=True) or {}
    print(f"Received hook: {data}")
    if not data or data.get('action') != 'on_dvr':
        return "Invalid hook", 400
    file_path = data.get('file')
    if not file_path:
        return "No file in payload", 400
    if 'objs/nginx/html/dvr' in file_path:
        file_path = file_path.split('objs/nginx/html/dvr')[-1].lstrip('/')
        file_path = os.path.join(DATA_DIR, file_path)
    try:
        file_path = safe_path(file_path)
    except ValueError:
        return "Invalid file path", 400
    stream_id = data.get('stream')
    date_str = os.path.basename(file_path)[:10]
    try:
        validate_target(date_str, stream_id)
    except ValueError:
        return "Invalid recording date or stream", 400
    with recordings_lock:
        recordings = get_recordings()
        if date_str not in recordings:
            recordings[date_str] = []
        recordings[date_str].append({
            "stream": stream_id,
            "file": file_path,
            "timestamp": datetime.now().isoformat()
        })
        save_recordings(recordings)
    return "0", 200

@bp.route('/api/v1/debug', methods=['POST'])
def debug_hook():
    data = request.get_json(silent=True) or {}
    print(f"DEBUG HOOK: {data}")
    return "0", 200

@bp.route('/api/v1/merge/<date_str>', methods=['POST'])
@admin_required
def merge_date(date_str):
    data = request.get_json(silent=True) or {}
    stream_id = data.get('stream_id') or data.get('stream') or request.args.get('stream_id') or request.args.get('stream')
    try:
        submit("merge", {"date": date_str, "stream": stream_id})
    except (ValueError, OSError) as error:
        return jsonify(error=str(error)), 409 if isinstance(error, Conflict) else 400
    msg = f"Merging started for stream {stream_id}" if stream_id else "Merging started for all streams"
    return jsonify({"status": msg, "date": date_str, "stream_id": stream_id})

@bp.route('/api/v1/delete', methods=['POST'])
@admin_required
def delete_recordings():
    return jsonify(error='Để bảo vệ dữ liệu, hãy xem trước và xác nhận xóa tại /admin/storage.',
                   code='cleanup_preview_required'), 409

@bp.route('/api/v1/metadata/rename', methods=['POST'])
@admin_required
@exclusive_write
def rename_metadata_stream():
    data = request.get_json(silent=True) or {}
    date_str = data.get('date')
    stream_id = data.get('stream_id')
    new_name = data.get('new_name')

    try:
        validate_target(date_str, stream_id)
    except (ValueError, TypeError) as error:
        return jsonify(error=str(error)), 400
    if not all([date_str, stream_id, new_name]):
        return jsonify({"error": "Missing date, stream_id or new_name"}), 400

    meta_file = os.path.join(DATA_DIR, 'metadata.json')
    if not os.path.exists(meta_file):
        return jsonify({"error": "Metadata file not found"}), 404

    with meta_lock:
        with open(meta_file, 'r') as f:
            meta = json.load(f)
        
        if date_str in meta and 'streams' in meta[date_str]:
            if stream_id in meta[date_str]['streams']:
                meta[date_str]['streams'][stream_id]['display_name'] = new_name
                save_meta(meta_file, meta)
                return jsonify({"status": "Stream renamed in metadata"}), 200
            else:
                return jsonify({"error": "Stream ID not found for this date"}), 404
        else:
            return jsonify({"error": "Date not found in metadata"}), 404
@bp.route('/api/v1/system/status', methods=['GET'])
def get_system_status():
    recordings = get_recordings()
    
    # Storage info
    total, used, free = shutil.disk_usage(DATA_DIR)
    
    # Days info
    dates = list(recordings.keys())
    meta_file = os.path.join(DATA_DIR, 'metadata.json')
    if os.path.exists(meta_file):
        try:
            with open(meta_file, 'r') as f:
                meta = json.load(f)
                dates.extend(meta.keys())
        except:
            pass
    
    unique_dates = sorted(list(set(dates)))
    days_recorded = len(unique_dates)
    
    days_since_start = 0
    if unique_dates:
        try:
            earliest_date = datetime.strptime(unique_dates[0], '%Y-%m-%d')
            days_since_start = (datetime.now() - earliest_date).days + 1
        except:
            pass
            
    return jsonify({
        "storage": {
            "total": total,
            "used": used,
            "free": free,
            "percent": (used / total) * 100 if total > 0 else 0
        },
        "days_recorded": days_recorded,
        "days_since_start": days_since_start
    })

@bp.route('/api/v1/youtube/sync', methods=['POST'])
@admin_required
def trigger_youtube_sync():
    data = request.get_json(silent=True) or {}
    try:
        job = submit('youtube', {'date': data.get('date'), 'stream': data.get('stream_id')})
        return jsonify(id=job, status='queued'), 202
    except (ValueError, OSError) as error:
        return jsonify(error=str(error)), 409 if isinstance(error, Conflict) else 400


@bp.route('/api/v1/youtube/test-upload', methods=['POST'])
@admin_required
def trigger_test_upload():
    data = request.get_json(silent=True) or {}
    try:
        validate_target(data.get('date'), data.get('stream_id'))
        if not data.get('stream_id'):
            raise ValueError('Chọn máy cần upload thử.')
        job = submit('youtube', dict(date=data['date'], stream=data['stream_id'], force=True, is_test=True))
        return jsonify(id=job, status='queued'), 202
    except (ValueError, OSError) as error:
        return jsonify(error=str(error)), 409 if isinstance(error, Conflict) else 400
