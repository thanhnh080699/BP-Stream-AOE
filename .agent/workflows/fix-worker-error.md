---
description: Sửa lỗi video và đồng bộ hệ thống streaming
---

Quy trình để sửa lỗi xử lý video trên worker và cập nhật hệ thống:

1. Chỉnh sửa logic trong `worker/main.py` (Ví dụ: thay đổi cờ FFmpeg hoặc transcoding logic).
2. Xây dựng lại container worker để áp dụng code mới:
// turbo
`docker compose up -d --build worker`
3. Kiểm tra log của worker để đảm bảo không còn lỗi:
`docker compose logs -f worker`
4. (Tùy chọn) Trigger merge thủ công cho ngày bị lỗi:
`curl -X POST http://localhost:5000/api/v1/merge/[YYYY-MM-DD]`
5. Lưu lại thay đổi vào Git:
`git add . && git commit -m "Fix video processing errors" && git push`
