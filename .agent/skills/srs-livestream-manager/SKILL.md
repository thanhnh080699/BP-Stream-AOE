---
name: srs-livestream-manager
description: Manage and maintain the SRS-based AOE Livestream system for BestPrice. Use this skill when requested to modify stream configurations (srs.conf), update the video processing worker, adjust the React-based dashboard dashboard, or troubleshoot recording and playback issues.
---

# SRS Livestream Manager

A specialized skill for managing the AOE Streaming stack at BestPrice.

## System Architecture

The system is a multi-container Docker environment:
1. **SRS Media Server**: Core engine. Custom config must be enforced via `command: ["./objs/srs", "-c", "conf/srs.conf"]`.
2. **Python Worker**: Handles `on_dvr` hooks, concatenates segments using `ffmpeg`, and manages `metadata.json`.
3. **React Dashboard**: Frontend serving Live (8 streams) and Archive (daily per-PC videos).
4. **Shared Volume**: `srs_data` mounted at `/data` across all services for persistent JSON and video storage.

## Critical Technical Requirements

### 1. SRS Configuration & DVR
- **Config Path**: Custom configs must be mounted to `/usr/local/srs/conf/srs.conf`.
- **DVR Plan**: Use `dvr_plan segment;` with `dvr_duration 60;` and `dvr_wait_keyframe off;` to ensure segments are closed frequently and available for merging quickly.
- **Paths**: SRS `dvr_path` and `hls_path` should use absolute paths like `/usr/local/srs/objs/nginx/html/dvr/...` to match volume mounts.

### 2. HTTP Hooks Protocol
- **Success Response**: SRS hooks (e.g., `on_dvr`) **MUST** return a string `"0"` or integer `0` with HTTP 200. Any other response (like "OK" or HTML 404) will cause SRS to disconnect the client with error `4005`.
- **Debug Hook**: Use `/api/v1/debug` to log raw SRS payloads during troubleshooting.

### 3. Worker Operations
- **Rebuilding**: Changes to `worker/main.py` require a container rebuild: `docker compose up -d --build worker`.
- **FFmpeg Merging**: Uses `ffmpeg -f concat` on `.flv` segments to create a single `.mp4` daily summary, then creates HLS segments from that MP4 with audio transcoding (`-c:a aac`) to prevent frame size errors.

### 4. Frontend Playback
- **Mixed Formats**: `VideoPlayer.jsx` must support HLS (`.m3u8`) for live feeds and direct MP4 playback for archives.
- **Dynamic URLs**: Live streams use `/live/[stream_id].m3u8` or `/__defaultApp__/[stream_id].m3u8`. Archives use `/replays/[filename].mp4`.

## Operations
- **Full Refresh**: `docker compose down && docker compose up -d --build`.
- **View Recording Log**: `docker compose exec worker cat /data/recordings.json`.
- **Manual Merge**: Trigger via `POST /api/v1/merge/[YYYY-MM-DD]`.
- **Troubleshooting**: Check logs with `docker compose logs -f worker`.

## Directory Structure
- `/srs.conf`: Server logic.
- `/docker-compose.yml`: Infrastructure.
- `/worker/main.py`: Backend & Video merging.
- `/web/src/components/`: Dashboard views (LiveView, PlaybackView, VideoPlayer).
- `/data/`: (Volume) Persistent storage for metadata and video files.
