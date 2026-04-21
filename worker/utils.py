import json
import os
import threading
import subprocess
from config import LOG_FILE

meta_lock = threading.RLock()
recordings_lock = threading.RLock()

def get_recordings():
    if os.path.exists(LOG_FILE):
        with recordings_lock:
            try:
                with open(LOG_FILE, 'r') as f:
                    return json.load(f)
            except Exception:
                return {}
    return {}

def safe_save_json(file_path, data):
    """Save JSON atomically using a temporary file and rename."""
    temp_path = file_path + ".tmp"
    try:
        with open(temp_path, 'w') as f:
            json.dump(data, f, indent=4)
        os.replace(temp_path, file_path)
    except Exception as e:
        print(f"Error saving JSON to {file_path}: {e}")
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass

def save_recordings(data):
    with recordings_lock:
        safe_save_json(LOG_FILE, data)

def delete_recordings_by_date(date_str):
    with recordings_lock:
        if os.path.exists(LOG_FILE):
            try:
                with open(LOG_FILE, 'r') as f:
                    data = json.load(f)
                if date_str in data:
                    del data[date_str]
                    safe_save_json(LOG_FILE, data)
            except Exception as e:
                print(f"Error cleaning up recordings for {date_str}: {e}")

def save_meta(meta_file, meta):
    with meta_lock:
        safe_save_json(meta_file, meta)

def update_meta_field(meta_file, date_str, meta=None, **kwargs):
    """Update a field in metadata. If meta is provided, use it and SAVE it. Otherwise load, update, save."""
    with meta_lock:
        if meta is None:
            meta = {}
            if os.path.exists(meta_file):
                try:
                    with open(meta_file, 'r') as f:
                        meta = json.load(f)
                except Exception:
                    pass
        
        if date_str not in meta:
            meta[date_str] = {"streams": {}, "status": "processing"}
            
        for k, v in kwargs.items():
            meta[date_str][k] = v
            
        safe_save_json(meta_file, meta)

def update_stream_meta(meta_file, date_str, s_id, stream_data, meta=None):
    """Update a stream in metadata. If meta is provided, use it and SAVE it. Otherwise load, update, save."""
    with meta_lock:
        if meta is None:
            meta = {}
            if os.path.exists(meta_file):
                try:
                    with open(meta_file, 'r') as f:
                        meta = json.load(f)
                except Exception:
                    pass
                
        if date_str not in meta:
            meta[date_str] = {"streams": {}, "status": "processing"}
        if "streams" not in meta[date_str]:
            meta[date_str]["streams"] = {}
            
        meta[date_str]["streams"][s_id] = stream_data
        
        safe_save_json(meta_file, meta)

def run_ffmpeg(cmd, timeout=3600):
    try:
        result = subprocess.run(
            cmd, check=True, timeout=timeout,
            capture_output=True, text=True
        )
        return True, result.stderr
    except subprocess.CalledProcessError as e:
        return False, e.stderr
    except subprocess.TimeoutExpired:
        return False, "Timeout"

def get_duration(file_path):
    try:
        out = subprocess.check_output([
            'ffprobe', '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            file_path
        ], stderr=subprocess.DEVNULL).decode().strip()
        return float(out)
    except Exception:
        return 0.0

def convert_flv_to_ts(flv_path, ts_path):
    return run_ffmpeg([
        'ffmpeg', '-y',
        '-fflags', '+genpts+igndts+discardcorrupt',
        '-err_detect', 'ignore_err',
        '-analyzeduration', '100M',
        '-probesize', '100M',
        '-i', flv_path,
        '-map', '0:v:0',
        '-map', '0:a:0',
        '-c:v', 'copy',
        '-c:a', 'copy',
        '-f', 'mpegts',
        ts_path
    ])
