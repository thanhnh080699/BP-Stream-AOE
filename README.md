# 📽️ BPGROUP AOE STREAMING Dashboard

Hệ thống dashboard này được thiết kế để hiển thị luồng trực tiếp (Live HLS) và các video đã ghi (DVR Recordings) từ SRS server của bạn.

## 🚀 Cách khởi chạy local

1. Cài đặt dependencies (nếu chưa làm):
   ```bash
   npm install
   ```
2. Chạy môi trường phát triển:
   ```bash
   npm run dev
   ```
3. Mở trình duyệt theo địa chỉ hiển thị trong terminal (thường là `http://localhost:5173`).

---

## ⚙️ Cấu hình SRS Server

Hệ thống hiện tại đang sử dụng IP server của bạn: `http://192.168.9.214:8080`.

### 1. Luồng Trực Tiếp (Live Stream)
Sơ đồ URL mặc định cho 8 máy (thay `{id}` bằng `team1-1` đến `team2-4`):
- `http://192.168.9.214:8080/live/{id}.m3u8`

### 2. Xem Lại (Recordings)
Để danh sách video cũ hoạt động chính xác, bạn cần cấu hình SRS để lưu file DVR theo định dạng ngày tháng.
Trong file `srs.conf`, phần `dvr` nên có dạng:

```conf
dvr {
    enabled             on;
    dvr_path            ./objs/nginx/html/record/[app]/[stream]/[2006]/[01]/[02]/[15]-[04]-[05].m3u8;
    dvr_plan            segment;
}
```

**Lưu ý về Mock Data:** 
- Hiện tại trong `src/App.jsx`, hàm `getMockRecordings` đang giả lập danh sách file. 
- Bạn có thể viết một API backend đơn giản (Node.js/Python) để quét thư mục `/home/playback/record` và trả về JSON cho frontend, hoặc sử dụng tính năng `auto index` của Nginx nếu bạn chạy Nginx phía trước SRS.

---

## 🎨 Thiết kế & Thương hiệu
- **Giao diện**: Sử dụng phong cách Glassmorphism (hiệu ứng kính mờ) trên nền màu tối sang trọng.
- **Màu sắc**: Kết hợp màu Vàng AOE (Gold/Amber) và màu Xanh/Đỏ đại diện cho 2 đội.
- **Thương hiệu**: Đã thêm logo và thông tin giải đấu của **Bestprice** và **BPGROUP**.

---

## 🛠️ Các thư viện chính sử dụng
1. **React**: Framework giao diện.
2. **VideoJS**: Thư viện trình phát video mạnh mẽ, hỗ trợ HLS ổn định.
3. **Lucide React**: Bộ icon hiện đại, tối giản.
4. **Framer Motion**: Thư viện hiệu ứng chuyển động mượt mà cho Dashboard.
5. **@fontsource**: Google Fonts (Inter & Outfit) cho typography cao cấp.
