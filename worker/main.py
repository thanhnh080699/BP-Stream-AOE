from flask import Flask, request, jsonify
import os
import subprocess
from datetime import datetime
import json
import threading
import shutil

app = Flask(__name__)
DATA_DIR = os.environ.get('DATA_DIR', '/data')
LOG_FILE = os.path.join(DATA_DIR, 'recordings.json')

def get_recordings():
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_recordings(data):
    with open(LOG_FILE, 'w') as f:
        json.dump(data, f, indent=4)

@app.route('/api/v1/players', methods=['GET'])
def get_players():
    players_file = os.path.join(DATA_DIR, 'players.json')
    if os.path.exists(players_file):
        with open(players_file, 'r') as f:
            return jsonify(json.load(f))
    return jsonify({})

@app.route('/api/v1/players', methods=['POST'])
def save_players():
    data = request.json
    players_file = os.path.join(DATA_DIR, 'players.json')
    with open(players_file, 'w') as f:
        json.dump(data, f, indent=4)
    return jsonify({"status": "Players saved"}), 200

@app.route('/api/v1/metadata', methods=['GET'])
def get_metadata():
    recordings = get_recordings()

    meta_file = os.path.join(DATA_DIR, 'metadata.json')
    meta = {}
    if os.path.exists(meta_file):
        with open(meta_file, 'r') as f:
            meta = json.load(f)

    for date, files in recordings.items():
        if date not in meta or meta[date].get('status') != 'completed':
            meta[date] = meta.get(date, {
                "streams": {},
                "status": "recording"
            })

    return jsonify(meta)

@app.route('/api/v1/dvr', methods=['POST'])
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

@app.route('/api/v1/debug', methods=['POST'])
def debug_hook():
    data = request.json
    print(f"DEBUG HOOK: {data}")
    return "0", 200

@app.route('/api/v1/merge/<date_str>', methods=['POST'])
def merge_date(date_str):
    threading.Thread(target=do_merge, args=(date_str,)).start()
    return jsonify({"status": "Merging started", "date": date_str})

@app.route('/api/v1/delete', methods=['POST'])
def delete_recordings():
    data = request.json
    password = data.get('password')
    date_str = data.get('date')
    stream_id = data.get('stream')

    if password != "1234567890":
        return jsonify({"error": "Wrong password"}), 403

    if not date_str:
        return jsonify({"error": "Date is required"}), 400

    recordings = get_recordings()
    meta_file = os.path.join(DATA_DIR, 'metadata.json')
    meta = {}
    if os.path.exists(meta_file):
        with open(meta_file, 'r') as f:
            meta = json.load(f)

    if date_str not in recordings and date_str not in meta:
        return jsonify({"error": "No data for this date"}), 404

    # Target directories/files to delete
    if stream_id:
        # Delete specific stream
        # 1. Delete replay files
        replay_dir = os.path.join(DATA_DIR, 'replays', date_str, stream_id)
        if os.path.exists(replay_dir):
            shutil.rmtree(replay_dir)

        # 2. Delete raw FLV segments from recordings.json and disk
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

        # 3. Update metadata.json
        if date_str in meta and 'streams' in meta[date_str]:
            if stream_id in meta[date_str]['streams']:
                del meta[date_str]['streams'][stream_id]
            
            if not meta[date_str]['streams']:
                del meta[date_str]
        
        with open(meta_file, 'w') as f:
            json.dump(meta, f, indent=4)

        return jsonify({"status": f"Deleted stream {stream_id} for {date_str}"}), 200
    else:
        # Delete entire date
        # 1. Delete replay files
        date_replay_dir = os.path.join(DATA_DIR, 'replays', date_str)
        if os.path.exists(date_replay_dir):
            shutil.rmtree(date_replay_dir)

        # 2. Delete raw FLV segments
        if date_str in recordings:
            for r in recordings[date_str]:
                if os.path.exists(r['file']):
                    os.remove(r['file'])
            del recordings[date_str]
            save_recordings(recordings)

        # 3. Update metadata.json
        if date_str in meta:
            del meta[date_str]
            with open(meta_file, 'w') as f:
                json.dump(meta, f, indent=4)

        return jsonify({"status": f"Deleted all data for {date_str}"}), 200

