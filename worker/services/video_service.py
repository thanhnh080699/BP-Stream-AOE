import os
import json
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from config import DATA_DIR, MAX_STREAM_WORKERS, MAX_SEG_WORKERS
from utils import (
    convert_flv_to_ts, get_duration, run_ffmpeg, 
    update_meta_field, update_stream_meta, meta_lock, get_recordings
)

def format_duration_vietnamese(minutes_float):
    """
    Formats duration from minutes (float) to 'X phút Y giây' or 'X phút'.
    """
    total_seconds = int(minutes_float * 60)
    mins = total_seconds // 60
    secs = total_seconds % 60
    
    parts = []
    if mins > 0:
        parts.append(f"{mins} phút")
    if secs > 0:
        parts.append(f"{secs} giây")
        
    return " ".join(parts) if parts else "0 giây"

def get_player_name_from_db(date_str, s_id):
    """
    Tries to find player name from database for a specific date and stream ID (teamX-Y).
    """
    try:
        import database
        import re
        match = re.match(r'team(\d)-(\d)', s_id)
        if not match:
            return None
            
        team_num, pos_num = map(int, match.groups())
        team_char = 'A' if team_num == 1 else 'B'
        pos_idx = pos_num - 1 # 1-indexed to 0-indexed
        
        conn = database.get_db_connection()
        if not conn:
            return None
            
        cursor = conn.cursor(dictionary=True)
        # Find the match on that date
        cursor.execute("SELECT id FROM matches WHERE match_date = %s LIMIT 1", (date_str,))
        match_row = cursor.fetchone()
        if not match_row:
            cursor.close()
            conn.close()
            return None
            
        m_id = match_row['id']
        # Find participants for that team, ordered by ID (insertion order usually reflects position)
        cursor.execute("""
            SELECT p.name 
            FROM match_participants mp
            JOIN players p ON mp.player_id = p.id
            WHERE mp.match_id = %s AND mp.team = %s
            ORDER BY mp.id ASC
        """, (m_id, team_char))
        parts = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        if 0 <= pos_idx < len(parts):
            return parts[pos_idx]['name']
            
    except Exception as e:
        print(f"Error fetching player name from DB for {s_id} on {date_str}: {e}")
        
    return None

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

