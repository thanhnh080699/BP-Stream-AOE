import os
import json
import time
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from config import DATA_DIR, MAX_STREAM_WORKERS, MAX_SEG_WORKERS
from utils import (
    convert_flv_to_ts, get_duration, run_ffmpeg, 
    update_meta_field, update_stream_meta, save_meta, meta_lock, get_recordings,
    save_recordings, recordings_lock
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
    os.makedirs(ts_dir, exist_ok=True)

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
    with meta_lock:
        if os.path.exists(meta_file):
            try:
                with open(meta_file, 'r') as f:
                    meta = json.load(f)
            except Exception:
                pass
    update_meta_field(meta_file, date_str, meta=meta, status="processing")

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
                s_id, files, date_str, meta_file, meta,
                machine_progress_start, machine_progress_step
            )
            future_map[future] = s_id

        for future in as_completed(future_map):
            s_id, success, err = future.result()
            status = "✓ DONE" if success else f"✗ FAIL: {err}"
            print(f"[{status}] Stream {s_id}")

    update_meta_field(meta_file, date_str, meta=meta,
        status="completed",
        progress_percent=100,
        progress_text="Đã hoàn thành tổng hợp toàn bộ."
    )

    # Thay đổi: Không xoá ngay recordings của ngày vừa gộp.
    # Thay vào đó, chạy cleanup để xoá các ngày cũ hơn 4 ngày (bao gồm cả file vật lý)
    cleanup_old_recordings(keep_days=4)

def cleanup_old_recordings(keep_days=4):
    """
    Xoá các bản ghi live (FLV) và metadata trong recordings.json 
    nếu cũ hơn keep_days ngày (bao gồm cả hôm nay).
    Ví dụ keep_days=4 thì giữ lại: Hôm nay, Hôm qua, Hôm kia, Hôm kìa.
    """
    from datetime import datetime, timedelta
    from utils import get_recordings, save_recordings, recordings_lock
    
    print(f"\n--- Bắt đầu dọn dẹp recordings cũ (giữ lại {keep_days} ngày gần nhất) ---")
    
    recordings = get_recordings()
    if not recordings:
        return

    # Lấy danh sách các ngày, format YYYY-MM-DD
    dates = sorted(recordings.keys(), reverse=True)
    if len(dates) <= keep_days:
        print(f"Số lượng ngày ghi ({len(dates)}) <= {keep_days}, không cần xoá.")
        return

    # Các ngày cần xoá là các ngày từ index keep_days trở đi
    dates_to_delete = dates[keep_days:]
    
    with recordings_lock:
        # Load lại để đảm bảo an toàn luồng
        current_recs = get_recordings()
        deleted_count = 0
        
        for d_str in dates_to_delete:
            if d_str in current_recs:
                print(f"  -> Đang xoá dữ liệu live ngày: {d_str}")
                # Xoá file vật lý
                for item in current_recs[d_str]:
                    f_path = item.get('file')
                    if f_path and os.path.exists(f_path):
                        try:
                            os.remove(f_path)
                        except Exception as e:
                            print(f"     ! Lỗi xoá file {f_path}: {e}")
                
                # Xoá khỏi dict
                del current_recs[d_str]
                deleted_count += 1
        
        if deleted_count > 0:
            save_recordings(current_recs)
            print(f"--- Hoàn tất dọn dẹp: Đã xoá {deleted_count} ngày cũ. ---")
        else:
            print("--- Không có gì để xoá. ---")

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

