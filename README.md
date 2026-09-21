# Sauna P8 – Thế giới avatar tự do

Game web multiplayer realtime phong cách social avatar.

## Tính năng

- Multiplayer realtime (Socket.IO)
- Toàn bộ giao diện tiếng Việt
- Avatar tùy chỉnh
- Nhiều phòng: Sảnh, Xông hơi, Jacuzzi, Phòng tối, Lounge, Thay đồ, Phòng tắm, Khu đấu
- Chat + speech bubble
- Emote + tương tác (ôm, hôn, ngủ cùng, vỗ về...)
- Hệ thống đánh nhau nhẹ (social combat)
- Phòng riêng tư 2 người
- Khi vào phòng tắm / xông hơi → mặc khăn tắm
- Hiển thị số người trong phòng, cảnh báo khi đông
- Joystick mobile + WASD PC
- Không giới hạn số người cứng

## Chạy local

```bash
npm install
npm start
```

Mở http://localhost:3000

## Deploy Render

1. Push lên GitHub
2. Render.com → New Web Service → chọn repo
3. Tự dùng render.yaml
4. Deploy → mở URL

## Điều khiển

- Mobile: Joystick + nút 💕 😊 💬 ⚔️
- PC: WASD / mũi tên, Enter chat, E ngồi, F đánh
- Chạm vào người chơi để chọn mục tiêu (đánh / tương tác)
- Nút 🔒 tạo / vào phòng riêng
