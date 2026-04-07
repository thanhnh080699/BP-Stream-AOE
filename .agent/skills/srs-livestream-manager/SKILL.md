---
name: srs-livestream-manager
description: Manage and maintain the SRS-based AOE Livestream system for BestPrice. Use this skill when requested to modify stream configurations (srs.conf), update the video processing worker, adjust the React-based dashboard dashboard, or troubleshoot recording and playback issues.
---

# SRS Livestream Manager

A specialized skill for managing the AOE Streaming stack at BestPrice.

## System Architecture

The system is a multi-container Docker environment:
1. **SRS Media Server**: Core engine. Custom config must be enforced via `command: ["./objs/srs", "-c", "conf/srs.conf"]`.
2. **MariaDB Persistence**: Centralized database for match scores, players, and historical statistics. Uses a normalized schema (matches, match_participants, players).
3. **Python Worker**: Handles `on_dvr` hooks, concatenates segments using `ffmpeg`, and manages **Database Syncing**. It also provides the `/api/v1/stats` endpoint.
4. **React Dashboard**: Frontend serving Live (8 streams), Archive (daily per-PC videos), and **Analytics Dashboard**.
5. **Shared Volume**: `srs_data` mounted at `/data` across all services for persistent video storage.

## Critical Technical Requirements

### 1. Database & Statistics
- **Normalized Schema**: Always track statistics at the player level. A single "Match" consists of multiple "Participants" and scores.
- **Game-Based Counting**: When calculating volumne or distribution, always sum the individual scores (e.g., 4-3 = 7 games) to reflect actual gameplay intensity.
- **Winrate Calculation**: Calculate based on individual wins/losses within each match, NOT just overall win/loss of the series.

### 2. SRS Configuration & DVR
- **Config Path**: Custom configs must be mounted to `/usr/local/srs/conf/srs.conf`.
- **DVR Plan**: Use `dvr_plan segment;` with `dvr_duration 60;` and `dvr_wait_keyframe on;` to ensure segments are closed cleanly.

### 3. Worker Operations
- **Database Init**: On startup, the worker ensures tables exist and migrates legacy JSON data if a fresh DB is detected.
- **FFmpeg Merging**: Uses `ffmpeg -f concat` on `.flv` segments to create a single `.mp4` daily summary.
- **Stats API**: Use `GET /api/v1/stats` for individual player performance and chronological activity.

### 4. Frontend & Analytics
- **Analytics Dashboard**: Uses SVG-based visualizations. Includes a Heatmap/Bar chart for frequency and a Donut chart for category distribution.
- **Dynamic Categories**: Support asymmetrical matches (e.g., 3-4, 1-2). Categories are named dynamically based on team sizes.
- **Professional Styling**: Maintain high-contrast, premium dark-mode visuals using `var(--accent-secondary)` and `f1812e` orange themes.

## Operations
- **Remote Execution**: All docker commands MUST be executed on the production server via SSH.
- **Full Refresh**: `ssh 192.168.9.233 "cd /home/ubuntu/streaming && sudo docker compose down && sudo docker compose up -d --build"`.
- **Database Backup**: Periodic exports of MariaDB are recommended. `mysql_data` should be excluded from Git via `.gitignore`.
- **Debugging**: Check logs with `ssh 192.168.9.233 "sudo docker compose logs -f srs-worker"`.

## Directory Structure
- `/srs.conf`: Server logic.
- `/docker-compose.yml`: Infrastructure (DB, SRS, Worker, Dashboard).
- `/worker/main.py`: Backend, DB logic & Video merging.
- `/web/src/components/AnalyticsView.jsx`: High-level statistics dashboard.
- `/data/`: (Volume) Video storage.
- `/mysql_data/`: (Volume) Persistent database storage (ignored by git).

## Development Workflow
- **Atomic Commits**: Every time you modify or add a new feature, component, or configuration, you **MUST** immediately commit and push the changes.
- **Workflow**: `git add .` -> `git commit -m "Brief description"` -> `git push origin master`.
- **Consistency**: Never leave the workspace with uncommitted changes after completing a task.

## Server Details (Production)
- **IP**: 192.168.9.233
- **User**: ubuntu
- **Password**: Bpt@052010 (Save for SSH use)
- **Deployment Path**: `/home/ubuntu/streaming`