def process_one_stream(s_id, files, date_str, meta_file, meta, machine_progress_start, machine_progress_step):
    replay_dir = os.path.join(DATA_DIR, 'replays', date_str, s_id)
    ts_dir     = os.path.join(replay_dir, 'ts_tmp')
    hls_output = os.path.join(replay_dir, 'index.m3u8')

    try:
        os.makedirs(ts_dir, exist_ok=True)
        valid_files = sorted([f for f in files if os.path.exists(f)])
        skipped = len(files) - len(valid_files)
        if skipped:
            print(f"[{s_id}] WARNING: Bỏ qua {skipped} segment không có trên disk")
        if not valid_files:
            raise RuntimeError("Không tìm thấy segment nào trên disk")

        print(f"\n[{s_id}] Bắt đầu {len(valid_files)} segments "
              f"(song song {MAX_SEG_WORKERS} file cùng lúc)...")

        update_meta_field(meta_file, date_str, meta=meta,
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
                update_meta_field(meta_file, date_str, meta=meta,
                    progress_text=f"[{s_id}] Convert {done_count}/{len(seg_args)} segments...",
                    progress_percent=machine_progress_start + int(
                        machine_progress_step * 0.6 * (done_count / len(seg_args))
                    )
                )

        if any(result is None for result in results):
            raise RuntimeError("Có segment không chuyển đổi được; giữ video gốc để kiểm tra và thử lại.")
        ts_files = [r[1] for r in results if r is not None]
        total_duration = sum(r[2] for r in results if r is not None)

        if not ts_files:
            raise RuntimeError("Không convert được bất kỳ segment nào sang TS")

        print(f"[{s_id}] Convert xong: {len(ts_files)}/{len(valid_files)} segments hợp lệ")

        update_meta_field(meta_file, date_str, meta=meta,
            progress_text=f"[{s_id}] Tạo HLS...",
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
            '-hls_time', '5',
            '-hls_list_size', '0',
            '-hls_flags', 'independent_segments',
            '-hls_segment_filename', os.path.join(replay_dir, 'segment_%d.ts'),
            hls_output
        ])
        if not success:
            raise RuntimeError(f"Tạo HLS thất bại:\n{stderr[-500:]}")

        print(f"[{s_id}] ✓ HLS: {total_duration:.1f}s ({total_duration/60:.2f} phút)")

        # Xóa các file TS tạm
        for ts_path in ts_files:
            if os.path.exists(ts_path):
                os.remove(ts_path)
        
        # NOTE: Giữ lại file FLV gốc để xoá sau (theo quy trình mới: chỉ xoá sau 4 ngày)
        # print(f"[{s_id}] Đang giải phóng dung lượng: Xóa {len(valid_files)} file FLV gốc...")
        # for flv_path in valid_files:
        #     if os.path.exists(flv_path):
        #         try:
        #             os.remove(flv_path)
        #         except Exception as e:
        #             print(f"[{s_id}] Lỗi khi xóa file gốc {flv_path}: {e}")

        concat_txt = os.path.join(ts_dir, 'concat.txt')
        if os.path.exists(concat_txt):
            os.remove(concat_txt)
        try:
            os.rmdir(ts_dir)
        except Exception:
            pass

        update_stream_meta(meta_file, date_str, s_id, {
            "error": None,
            "hls":              f"replays/{date_str}/{s_id}/index.m3u8",
            "duration_minutes": round(total_duration / 60, 2),
            "file":             f"replays/{date_str}/{s_id}/index.m3u8"
        }, meta=meta)

        print(f"[{s_id}] ✓ Hoàn thành: {round(total_duration/60, 2)} phút")
        return s_id, True, None

    except Exception as e:
        print(f"[{s_id}] ✗ Lỗi: {e}")
        update_stream_meta(meta_file, date_str, s_id, {"error": str(e)}, meta=meta)
        update_meta_field(meta_file, date_str, meta=meta,
            progress_text=f"Lỗi tại {s_id}: {str(e)}"
        )
        return s_id, False, str(e)


def do_merge(date_str, target_stream_id=None):
    recordings = get_recordings()
    if date_str not in recordings:
        raise ValueError(f"Không có bản ghi ngày {date_str}")

    stream_recordings = {}
    for r in recordings[date_str]:
        s_id = r['stream']
        if s_id not in stream_recordings:
            stream_recordings[s_id] = []
        stream_recordings[s_id].append(r['file'])

    if target_stream_id:
        if target_stream_id not in stream_recordings:
            raise ValueError("Không có bản ghi cho máy được chọn.")
        stream_recordings = {target_stream_id: stream_recordings[target_stream_id]}

    meta_file = os.path.join(DATA_DIR, 'metadata.json')
    meta = {}
    with meta_lock:
        if os.path.exists(meta_file):
            try:
                with open(meta_file, 'r') as f:
                    meta = json.load(f)
            except Exception:
                pass

    progress_text = f"Đang tổng hợp máy {target_stream_id}..." if target_stream_id else "Đang bắt đầu tổng hợp..."
    update_meta_field(meta_file, date_str, meta=meta, status="processing", progress_text=progress_text, progress_percent=5)

    total_streams = len(stream_recordings)
    stream_list   = list(stream_recordings.items())

    print(f"\n{'='*60}")
    print(f"Merge {total_streams} streams ({'máy ' + target_stream_id if target_stream_id else 'toàn bộ'}) — ngày {date_str}")
    print(f"Parallel: {MAX_STREAM_WORKERS} stream × {MAX_SEG_WORKERS} seg "
          f"= tối đa {MAX_STREAM_WORKERS * MAX_SEG_WORKERS} FFmpeg processes")
    print(f"{'='*60}\n")

    failures = []
    with ThreadPoolExecutor(max_workers=1) as stream_pool:
        future_map = {}
        for i, (s_id, files) in enumerate(stream_list):
            machine_progress_start = int((i / total_streams) * 100)
            machine_progress_step  = int(100 / total_streams)
            future = stream_pool.submit(
                process_one_stream,
                s_id, files, date_str, meta_file, meta,
                machine_progress_start, machine_progress_step
            )
            future_map[future] = s_id

        for future in as_completed(future_map):
            try:
                s_id, success, err = future.result()
            except Exception as error:
                failures.append(str(error))
                continue
            if not success:
                failures.append(f"{s_id}: {err}")
            status = "✓ DONE" if success else f"✗ FAIL: {err}"
            print(f"[{status}] Stream {s_id}")

    if failures:
        update_meta_field(meta_file, date_str, status="failed", progress_text="; ".join(failures)[:2000])
        raise RuntimeError("; ".join(failures))

    completed_text = f"Đã hoàn thành tổng hợp máy {target_stream_id}." if target_stream_id else "Đã hoàn thành tổng hợp toàn bộ."
    update_meta_field(meta_file, date_str, meta=meta,
        status="completed",
        progress_percent=100,
        progress_text=completed_text
    )

