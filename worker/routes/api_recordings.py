import os
import json
import shutil
import threading
from datetime import datetime
from flask import Blueprint, request, jsonify
from config import DATA_DIR
from utils import get_recordings, save_recordings, meta_lock, save_meta, safe_save_json
from services.video_service import do_merge

bp = Blueprint('recordings', __name__)

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
    return jsonify(meta)

@bp.route('/api/v1/dvr', methods=['POST'])
def on_dvr():
    data = request.json
    print(f"Received hook: {data}")
    if not data or data.get('action') != 'on_dvr':
        return "Invalid hook", 400
    file_path = data.get('file')
    if not file_path:
        return "No file in payload", 400
    if 'objs/nginx/html/dvr' in file_path:
        file_path = file_path.split('objs/nginx/html/dvr')[-1].lstrip('/')
        file_path = os.path.join(DATA_DIR, file_path)
    file_path = os.path.normpath(file_path)
    stream_id = data.get('stream')
    date_str = datetime.now().strftime('%Y-%m-%d')
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
    data = request.json
    print(f"DEBUG HOOK: {data}")
    return "0", 200

@bp.route('/api/v1/merge/<date_str>', methods=['POST'])
def merge_date(date_str):
    threading.Thread(target=do_merge, args=(date_str,), daemon=True).start()
    return jsonify({"status": "Merging started", "date": date_str})

@bp.route('/api/v1/delete', methods=['POST'])
def delete_recordings():
    data = request.json
    password  = data.get('password')
    date_str  = data.get('date')
    stream_id = data.get('stream')

    if password != "1234567890":
        return jsonify({"error": "Wrong password"}), 403
    if not date_str:
        return jsonify({"error": "Date is required"}), 400

    recordings = get_recordings()
    meta_file  = os.path.join(DATA_DIR, 'metadata.json')
    meta = {}
    with meta_lock:
        if os.path.exists(meta_file):
            try:
                with open(meta_file, 'r') as f:
                    meta = json.load(f)
            except Exception:
                pass

    if date_str not in recordings and date_str not in meta:
        return jsonify({"error": "No data for this date"}), 404

    if stream_id:
        replay_dir = os.path.join(DATA_DIR, 'replays', date_str, stream_id)
        if os.path.exists(replay_dir):
            shutil.rmtree(replay_dir)
        if date_str in recordings:
            new_recs = []
            for r in recordings[date_str]:
                if r['stream'] == stream_id:
                    if os.path.exists(r['file']):
                        os.remove(r['file'])
                else:
                    new_recs.append(r)
            if not new_recs:
                del recordings[date_str]
            else:
                recordings[date_str] = new_recs
            save_recordings(recordings)
        if date_str in meta and 'streams' in meta[date_str]:
            if stream_id in meta[date_str]['streams']:
                del meta[date_str]['streams'][stream_id]
            if not meta[date_str]['streams']:
                del meta[date_str]
        save_meta(meta_file, meta)
        return jsonify({"status": f"Deleted stream {stream_id} for {date_str}"}), 200
    else:
        date_replay_dir = os.path.join(DATA_DIR, 'replays', date_str)
        if os.path.exists(date_replay_dir):
            shutil.rmtree(date_replay_dir)
        if date_str in recordings:
            for r in recordings[date_str]:
                if os.path.exists(r['file']):
                    os.remove(r['file'])
            del recordings[date_str]
            save_recordings(recordings)
        if date_str in meta:
            del meta[date_str]
            save_meta(meta_file, meta)
        return jsonify({"status": f"Deleted all data for {date_str}"}), 200

@bp.route('/api/v1/metadata/rename', methods=['POST'])
def rename_metadata_stream():
    data = request.json
    date_str = data.get('date')
    stream_id = data.get('stream_id')
    new_name = data.get('new_name')

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
