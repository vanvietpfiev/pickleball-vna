# Pickleball VNA – Hướng dẫn cài đặt

## Tổng quan kiến trúc

```
Trình duyệt  →  Next.js (Vercel)  →  Apps Script Web App  →  Google Sheet
```

Không cần Service Account hay Google Cloud Console — chỉ cần Google Sheet và Apps Script.

---

## Bước 1: Tạo Google Sheet từ template

1. Upload file `Pickleball_VNA_Template.xlsx` lên Google Drive
2. Chuột phải → **Open with → Google Sheets**
3. Đổi tên thành **Pickleball VNA** (tùy chọn)
4. Kiểm tra có đủ 4 sheet tabs: `Players`, `Matches`, `Sessions`, `Tournaments`

---

## Bước 2: Cài Apps Script

1. Trong Google Sheet: **Extensions → Apps Script**
2. Xóa toàn bộ code mẫu trong editor
3. Dán toàn bộ nội dung file `google-apps-script/Code.gs` vào
4. Nhấn **Save** (Ctrl+S), đặt tên project: **Pickleball VNA**

---

## Bước 3: Deploy Apps Script thành Web App

1. Nhấn nút **Deploy** (góc trên phải) → **New deployment**
2. Nhấn biểu tượng ⚙️ cạnh "Select type" → chọn **Web app**
3. Điền thông tin:
   - **Description**: `Pickleball VNA API v1`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. Nhấn **Deploy** → cấp quyền khi được yêu cầu (Allow)
5. **Copy Web App URL** — dạng:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   https://script.google.com/macros/s/AKfycbxo-iJF6jPJEcmbboK7D5xipJrgs2gcIBk5mOlwrsE3q8VSZHlS3STKeL1VpeL0fC6d/exec
   ```

> **Lưu ý quan trọng**: Mỗi lần sửa code Apps Script, phải deploy lại (New deployment hoặc Manage deployments > Edit) thì web app mới nhận code mới.

---

## Bước 4: Cấu hình môi trường web app

1. Tạo file `.env.local` trong thư mục project:
   ```
   cp .env.local.example .env.local
   ```
2. Mở `.env.local` và dán URL từ bước 3:
   ```
   APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_ID/exec
   ```

---

## Bước 5: Chạy local

```bash
npm install
npm run dev
```

Mở: **http://localhost:3000**

---

## Bước 6: Deploy lên Vercel (miễn phí)

1. Push code lên GitHub repository
2. Vào [vercel.com](https://vercel.com) → **Add New Project** → Import repo
3. Thêm Environment Variable:
   - Key: `APPS_SCRIPT_URL`
   - Value: URL từ bước 3
4. **Deploy** → nhận URL public (VD: `pickleball-vna.vercel.app`)

---

## Luồng hoạt động

| Hành động | Web App | Apps Script | Google Sheet |
|---|---|---|---|
| Xem bảng xếp hạng | GET /api/players | getPlayers | Đọc Players |
| Nhập kết quả | POST /api/matches | addMatch | Ghi Matches + **tự cập nhật ELO** Players |
| Chia đội | POST /api/session | getPlayers (lấy ELO) | Đọc Players |
| Tạo giải đấu | POST /api/tournament | addTournament | Ghi Tournaments |

## Tính điểm ELO

- ELO ban đầu: **1200** cho tất cả thành viên
- K-factor: **32** (mỗi trận tối đa ±32 điểm)
- Đánh đôi: tính ELO trung bình của từng đội để xác định mức thay đổi
- Thắng đối thủ mạnh hơn → ELO tăng nhiều hơn, và ngược lại

## Tính lại ELO thủ công

Nếu cần tính lại ELO từ đầu (ví dụ sửa kết quả cũ):
- Mở Google Sheet → Menu **🏓 Pickleball VNA** → **Tính lại ELO toàn bộ**
