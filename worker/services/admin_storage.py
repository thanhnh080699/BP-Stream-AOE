import json
import os
import re
import shutil
import threading
import time
from datetime import datetime
from zoneinfo import ZoneInfo
from config import DATA_DIR
from utils import get_recordings, meta_lock, safe_save_json, save_recordings, recordings_lock

GIB = 1024 ** 3
_lock = threading.Lock()
_cache = {'rows': [], 'updated_at': None, 'scanning': False, 'error': None}


def validate_target(date, stream=None):
    if not isinstance(date, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date):
        raise ValueError('Ngày không hợp lệ.')
    datetime.strptime(date, '%Y-%m-%d')
    if stream is not None and (not isinstance(stream, str) or not re.fullmatch(r'team[12]-[1-4]', stream)):
        raise ValueError('Máy không hợp lệ.')


def safe_path(path):
    root = os.path.abspath(DATA_DIR)
    full = os.path.abspath(path if os.path.isabs(path) else os.path.join(root, path))
    if os.path.commonpath([root, full]) != root or full == root:
        raise ValueError('Đường dẫn nằm ngoài thư mục dữ liệu.')
    relative = os.path.relpath(full, root)
    current = root
    for part in relative.split(os.sep):
        current = os.path.join(current, part)
        if os.path.islink(current):
            raise ValueError('Không thao tác đường dẫn symlink.')
    return full


def recording_path(row, date):
    validate_target(date, row['stream'])
    file = safe_path(row['file'])
    expected = safe_path(f"live/{row['stream']}")
    if os.path.dirname(file) != expected or not os.path.basename(file).startswith(date + '-') or not file.endswith('.flv'):
        raise ValueError('Bản ghi có đường dẫn không khớp ngày/máy trong thư mục live.')
    return file


def files_in(path):
    path = safe_path(path)
    if not os.path.isdir(path):
        return []
    result = []
    for root, dirs, files in os.walk(path, followlinks=False):
        dirs[:] = [d for d in dirs if not os.path.islink(os.path.join(root, d))]
        for name in files:
            file = os.path.join(root, name)
            if not os.path.islink(file) and os.path.isfile(file):
                result.append(safe_path(file))
    return result


def metadata():
    with meta_lock:
        path = os.path.join(DATA_DIR, 'metadata.json')
        if not os.path.exists(path):
            return {}
        with open(path) as source:
            return json.load(source)


def disk():
    total, used, free = shutil.disk_usage(DATA_DIR)
    return dict(total=total, used=used, free=free, percent=round(used / total * 100, 1))


def inventory_scan():
    try:
        recordings, meta = get_recordings(), metadata()
        grouped = {}
        for date, rows in recordings.items():
            for row in rows:
                key = (date, row['stream'])
                grouped.setdefault(key, set()).add(recording_path(row, date))
        for date, day in meta.items():
            for stream in day.get('streams', {}):
                grouped.setdefault((date, stream), set())
        replay_root = safe_path('replays')
        if os.path.isdir(replay_root):
            for date in os.listdir(replay_root):
                try:
                    validate_target(date)
                    folder = safe_path(os.path.join(replay_root, date))
                    if not os.path.isdir(folder):
                        continue
                    for stream in os.listdir(folder):
                        validate_target(date, stream)
                        if os.path.isdir(safe_path(os.path.join(folder, stream))):
                            grouped.setdefault((date, stream), set())
                except ValueError:
                    continue
        # Include unindexed originals without silently deleting them.
        for file in files_in('live'):
            match = re.fullmatch(r'(\d{4}-\d{2}-\d{2})-.*\.flv', os.path.basename(file))
            stream = os.path.basename(os.path.dirname(file))
            if match:
                try:
                    validate_target(match[1], stream)
                    grouped.setdefault((match[1], stream), set()).add(file)
                except ValueError:
                    continue
        rows = []
        for (date, stream), originals in grouped.items():
            validate_target(date, stream)
            info = meta.get(date, {}).get('streams', {}).get(stream, {})
            row = dict(date=date, stream=stream, name=info.get('display_name', stream),
                       raw_bytes=0, hls_bytes=0, mp4_bytes=0, temp_bytes=0,
                       raw_count=0, missing_count=0, youtube_url=info.get('youtube_url'),
                       error=info.get('error') or info.get('youtube_error'),
                       status=meta.get(date, {}).get('status', 'recording'))
            for file in originals:
                if os.path.isfile(file):
                    row['raw_bytes'] += os.path.getsize(file)
                    row['raw_count'] += 1
                else:
                    row['missing_count'] += 1
            for file in files_in(f'replays/{date}/{stream}'):
                category = 'temp_bytes' if 'ts_tmp' in file.split(os.sep) or file.endswith('.tmp') else 'mp4_bytes' if file.endswith('.mp4') else 'hls_bytes'
                row[category] += os.path.getsize(file)
            rows.append(row)
        with _lock:
            _cache.update(rows=sorted(rows, key=lambda row: (row['date'], row['stream']), reverse=True),
                          updated_at=time.time(), error=None)
    except Exception as error:
        with _lock:
            _cache['error'] = str(error)
    finally:
        with _lock:
            _cache['scanning'] = False


