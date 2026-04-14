# SRS AOE Stream Dashboard

Dự án livestream và xem lại AOE nội bộ BestPrice.

## Yêu cầu
- Docker & Docker Compose
- Linux Server (đề xuất)

## Cài đặt và Triển khai

1. **Clone dự án & Triển khai**:
   ```bash
   docker compose up -d --build
   ```

2. **Cấu hình Stream (OBS)**:
   - `Settings` -> `Stream`
   - `Service`: `Custom...`
   - `Server`: `rtmp://<server_ip>:1935/live`
   - `Stream Key`: `team1-1` đến `team1-4` hoặc `team2-1` đến `team2-4`
   - Không chọn `YouTube`, `Twitch` hoặc service dựng sẵn khác, vì SRS trong dự án này là RTMP server nội bộ.
   - Nếu OBS báo `Could not access the Specified Channel or stream key`, hãy kiểm tra lại:
     - Stack đã chạy chưa: `docker compose up -d --build`
     - Server IP có truy cập được từ máy OBS không
     - Đúng cổng `1935`
     - Stream key có đúng một trong 8 key hợp lệ ở trên không

3. **Truy cập Dashboard**:
   - Mở trình duyệt: `http://<server_ip>:83`

## Môi trường Phát triển (Local Development)

Dự án hỗ trợ `Makefile` để giúp bạn phát triển và kiểm thử dễ dàng mà không cần dùng Docker cho Worker/Dashboard.

1. **Cài đặt thư viện**:
   ```bash
   make install
   ```
2. **Khởi chạy Hạ tầng (DB & SRS)**:
   ```bash
   make dev-infra
   ```
3. **Chạy Backend Worker (Python Flask)**:
   ```bash
   make dev-api
   ```
4. **Chạy Frontend Dashboard (React/Vite)**:
   ```bash
   make dev-dash
   ```
5. **Dọn dẹp môi trường khi xong việc**:
   ```bash
   make clean
   ```

## Tính năng
- **Live Monitoring**: Xem đồng thời 8 màn hình của 8 người chơi.
- **Auto Replay**: Tự động lưu video sau khi kết thúc stream.
- **Daily Summary**: Tự động nối tất cả video trong ngày thành 1 video duy nhất (Worker xử lý).
- **Netflix Style**: Giao diện chọn video theo ngày mượt mà.

## Ghi chú
- Video replay được lưu tại thư mục `./srs_data` (docker volume).
- Metadata được lưu tại `metadata.json` trong volume.