def cleanup_replay_files(date_str, s_id=None):
    """
    Xoá các file HLS/TS trong thư mục replay sau khi đã upload YouTube thành công.
    """
    import shutil
    base_dir = os.path.join(DATA_DIR, 'replays', date_str)
    
    if s_id:
        target_dir = os.path.join(base_dir, s_id)
        if os.path.exists(target_dir):
            print(f"  -> Đang dọn dẹp thư mục replay local: {target_dir}")
            shutil.rmtree(target_dir)
            return True
    else:
        if os.path.exists(base_dir):
            print(f"  -> Đang dọn dẹp toàn bộ replay local ngày: {date_str}")
            shutil.rmtree(base_dir)
            return True
    return False

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
    """
    Orchestrates the migration of old recordings to YouTube.
    If specific_date is provided (YYYY-MM-DD), it syncs that date regardless of age.
    If specific_stream is provided, it only syncs that specific stream.
    If force is True, it syncs even if already uploaded.
    If is_test is True, it prefixes the title with [TEST] and doesn't update metadata.
    """
    from services.youtube_service import YouTubeService
    
    SECRETS_PATH = os.path.join(DATA_DIR, 'youtube_secrets.json')
    TOKEN_PATH = os.path.join(DATA_DIR, 'youtube_token.pickle')

    print(f"\n[{datetime.now()}] --- Bắt đầu tiến trình YouTube Sync ---", flush=True)
    if specific_date:
        print(f"-> Chế độ: Chạy ngày cụ thể ({specific_date})", flush=True)
    
    # Check multiple locations for token if DATA_DIR doesn't have it
    token_locations = [
        TOKEN_PATH,
        os.path.join(os.path.dirname(DATA_DIR), 'app', 'youtube_token.pickle'), # /app/youtube_token.pickle
        'youtube_token.pickle'
    ]
    
    actual_token_path = None
    for loc in token_locations:
        if os.path.exists(loc):
            actual_token_path = loc
            break
            
    if not actual_token_path:
        print(f"✗ ERROR: YouTube token không tìm thấy tại bất kỳ vị trí nào: {token_locations}", flush=True)
        return

    try:
        # Use SECRETS_PATH fallback too if needed
        actual_secrets_path = SECRETS_PATH if os.path.exists(SECRETS_PATH) else 'youtube_secrets.json'
        yt = YouTubeService(actual_secrets_path, actual_token_path)
    except Exception as e:
        print(f"✗ ERROR: Không thể khởi tạo YouTube Service: {e}", flush=True)
        import traceback
        traceback.print_exc()
        return

    if specific_date:
        eligible_dates = [specific_date]
    else:
        # Lấy tất cả các ngày đủ điều kiện
        all_eligible = get_nights_older_than(7)
        # Sắp xếp và lấy ngày cũ nhất (mỗi lần chạy 1 ngày để tránh quá quota YouTube)
        eligible_dates = sorted(all_eligible)[:1]
        
    if not eligible_dates:
        if not specific_date:
            print("✓ Không có phần ghi nào cần xử lý (không có ngày nào > 7 ngày hoặc đã sync hết).", flush=True)
        else:
            print(f"✗ Không tìm thấy dữ liệu cho ngày {specific_date} để sync.", flush=True)
        return

    print(f"-> Danh sách ngày sẽ xử lý: {eligible_dates}", flush=True)

    meta_file = os.path.join(DATA_DIR, 'metadata.json')
    meta = {}
    with meta_lock:
        if os.path.exists(meta_file):
            try:
                with open(meta_file, 'r') as f:
                    meta = json.load(f)
            except Exception:
                pass

    try:
        for date_str in sorted(eligible_dates):
            print(f"\n--- Xử lý ngày: {date_str} ---", flush=True)
            day_meta = meta.get(date_str, {})
            streams = day_meta.get('streams', {})
            
            if not streams:
                print(f"  ! Ngày {date_str} không có dữ liệu stream trong metadata.", flush=True)
                continue

            # 7. Use/Create Playlist for the day
            playlist_id = day_meta.get('youtube_playlist_id')
            print(f"  ? Playlist hiện tại cho ngày {date_str}: {playlist_id}", flush=True)
            
            if not playlist_id:
                p_title = f"AOE Replay | Ngày {date_str}"
                p_desc = f"Toàn bộ bản ghi các trận đấu AOE ngày {date_str}."
                print(f"  + ĐANG TẠO PLAYLIST MỚI: {p_title}...", flush=True)
                try:
                    playlist_id = yt.create_playlist(p_title, p_desc, privacy_status="public")
                    day_meta['youtube_playlist_id'] = playlist_id
                    day_meta['youtube_playlist_url'] = f"https://www.youtube.com/playlist?list={playlist_id}"
                    print(f"  ✓ Đã tạo Playlist: {playlist_id}", flush=True)
                except Exception as pe:
                    print(f"  ✗ LỖI TẠO PLAYLIST: {pe}", flush=True)
                    # Don't return, continue with video uploads even if playlist fails

            # 8. Loop through all streams for this date
            for s_id, s_info in streams.items():
                # Filter by specific stream if requested
                if specific_stream and s_id != specific_stream:
                    continue
                
                if s_info.get('youtube_url') and not force:
                    print(f"  - Stream {s_id} đã có link YouTube, bỏ qua.", flush=True)
                    continue
                
                # Check for HLS file
                hls_rel = s_info.get('hls')
                if not hls_rel:
                    print(f"  - Stream {s_id} không có file HLS local, bỏ qua.", flush=True)
                    continue

                print(f"  > Đang xử lý stream: {s_id} ({s_info.get('display_name', 'Unknown')})", flush=True)
                hls_abs_path = os.path.join(DATA_DIR, hls_rel)
                output_mp4 = os.path.join(DATA_DIR, 'replays', date_str, s_id, 'full_match.mp4')
                
                print(f"    - Đang ghép nối HLS sang MP4...", flush=True)
                success, err = merge_hls_to_mp4(hls_abs_path, output_mp4)
                if not success:
                    print(f"    ✗ Lỗi ghép file: {err}", flush=True)
                    continue
                
                # PRECISE TITLE: Using player name effectively
                # Force look for display_name, fallback to DB, fallback to s_id
                player_name = s_info.get('display_name')
                
                # Check DB if name is generic or missing
                if not player_name or player_name.startswith('team'):
                    db_name = get_player_name_from_db(date_str, s_id)
                    if db_name:
                        print(f"    - Tìm thấy tên người chơi từ DB: {db_name}", flush=True)
                        player_name = db_name
                        s_info['display_name'] = db_name # Persist to metadata

                if not player_name:
                    player_name = s_id
                
                # BRANDING UPDATES: Title and Description
                title_prefix = "[TEST] " if is_test else ""
                title = f"{title_prefix}BPGROUP AOE Replay - {player_name} - {date_str}"
                
                duration_str = format_duration_vietnamese(s_info.get('duration_minutes', 0))
                
                description = (
                    f"😂 Khi coder, sale, marketing cùng đánh AOE...\n\n"
                    f"Trận đấu này hội tụ đủ mọi cấp độ:\n"
                    f"- Người mới: đang học xây BE 🏠\n"
                    f"- Người trung bình: lên đời quên xin dân 🤣\n"
                    f"- Người pro: cân team, gánh kèo 🔥\n\n"
                    f"📌 Thông tin trận:\n"
                    f"- Players: {player_name}\n"
                    f"- Date: {date_str}\n"
                    f"- Duration: {duration_str}\n\n"
                    f"🎯 Đây không chỉ là game – mà là nơi lưu lại những khoảnh khắc vui vẻ của team BestPrice.\n\n"
                    f"🌐 Website công ty: https://www.bestprice.vn/  \n"
                    f"🎮 Giải đấu AOE: https://aoe.bpg.vn/\n\n"
                    f"👉 Xem để giải trí, nhưng cẩn thận… bạn có thể thấy chính mình trong đó 😎\n\n"
                    f"#AOEFunny #CompanyLife #BestPrice #GamingCulture"
                )
                
                print(f"    - Đang upload lên YouTube (Public)...", flush=True)
                try:
                    video_id = yt.upload_video(
                        file_path=output_mp4,
                        title=title,
                        description=description,
                        privacy_status="public"
                    )
                    
                    if video_id:
                        if not is_test:
                            s_info['youtube_url'] = f"https://www.youtube.com/watch?v={video_id}"
                            s_info['youtube_id'] = video_id
                            s_info['hls'] = None 
                        else:
                            print(f"    - [TEST MODE] Video uploaded: https://www.youtube.com/watch?v={video_id}", flush=True)
                        
                        # Add to playlist
                        if playlist_id:
                            print(f"    - Đang thêm vào Playlist {playlist_id}...", flush=True)
                            try:
                                yt.add_video_to_playlist(playlist_id, video_id)
                            except Exception as pae:
                                print(f"    ! Không thể thêm vào playlist: {pae}", flush=True)

                        print(f"    - Upload thành công: {video_id}. Đang xoá file local...", flush=True)
                        if os.path.exists(output_mp4):
                            os.remove(output_mp4)
                        cleanup_replay_files(date_str, s_id)
                    
                except Exception as e:
                    print(f"    ✗ Lỗi upload YouTube: {e}", flush=True)
                    if os.path.exists(output_mp4):
                        os.remove(output_mp4)
            with meta_lock:
                # Sync meta data (including playlist_id and youtube_info)
                meta[date_str] = day_meta
                save_meta(meta_file, meta)
        
        print(f"\n--- Hoàn tất tiến trình YouTube Sync cho ngày {date_str} ---", flush=True)
    except Exception as e:
        print(f"✗ CRITICAL ERROR trong quá trình Sync: {e}", flush=True)
        import traceback
        traceback.print_exc()
