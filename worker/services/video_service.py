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
    Returns a list of date strings in metadata.json that are older than `days`.
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

    for date_str in meta.keys():
        try:
            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
            if date_obj < cutoff_date:
                eligible_dates.append(date_str)
        except ValueError:
            continue
    
    return eligible_dates

def do_youtube_sync(specific_date=None):
    """
    Orchestrates the migration of old recordings to YouTube.
    If specific_date is provided (YYYY-MM-DD), it syncs that date regardless of age.
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
        all_eligible = get_nights_older_than(7)
        # Sort and take only the oldest one (1 day at a time to manage quota)
        eligible_dates = sorted(all_eligible)[:1]
        
    if not eligible_dates:
        print("✓ Không có phần ghi nào cần xử lý (không có ngày nào > 7 ngày).", flush=True)
        return

    print(f"-> Ngày được chọn để xử lý: {eligible_dates}", flush=True)

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
            if not playlist_id:
                p_title = f"AOE Replay | Ngày {date_str}"
                p_desc = f"Toàn bộ bản ghi các trận đấu AOE ngày {date_str}."
                print(f"  + Đang tạo Playlist mới: {p_title}...", flush=True)
                try:
                    playlist_id = yt.create_playlist(p_title, p_desc, privacy_status="public")
                    day_meta['youtube_playlist_id'] = playlist_id
                    day_meta['youtube_playlist_url'] = f"https://www.youtube.com/playlist?list={playlist_id}"
                except Exception as pe:
                    print(f"  ✗ Lỗi tạo Playlist: {pe}", flush=True)

            for s_id, s_info in streams.items():
                if s_info.get('youtube_url'):
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
                player_name = s_info.get('display_name', s_id)
                title = f"AOE Replay | {player_name} | Ngày {date_str}"
                
                description = (
                    f"Bản ghi trận đấu AOE\n"
                    f"Người chơi/Máy: {player_name}\n"
                    f"Ngày thi đấu: {date_str}\n"
                    f"Thời lượng: {s_info.get('duration_minutes')} phút\n\n"
                    f"Tự động upload bởi AOE Livestream System."
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
                        s_info['youtube_url'] = f"https://www.youtube.com/watch?v={video_id}"
                        s_info['youtube_id'] = video_id
                        s_info['hls'] = None 
                        
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
                    continue

        with meta_lock:
            update_meta_field(meta_file, datetime.now().strftime('%Y-%m-%d'), meta=meta)
        
        print(f"\n--- Hoàn tất tiến trình YouTube Sync ---", flush=True)
    except Exception as e:
        print(f"✗ CRITICAL ERROR trong quá trình Sync: {e}", flush=True)
        import traceback
        traceback.print_exc()
