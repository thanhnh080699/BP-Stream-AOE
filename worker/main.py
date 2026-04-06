from flask import Flask, request, jsonify
import os
import subprocess
from datetime import datetime
import json
import threading
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
import mysql.connector
from mysql.connector import Error
import time

app = Flask(__name__)
DATA_DIR = os.environ.get('DATA_DIR', '/data')
LOG_FILE = os.path.join(DATA_DIR, 'recordings.json')

# ──────────────────────────────────────────────────────────────────────────────
# Tuning cho HDD + 40 vCPU + 3GB RAM
#
#  MAX_STREAM_WORKERS  : Số stream xử lý song song
#                        HDD bottleneck → 3 stream cùng lúc là tối ưu
#
#  MAX_SEG_WORKERS     : Số segment FLV→TS convert song song trong 1 stream
#                        Dùng -c copy nên I/O bound, không CPU bound
#                        4 là điểm cân bằng tốt nhất cho HDD
#                        (10 sẽ gây random I/O thrash → chậm hơn tuần tự)
#
#  FFMPEG_THREADS      : Số CPU thread/process
# ──────────────────────────────────────────────────────────────────────────────
MAX_STREAM_WORKERS = 3
MAX_SEG_WORKERS    = 4
FFMPEG_THREADS     = 2

meta_lock = threading.Lock()

# DB Configuration
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'host.docker.internal'),
    'port': int(os.environ.get('DB_PORT', 3306)),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', 'root'),
    'database': os.environ.get('DB_NAME', 'aoe_scoreboard')
}

def get_db_connection(with_db=True):
    config = DB_CONFIG.copy()
    if not with_db:
        config.pop('database', None)
        
    max_retries = 5
    retry_count = 0
    while retry_count < max_retries:
        try:
            return mysql.connector.connect(**config)
        except Error as e:
            print(f"Error connecting to MariaDB: {e}")
            retry_count += 1
            time.sleep(3)
    return None

def init_db():
    # 1. First ensure the database exists
    conn = get_db_connection(with_db=False)
    if conn:
        try:
            cursor = conn.cursor()
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_CONFIG['database']}")
            conn.commit()
            cursor.close()
            conn.close()
        except Error as e:
            print(f"Error creating database: {e}")
            if conn: conn.close()

    # 2. Then ensure the table exists
    conn = get_db_connection(with_db=True)
    if conn:
        try:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS scoreboard (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    match_date DATE NOT NULL,
                    match_type VARCHAR(50) NOT NULL,
                    team_a_players TEXT NOT NULL,
                    team_b_players TEXT NOT NULL,
                    score_a INT DEFAULT 0,
                    score_b INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS players (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
            cursor.close()
        except Error as e:
            print(f"Error initializing table: {e}")
        finally:
            conn.close()

init_db()

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_recordings():
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_recordings(data):
    with open(LOG_FILE, 'w') as f:
        json.dump(data, f, indent=4)

def save_meta(meta_file, meta):
    with meta_lock:
        with open(meta_file, 'w') as f:
            json.dump(meta, f, indent=4)

def update_meta_field(meta, meta_file, date_str, **kwargs):
    with meta_lock:
        for k, v in kwargs.items():
            meta[date_str][k] = v
        with open(meta_file, 'w') as f:
            json.dump(meta, f, indent=4)

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
        '-c:v', 'copy',
        '-c:a', 'copy',
        '-f', 'mpegts',
        ts_path
    ])

# ── Flask Routes ──────────────────────────────────────────────────────────────

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
            meta[date] = meta.get(date, {"streams": {}, "status": "recording"})
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
    threading.Thread(target=do_merge, args=(date_str,), daemon=True).start()
    return jsonify({"status": "Merging started", "date": date_str})

@app.route('/api/v1/delete', methods=['POST'])
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
    if os.path.exists(meta_file):
        with open(meta_file, 'r') as f:
            meta = json.load(f)

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
        with open(meta_file, 'w') as f:
            json.dump(meta, f, indent=4)
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
            with open(meta_file, 'w') as f:
                json.dump(meta, f, indent=4)
        return jsonify({"status": f"Deleted all data for {date_str}"}), 200

