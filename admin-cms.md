# CMS vận hành

- [x] Phiên quản trị MariaDB, CSRF, API và nhật ký.
- [x] Kiểm kê nền, dọn dữ liệu có xem trước và khóa tác vụ.
- [x] Tác vụ bền vững, heartbeat, kiểm tra dung lượng và phục hồi sau restart.
- [x] OAuth YouTube web, kiểm tra kênh, giữ replay khi lỗi và scheduler.
- [x] Giao diện /admin tiếng Việt, tương thích desktop/mobile.
- [x] Kiểm thử, tài liệu cấu hình, backup và triển khai live.

Live: https://aoe.bpg.vn/admin. Đã backup và giữ image rollback. 36 test backend đạt trên Python 3.12/MariaDB, FFmpeg smoke test đạt, build và lint CMS đạt, npm audit 0. OAuth Web client cần chủ tài khoản Google bổ sung credentials; desktop client hiện có không dùng cho callback web. 629 file FLV ngày 12/10 giữ nguyên; đã dọn ~21 GiB file TS tạm. Lint frontend toàn repo còn 12 lỗi và 4 cảnh báo ở phần cũ.

Credentials/token đã tách sang /stream/admin-private, mount chỉ worker; chặn truy cập trực tiếp qua media URL. Dọn cache build trả lại ~1.865 GB ổ hệ thống.

OAuth PKCE verifier lưu cùng phiên và được tiêu thụ một lần qua callback; đã kiểm thử challenge và callback.