def run_ffmpeg(cmd, timeout=3600):
    """Chạy FFmpeg, trả về (success, stderr)"""
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
    """Lấy duration (giây) của file media bằng ffprobe"""
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
    """
    Convert một FLV segment sang MPEG-TS.

    Tại sao cần bước này:
    - FLV của SRS reset timestamp về 0 tại mỗi segment mới
    - Nếu concat FLV thẳng, FFmpeg bị lệch timestamp → chỉ lấy được 1 segment
    - MPEG-TS dùng continuous PTS/DTS → concat hoàn toàn sạch
    - Transcode tại đây để fix FMO (QSV) và NAL unit lỗi 1 lần duy nhất
    """
    return run_ffmpeg([
        'ffmpeg', '-y',
        '-fflags', '+genpts+igndts+discardcorrupt',
        '-err_detect', 'ignore_err',    # Không crash khi gặp FMO / NAL lỗi
        '-analyzeduration', '100M',
        '-probesize', '100M',
        '-i', flv_path,
        # Transcode để normalize stream, fix FMO từ QSV encoder
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '44100',
        # Output MPEG-TS với Annex B bitstream
        '-bsf:v', 'h264_mp4toannexb',
        '-f', 'mpegts',
        ts_path
    ])

def do_merge(date_str):
    recordings = get_recordings()
    if date_str not in recordings:
        print(f"No recordings found for date: {date_str}")
        return

    # Group by stream
    stream_recordings = {}
    for r in recordings[date_str]:
        s_id = r['stream']
        if s_id not in stream_recordings:
            stream_recordings[s_id] = []
        stream_recordings[s_id].append(r['file'])

    meta_file = os.path.join(DATA_DIR, 'metadata.json')
    meta = {}
    if os.path.exists(meta_file):
        with open(meta_file, 'r') as f:
            try:
                meta = json.load(f)
            except Exception:
                meta = {}

    if date_str not in meta:
        meta[date_str] = {"streams": {}, "status": "processing"}
    else:
        meta[date_str]["status"] = "processing"
        if "streams" not in meta[date_str]:
            meta[date_str]["streams"] = {}

    with open(meta_file, 'w') as f:
        json.dump(meta, f, indent=4)

    total_streams = len(stream_recordings)

    for i, (s_id, files) in enumerate(stream_recordings.items()):
        if not files:
            continue

        machine_progress_start = int((i / total_streams) * 100)
        machine_progress_step = int(100 / total_streams)

        replay_dir = os.path.join(DATA_DIR, 'replays', date_str, s_id)
        ts_dir = os.path.join(replay_dir, 'ts_tmp')  # Thư mục tạm cho TS trung gian
        os.makedirs(ts_dir, exist_ok=True)

        mp4_output = os.path.join(replay_dir, 'summary.mp4')
        hls_output = os.path.join(replay_dir, 'index.m3u8')

        try:
            # ── Bước 1: Lọc segment tồn tại thực sự trên disk ─────────────────
            valid_files = sorted([f for f in files if os.path.exists(f)])
            skipped = len(files) - len(valid_files)
            if skipped > 0:
                print(f"WARNING: Bỏ qua {skipped} segment không tồn tại của {s_id}")
            if not valid_files:
                raise RuntimeError("Không tìm thấy segment nào trên disk")

            print(f"\n[{s_id}] Bắt đầu xử lý {len(valid_files)} segments...")

            # ── Bước 2: Convert từng FLV → MPEG-TS ────────────────────────────
            # FLV reset timestamp về 0 mỗi file → phải qua TS để có
            # continuous PTS/DTS, tránh ffmpeg chỉ lấy được 1 segment
            ts_files = []
            for j, flv_path in enumerate(valid_files):
                ts_path = os.path.join(ts_dir, f"seg_{j:04d}.ts")

                meta[date_str]["progress_text"] = (
                    f"[{s_id}] Convert segment {j+1}/{len(valid_files)}..."
                )
                meta[date_str]["progress_percent"] = (
                    machine_progress_start
                    + int(machine_progress_step * 0.6 * ((j + 1) / len(valid_files)))
                )
                with open(meta_file, 'w') as f:
                    json.dump(meta, f, indent=4)

                success, stderr = convert_flv_to_ts(flv_path, ts_path)
                if not success:
                    print(f"  ✗ Không convert được segment {j+1} ({flv_path}):\n{stderr}")
                    continue

                seg_duration = get_duration(ts_path)
                if seg_duration < 1.0:
                    print(f"  ✗ Segment {j+1} quá ngắn ({seg_duration:.1f}s) — bỏ qua")
                    os.remove(ts_path)
                    continue

                print(f"  ✓ Segment {j+1}: {seg_duration:.1f}s")
                ts_files.append(ts_path)

            if not ts_files:
                raise RuntimeError("Không convert được bất kỳ segment nào sang TS")

            # ── Bước 3: Concat tất cả TS → MP4 ───────────────────────────────
            # TS đã được transcode ở bước 2 → chỉ cần stream copy, rất nhanh
            meta[date_str]["progress_text"] = f"[{s_id}] Nối {len(ts_files)} segments → MP4..."
            meta[date_str]["progress_percent"] = machine_progress_start + int(machine_progress_step * 0.75)
            with open(meta_file, 'w') as f:
                json.dump(meta, f, indent=4)

            list_file = os.path.join(ts_dir, 'concat.txt')
            with open(list_file, 'w') as f:
                for ts_path in ts_files:
                    f.write(f"file '{ts_path}'\n")

            success, stderr = run_ffmpeg([
                'ffmpeg', '-y',
                '-f', 'concat', '-safe', '0', '-i', list_file,
                '-c', 'copy',
                '-movflags', '+faststart',
                '-max_muxing_queue_size', '9999',
                mp4_output
            ])
            if not success:
                raise RuntimeError(f"Concat TS → MP4 thất bại:\n{stderr}")

            total_duration = get_duration(mp4_output)
            print(f"  ✓ MP4 tổng: {total_duration:.1f}s ({total_duration/60:.2f} phút)")

            # ── Bước 4: MP4 → HLS (Netflix style) ────────────────────────────
            meta[date_str]["progress_text"] = f"[{s_id}] Tạo HLS..."
            meta[date_str]["progress_percent"] = machine_progress_start + int(machine_progress_step * 0.88)
            with open(meta_file, 'w') as f:
                json.dump(meta, f, indent=4)

            success, stderr = run_ffmpeg([
                'ffmpeg', '-y',
                '-i', mp4_output,
                '-c:v', 'copy',
                '-c:a', 'copy',
                '-bsf:v', 'h264_mp4toannexb',
                '-hls_time', '5',
                '-hls_list_size', '0',
                '-hls_flags', 'independent_segments',  # Mỗi segment seek độc lập
                '-hls_segment_filename', os.path.join(replay_dir, 'segment_%d.ts'),
                hls_output
            ])
            if not success:
                raise RuntimeError(f"Tạo HLS thất bại:\n{stderr}")

            # ── Cleanup TS trung gian ──────────────────────────────────────────
            for ts_path in ts_files:
                if os.path.exists(ts_path):
                    os.remove(ts_path)
            for fname in ['concat.txt']:
                p = os.path.join(ts_dir, fname)
                if os.path.exists(p):
                    os.remove(p)
            try:
                os.rmdir(ts_dir)
            except Exception:
                pass

            meta[date_str]["streams"][s_id] = {
                "mp4": f"replays/{date_str}/{s_id}/summary.mp4",
                "hls": f"replays/{date_str}/{s_id}/index.m3u8",
                "duration_minutes": round(total_duration / 60, 2),
                "file": f"replays/{date_str}/{s_id}/index.m3u8"
            }

            print(f"[{s_id}] ✓ Hoàn thành: {round(total_duration/60, 2)} phút\n")

        except Exception as e:
            print(f"[{s_id}] ✗ Lỗi: {e}")
            meta[date_str]["streams"][s_id] = {"error": str(e)}
            meta[date_str]["progress_text"] = f"Lỗi tại {s_id}: {str(e)}"
            with open(meta_file, 'w') as f:
                json.dump(meta, f, indent=4)
            continue  # Tiếp tục các stream khác dù 1 stream bị lỗi

    meta[date_str]["status"] = "completed"
    meta[date_str]["progress_percent"] = 100
    meta[date_str]["progress_text"] = "Đã hoàn thành tổng hợp toàn bộ."
    with open(meta_file, 'w') as f:
        json.dump(meta, f, indent=4)

    print(f"=== Merge hoàn tất cho ngày {date_str} ===")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