def merge_hls_to_mp4(hls_file, output_mp4):
    """
    Ghép các segment HLS (.ts) thành file MP4 duy nhất (Remuxing).
    Sử dụng bitstream filter để fix audio AAC.
    """
    if not os.path.exists(hls_file):
        return False, "File HLS không tồn tại."
    
    cmd = [
        'ffmpeg', '-y',
        '-i', hls_file,
        '-c', 'copy',
        '-bsf:a', 'aac_adtstoasc',
        output_mp4
    ]
    
    success, stderr = run_ffmpeg(cmd)
    if not success:
        return False, f"Lỗi merge HLS to MP4: {stderr[-500:]}"
    
    return True, None

def get_nights_older_than(days=7):
    """
    Trả về danh sách các ngày trong metadata.json cũ hơn `days` ngày
    và thực sự có dữ liệu stream cần sync lên YouTube.
    """
    meta_file = os.path.join(DATA_DIR, 'metadata.json')
    if not os.path.exists(meta_file):
        return []

    with meta_lock:
        try:
            with open(meta_file, 'r') as f:
                meta = json.load(f)
        except Exception:
            return []

    eligible_dates = []
    cutoff_date = datetime.now() - timedelta(days=days)

    for date_str, day_data in meta.items():
        try:
            # Kiểm tra định dạng ngày YYYY-MM-DD
            if not (len(date_str) == 10 and date_str.count('-') == 2):
                continue
                
            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
            if date_obj < cutoff_date:
                streams = day_data.get('streams', {})
                if not streams:
                    continue
                
                # Chỉ tính là eligible nếu có ít nhất 1 stream chưa có youtube_url
                # và có file HLS để upload (hoặc ít nhất là có thông tin stream)
                has_work = False
                for s_id, s_info in streams.items():
                    if not s_info.get('youtube_url'):
                        # Nếu có hls path thì chắc chắn làm được
                        if s_info.get('hls'):
                            has_work = True
                            break
                        # Nếu không có hls nhưng status là completed thì có thể do lỗi metadata, 
                        # nhưng ở đây ta ưu tiên những gì có file.
                
                if has_work:
                    eligible_dates.append(date_str)
        except (ValueError, AttributeError):
            continue
    
    return eligible_dates