# Scoreboard APIs
@app.route('/api/v1/scores', methods=['GET'])
def get_scores():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM scoreboard ORDER BY match_date DESC, id DESC")
        scores = cursor.fetchall()
        
        grouped_scores = {}
        for row in scores:
            date_str = str(row['match_date'])
            if date_str not in grouped_scores:
                grouped_scores[date_str] = []
            
            row['match_date'] = date_str
            grouped_scores[date_str].append(row)
            
        return jsonify(grouped_scores)
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/v1/scores', methods=['POST'])
def add_score():
    data = request.json
    match_date = data.get('match_date')
    match_type = data.get('match_type')
    team_a_players = data.get('team_a_players')
    team_b_players = data.get('team_b_players')
    score_a = data.get('score_a', 0)
    score_b = data.get('score_b', 0)
    
    if not all([match_date, match_type, team_a_players, team_b_players]):
        return jsonify({"error": "Missing required fields"}), 400
        
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO scoreboard (match_date, match_type, team_a_players, team_b_players, score_a, score_b)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (match_date, match_type, team_a_players, team_b_players, score_a, score_b))
        conn.commit()
        return jsonify({"status": "Score added", "id": cursor.lastrowid}), 201
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/v1/scores/<int:score_id>', methods=['DELETE'])
def delete_score(score_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM scoreboard WHERE id = %s", (score_id,))
        conn.commit()
        return jsonify({"status": "Score deleted"}), 200
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# Players DB APIs
@app.route('/api/v1/players-db', methods=['GET'])
def get_players_db():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM players ORDER BY name ASC")
        players = cursor.fetchall()
        return jsonify(players)
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/v1/players-db', methods=['POST'])
def add_player_db():
    data = request.json
    name = data.get('name')
    if not name:
        return jsonify({"error": "Name is required"}), 400
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO players (name) VALUES (%s)", (name,))
        conn.commit()
        return jsonify({"status": "Player added", "id": cursor.lastrowid}), 201
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/v1/players-db/<int:player_id>', methods=['DELETE'])
def delete_player_db(player_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM players WHERE id = %s", (player_id,))
        conn.commit()
        return jsonify({"status": "Player deleted"}), 200
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# ── Core merge workers ────────────────────────────────────────────────────────

def process_one_segment(args):
    j, flv_path, ts_path = args
    success, stderr = convert_flv_to_ts(flv_path, ts_path)
    if not success:
        print(f"  ✗ Segment {j+1} lỗi ({os.path.basename(flv_path)}):\n{stderr[-300:]}")
        return None
    duration = get_duration(ts_path)
    if duration < 1.0:
        print(f"  ✗ Segment {j+1} quá ngắn ({duration:.1f}s) — bỏ qua")
        if os.path.exists(ts_path):
            os.remove(ts_path)
        return None
    print(f"  ✓ Segment {j+1}: {duration:.1f}s  ({os.path.basename(flv_path)})")
    return (j, ts_path, duration)


def process_one_stream(s_id, files, date_str, meta, meta_file,
                       machine_progress_start, machine_progress_step):
    replay_dir = os.path.join(DATA_DIR, 'replays', date_str, s_id)
    ts_dir     = os.path.join(replay_dir, 'ts_tmp')
    os.makedirs(ts_dir, exist_ok=True)

    mp4_output = os.path.join(replay_dir, 'summary.mp4')
    hls_output = os.path.join(replay_dir, 'index.m3u8')

    try:
        valid_files = sorted([f for f in files if os.path.exists(f)])
        skipped = len(files) - len(valid_files)
        if skipped:
            print(f"[{s_id}] WARNING: Bỏ qua {skipped} segment không có trên disk")
        if not valid_files:
            raise RuntimeError("Không tìm thấy segment nào trên disk")

        print(f"\n[{s_id}] Bắt đầu {len(valid_files)} segments "
              f"(song song {MAX_SEG_WORKERS} file cùng lúc)...")

        update_meta_field(meta, meta_file, date_str,
            progress_text=f"[{s_id}] Convert {len(valid_files)} segments...",
            progress_percent=machine_progress_start + int(machine_progress_step * 0.05)
        )

        seg_args = [
            (j, flv_path, os.path.join(ts_dir, f"seg_{j:04d}.ts"))
            for j, flv_path in enumerate(valid_files)
        ]

        results = [None] * len(seg_args)
        with ThreadPoolExecutor(max_workers=MAX_SEG_WORKERS) as seg_pool:
            future_map = {
                seg_pool.submit(process_one_segment, arg): arg[0]
                for arg in seg_args
            }
            done_count = 0
            for future in as_completed(future_map):
                idx    = future_map[future]
                result = future.result()
                if result:
                    results[idx] = result
                done_count += 1
                update_meta_field(meta, meta_file, date_str,
                    progress_text=f"[{s_id}] Convert {done_count}/{len(seg_args)} segments...",
                    progress_percent=machine_progress_start + int(
                        machine_progress_step * 0.6 * (done_count / len(seg_args))
                    )
                )

        ts_files = [r[1] for r in results if r is not None]
        if not ts_files:
            raise RuntimeError("Không convert được bất kỳ segment nào sang TS")

        print(f"[{s_id}] Convert xong: {len(ts_files)}/{len(valid_files)} segments hợp lệ")

        update_meta_field(meta, meta_file, date_str,
            progress_text=f"[{s_id}] Nối {len(ts_files)} segments → MP4...",
            progress_percent=machine_progress_start + int(machine_progress_step * 0.70)
        )

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
            raise RuntimeError(f"Concat TS → MP4 thất bại:\n{stderr[-500:]}")

        total_duration = get_duration(mp4_output)
        print(f"[{s_id}] ✓ MP4: {total_duration:.1f}s ({total_duration/60:.2f} phút)")

        update_meta_field(meta, meta_file, date_str,
            progress_text=f"[{s_id}] Tạo HLS...",
            progress_percent=machine_progress_start + int(machine_progress_step * 0.85)
        )

        success, stderr = run_ffmpeg([
            'ffmpeg', '-y',
            '-i', mp4_output,
            '-c:v', 'copy',
            '-c:a', 'copy',
            '-bsf:v', 'h264_mp4toannexb',
            '-hls_time', '5',
            '-hls_list_size', '0',
            '-hls_flags', 'independent_segments',
            '-hls_segment_filename', os.path.join(replay_dir, 'segment_%d.ts'),
            hls_output
        ])
        if not success:
            raise RuntimeError(f"Tạo HLS thất bại:\n{stderr[-500:]}")

        for ts_path in ts_files:
            if os.path.exists(ts_path):
                os.remove(ts_path)
        concat_txt = os.path.join(ts_dir, 'concat.txt')
        if os.path.exists(concat_txt):
            os.remove(concat_txt)
        try:
            os.rmdir(ts_dir)
        except Exception:
            pass

        with meta_lock:
            meta[date_str]["streams"][s_id] = {
                "mp4":              f"replays/{date_str}/{s_id}/summary.mp4",
                "hls":              f"replays/{date_str}/{s_id}/index.m3u8",
                "duration_minutes": round(total_duration / 60, 2),
                "file":             f"replays/{date_str}/{s_id}/index.m3u8"
            }

        print(f"[{s_id}] ✓ Hoàn thành: {round(total_duration/60, 2)} phút")
        return s_id, True, None

    except Exception as e:
        print(f"[{s_id}] ✗ Lỗi: {e}")
        with meta_lock:
            meta[date_str]["streams"][s_id] = {"error": str(e)}
        update_meta_field(meta, meta_file, date_str,
            progress_text=f"Lỗi tại {s_id}: {str(e)}"
        )
        return s_id, False, str(e)


def do_merge(date_str):
    recordings = get_recordings()
    if date_str not in recordings:
        print(f"No recordings found for date: {date_str}")
        return

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

    save_meta(meta_file, meta)

    total_streams = len(stream_recordings)
    stream_list   = list(stream_recordings.items())

    print(f"\n{'='*60}")
    print(f"Merge {total_streams} streams — ngày {date_str}")
    print(f"Parallel: {MAX_STREAM_WORKERS} stream × {MAX_SEG_WORKERS} seg "
          f"= tối đa {MAX_STREAM_WORKERS * MAX_SEG_WORKERS} FFmpeg processes")
    print(f"{'='*60}\n")

    with ThreadPoolExecutor(max_workers=MAX_STREAM_WORKERS) as stream_pool:
        future_map = {}
        for i, (s_id, files) in enumerate(stream_list):
            machine_progress_start = int((i / total_streams) * 100)
            machine_progress_step  = int(100 / total_streams)
            future = stream_pool.submit(
                process_one_stream,
                s_id, files, date_str, meta, meta_file,
                machine_progress_start, machine_progress_step
            )
            future_map[future] = s_id

        for future in as_completed(future_map):
            s_id, success, err = future.result()
            status = "✓ DONE" if success else f"✗ FAIL: {err}"
            print(f"[{status}] Stream {s_id}")

    update_meta_field(meta, meta_file, date_str,
        status="completed",
        progress_percent=100,
        progress_text="Đã hoàn thành tổng hợp toàn bộ."
    )

    print(f"\n{'='*60}")
    print(f"=== Merge hoàn tất cho ngày {date_str} ===")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
