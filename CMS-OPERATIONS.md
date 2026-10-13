# CMS vận hành BP AOE

## Cấu hình production

- `ADMIN_PUBLIC_URL=https://aoe.bpg.vn` (thay bằng domain thực tế nếu cần).
- `ADMIN_PRIVATE_DIR=/private`, mount `/stream/admin-private` chỉ vào worker. Thư mục này phải nằm ngoài `DATA_DIR`, quyền `700`; tạo trước khi chạy compose.
- `ADMIN_COOKIE_SECURE=true`; chỉ dùng `false` khi phát triển tại localhost HTTP.
- Dùng `ADMIN_PASSWORD` hiện tại để đăng nhập `/admin`. Phiên lưu trong MariaDB, hết hạn sau 8 giờ.
- Backend tự tạo bảng `admin_sessions`, `admin_jobs`, `admin_settings`, `admin_audit`, `admin_previews`. Bảng nghiệp vụ hiện tại giữ nguyên.
- Chạy một worker application process. Khóa MariaDB `bp_admin_video` ngăn chạy chồng tổng hợp, upload và dọn dữ liệu; không scale worker trước khi bổ sung quy trình recovery đa instance.
- Worker dùng Python 3.12 và múi giờ `Asia/Ho_Chi_Minh`. Scheduler mặc định 02:00; khi lần đầu cài đặt, không chạy bù ngay trong ngày.

## OAuth YouTube

1. Trong Google Cloud, bật YouTube Data API v3 và tạo OAuth client loại **Web application**. Cấu hình consent screen và tài khoản test nếu ứng dụng chưa publish.
2. Đăng ký chính xác `https://aoe.bpg.vn/api/v1/admin/youtube/oauth/callback` trong Authorized redirect URIs.
3. Đặt credentials JSON Web client tại `/stream/admin-private/youtube_secrets.json`, quyền `600`. File OAuth desktop hiện tại không dùng cho web flow.
4. Vào `/admin/youtube`, chọn kết nối Google, cấp quyền rồi tự quay về CMS. Token JSON chỉ nằm trong `/stream/admin-private`, quyền `600`; pickle hiện có được chuyển đổi một lần nếu chưa có JSON.
5. Nếu `signup_required`, mở YouTube từ CMS để tạo/chọn đúng kênh, sau đó kết nối lại và kiểm tra. Không thể tạo kênh qua YouTube Data API.

Khi nâng cấp, worker chuyển file credentials/token cũ khỏi thư mục media sang thư mục private. Các file trùng tên được giữ thành bản `.legacy-*`, không ghi đè. Nginx chỉ phục vụ hai nhánh media `live/` và `replays/`, chặn JSON/token ở gốc thư mục dữ liệu.

Không đưa credentials, token hoặc mật khẩu vào Git. Google OAuth cần thao tác cấp quyền của chủ tài khoản; CMS không tự đăng nhập thay người dùng.

## Dung lượng và dữ liệu

- Ngưỡng mặc định: cảnh báo 85%, nguy cấp 95%; điều chỉnh tại `/admin/settings`.
- Trước khi xử lý: trống tối thiểu `2 × dung lượng đầu vào + 5 GiB`. Kiểm tra lại khi tác vụ bắt đầu và trước mỗi upload. YouTube chạy từng video nên dự trù theo video lớn nhất được chọn, không cộng toàn bộ kho lưu trữ.
- Kiểm kê chạy nền, cache 5 phút. Tổng dung lượng filesystem lấy trực tiếp; cache hiển thị thời điểm và lỗi nếu có.
- Video gốc và replay không tự xóa theo tuổi hoặc khi upload lỗi/thành công. Dọn thủ công cần preview có hiệu lực 10 phút, gắn với phiên quản trị; thay đổi file làm preview mất hiệu lực.
- File tạm `ts_tmp`/`.tmp` của tác vụ đã kết thúc được dọn khi không còn tác vụ, không phải ngày hiện tại và đã ngừng ghi ít nhất 5 phút. Bản đầu khóa dọn toàn bộ dữ liệu hôm nay.
- API `/api/v1/delete` cũ trả `cleanup_preview_required`; thực hiện xóa qua CMS. API tổng hợp cũ vẫn hoạt động và dùng chung hàng đợi. API YouTube/đổi tên yêu cầu mật khẩu quản trị.
- Ngày của bản ghi DVR lấy từ tên file do SRS tạo, tránh lệch bucket khi SRS và worker dùng múi giờ khác nhau. Giao diện tác vụ và lịch đồng bộ dùng giờ Việt Nam.
- Sau restart, tác vụ đang chạy và metadata `processing` được đánh dấu `interrupted`; không tự chạy lại. Tác vụ đang chờ vẫn được xử lý.

## Triển khai và rollback

1. Xác nhận không có FFmpeg/upload đang chạy. Sao lưu metadata, recordings, credentials/token, database và crontab vào thư mục chỉ root đọc.
2. Tag image worker/dashboard hiện tại làm rollback; sao lưu source và compose/env. Không copy volume video.
3. Build image mới, cập nhật worker/dashboard với `--no-deps` để không restart SRS hoặc database.
4. Sau khi worker khỏe, bỏ dòng cron cũ gọi `/api/v1/youtube/sync` lúc 02:00. Scheduler mới thay thế; API cũ không còn nhận gọi không xác thực.
5. Kiểm tra `/admin`, đăng nhập HTTPS, overview, inventory, trạng thái ngày 12/10 và số lượng file gốc. Không chạy lại tổng hợp hay xóa video để kiểm thử production.
6. Nếu rollback về bản trước CMS, khôi phục vị trí credentials/token theo backup vì bản cũ chưa biết thư mục private. Không đưa credentials vào thư mục media công khai khi có thể mount file riêng vào worker.
7. Rollback: đặt image worker/dashboard về tag trước triển khai và khôi phục source/env/crontab từ backup. Chỉ khôi phục metadata/database sau khi đối soát dữ liệu mới; không ghi đè mù.

## Kiểm thử local

```sh
docker run -d --name bp-admin-test-db -e MARIADB_ROOT_PASSWORD=admin-test-password -e MARIADB_DATABASE=admin_test -p 127.0.0.1:3307:3306 mariadb:10.11
.venv/bin/python -m pip install -r worker/requirements.txt pytest
.venv/bin/python -m pytest worker/tests -q
cd web
npm run build
npx eslint src/components/AdminView.jsx src/App.jsx vite.config.js
```

Bộ test chỉ kết nối database `admin_test` trên localhost, không dùng dữ liệu live. Xóa container test sau khi hoàn thành. Frontend cũ có lỗi lint tồn tại trước CMS; kiểm tra lint toàn repo để theo dõi, kiểm tra riêng phần CMS phải đạt.