def do_youtube_sync(specific_date=None, specific_stream=None, force=False, is_test=False):
    from services.youtube_service import YouTubeService
    from services import admin_youtube, admin_storage, admin_store
    from services.admin_jobs import progress

    try:
        yt = YouTubeService(None, None)
        channel = admin_youtube.channel(yt.service)
        admin_store.set_setting('youtube_status', dict(connected=True, channel=channel,
            checked_at=datetime.utcnow().isoformat() + 'Z'))
    except Exception as error:
        admin_store.set_setting('youtube_status', dict(connected=False,
            code=admin_youtube.error_code(error), error=str(error)))
        raise

    dates = [specific_date] if specific_date else sorted(get_nights_older_than(7))
    uploaded = 0
    failures = []
    for date_str in dates:
        meta = admin_storage.metadata()
        day = meta.get(date_str, {})
        streams = day.get('streams', {})
        selected = [(s_id, info) for s_id, info in streams.items()
                    if (not specific_stream or s_id == specific_stream)
                    and (force or not info.get('youtube_url')) and info.get('hls')]
        if not selected:
            if specific_date:
                raise ValueError('Không có HLS local cần đồng bộ cho lựa chọn này.')
            continue
        playlist_id = day.get('youtube_playlist_id')
        if not playlist_id and not is_test:
            playlist_id = admin_youtube.retry(lambda: yt.create_playlist(
                f'AOE Replay | Ngày {date_str}', f'Bản ghi các trận AOE ngày {date_str}.'))
            update_meta_field(os.path.join(DATA_DIR, 'metadata.json'), date_str,
                              youtube_playlist_id=playlist_id,
                              youtube_playlist_url=f'https://www.youtube.com/playlist?list={playlist_id}')
        for index, (s_id, info) in enumerate(selected):
            admin_storage.check_space('youtube', dict(date=date_str, stream=s_id, force=force))
            hls = admin_storage.safe_path(info['hls'])
            output = admin_storage.safe_path(f'replays/{date_str}/{s_id}/full_match.mp4')
            progress(int(index / len(selected) * 100), f'[{s_id}] Đang tạo MP4 để upload...')
            try:
                success, error = merge_hls_to_mp4(hls, output)
                if not success:
                    if 'No space left on device' in error:
                        raise OSError(28, error)
                    raise RuntimeError(error)
                name = info.get('display_name') or get_player_name_from_db(date_str, s_id) or s_id
                progress(int(index / len(selected) * 100), f'[{s_id}] Đang upload YouTube...')
                video_id = yt.upload_video(output,
                    f'{"[TEST] " if is_test else ""}BPGROUP AOE Replay - {name} - {date_str}',
                    f'Bản ghi AOE ngày {date_str}, máy {name}. https://aoe.bpg.vn/')
                if not video_id:
                    raise RuntimeError('YouTube không trả về mã video.')
                if not is_test:
                    update_stream_meta(os.path.join(DATA_DIR, 'metadata.json'), date_str, s_id,
                        dict(youtube_id=video_id, youtube_url=f'https://www.youtube.com/watch?v={video_id}',
                             youtube_error=None, youtube_attempts=0))
                if playlist_id:
                    try:
                        admin_youtube.retry(lambda: yt.add_video_to_playlist(playlist_id, video_id))
                    except Exception as error:
                        update_stream_meta(os.path.join(DATA_DIR, 'metadata.json'), date_str, s_id,
                                           dict(youtube_error=f'Đã upload; thêm playlist thất bại: {error}'))
                        failures.append(str(error))
                # Keep all local files until an administrator explicitly confirms deletion.
                uploaded += 1
                if uploaded >= 5:
                    if failures:
                        raise RuntimeError('; '.join(failures))
                    return
            except Exception as error:
                code = admin_youtube.error_code(error)
                update_stream_meta(os.path.join(DATA_DIR, 'metadata.json'), date_str, s_id,
                                   dict(youtube_error=str(error), youtube_error_code=code))
                if code in ('signup_required', 'token_expired', 'permission_denied', 'quota_exceeded', 'not_connected'):
                    admin_store.set_setting('youtube_status', dict(connected=False, code=code, error=str(error)))
                    raise
                if isinstance(error, OSError) and error.errno == 28:
                    raise
                failures.append(f'{s_id}: {error}')
    if failures:
        raise RuntimeError('; '.join(failures))