def inventory(force=False):
    with _lock:
        if not _cache['scanning'] and (force or not _cache['updated_at'] or time.time() - _cache['updated_at'] > 300):
            _cache['scanning'] = True
            threading.Thread(target=inventory_scan, daemon=True).start()
        return dict(_cache)


def targets(date, stream, category):
    validate_target(date, stream)
    if category not in ('raw', 'replay', 'temporary'):
        raise ValueError('Loại dữ liệu không hợp lệ.')
    today = datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).strftime('%Y-%m-%d')
    if date >= today:
        raise ValueError('Không dọn dữ liệu hôm nay hoặc ngày tương lai để bảo vệ bản ghi đang live.')
    result = set()
    if category == 'raw':
        for row in get_recordings().get(date, []):
            if not stream or row['stream'] == stream:
                file = recording_path(row, date)
                if os.path.isfile(file):
                    result.add(file)
        for file in files_in('live'):
            if os.path.basename(file).startswith(date + '-') and file.endswith('.flv'):
                if not stream or os.path.basename(os.path.dirname(file)) == stream:
                    result.add(file)
    else:
        for file in files_in(f'replays/{date}' + (f'/{stream}' if stream else '')):
            if category == 'replay' or 'ts_tmp' in file.split(os.sep) or file.endswith('.tmp'):
                result.add(file)
    snapshot = []
    for file in sorted(result):
        stat = os.stat(file)
        if time.time() - stat.st_mtime < 300:
            raise ValueError('Có file vừa được ghi trong 5 phút gần đây; hãy thử lại sau.')
        snapshot.append(dict(path=os.path.relpath(file, DATA_DIR), size=stat.st_size,
                             mtime_ns=stat.st_mtime_ns, inode=stat.st_ino))
    return snapshot


def delete_snapshot(payload):
    fresh = targets(payload['date'], payload.get('stream'), payload['category'])
    if fresh != payload['files']:
        raise ValueError('Dữ liệu đã thay đổi. Hãy tạo bản xem trước mới.')
    for file in fresh:
        os.remove(safe_path(file['path']))
    date, stream = payload['date'], payload.get('stream')
    if payload['category'] == 'raw':
        with recordings_lock:
            recordings = get_recordings()
            recordings[date] = [r for r in recordings.get(date, []) if stream and r['stream'] != stream]
            if not recordings[date]:
                del recordings[date]
            save_recordings(recordings)
    if payload['category'] == 'replay':
        with meta_lock:
            meta = metadata()
            for key, info in meta.get(date, {}).get('streams', {}).items():
                if not stream or key == stream:
                    info['hls'] = None
                    info['file'] = None
            safe_save_json(os.path.join(DATA_DIR, 'metadata.json'), meta)
    if fresh:
        inventory(force=True)
    return sum(file['size'] for file in fresh)


def input_size(kind, payload):
    date, stream = payload.get('date'), payload.get('stream')
    if date:
        validate_target(date, stream)
    if kind == 'merge':
        files = {recording_path(r, date) for r in get_recordings().get(date, [])
                 if not stream or r['stream'] == stream}
        if not files or any(not os.path.isfile(file) for file in files):
            raise ValueError('Thiếu video gốc để tổng hợp.')
        return sum(os.path.getsize(file) for file in files)
    from services.video_service import get_nights_older_than
    meta = metadata()
    dates = [date] if date else get_nights_older_than(7)
    sizes = []
    for day in dates:
        validate_target(day)
        for stream_id, info in meta.get(day, {}).get('streams', {}).items():
            if stream and stream_id != stream:
                continue
            if not info.get('hls') or (info.get('youtube_url') and not payload.get('force')):
                continue
            validate_target(day, stream_id)
            sizes.append(sum(os.path.getsize(file) for file in files_in(f'replays/{day}/{stream_id}')
                             if file.endswith('.ts') and 'ts_tmp' not in file.split(os.sep)))
    # Sync processes one video at a time and checks again before every conversion.
    return max(sizes, default=0)


def check_space(kind, payload):
    required = 2 * input_size(kind, payload) + 5 * GIB
    if disk()['free'] < required:
        raise OSError(28, f'Không đủ dung lượng: cần ít nhất {required / GIB:.1f} GiB trống.')
    return required
