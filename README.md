# Terrestrial Analog Finder

NASA Space Apps Challenge - chấm điểm các địa điểm trên Trái Đất giống điều kiện Mặt Trăng / Sao Hỏa.
Node.js (Express) + MySQL, web tĩnh nằm trong `public/`.

```
server.js           máy chủ Express (API + phục vụ web)
config.js           kết nối MySQL + hàm dùng chung
migrate.js          tự tạo bảng từ database/schema.sql khi khởi động
session-store.js    lưu phiên đăng nhập trong MySQL
routes/             auth, sites, data, contribute, compare
database/schema.sql cấu trúc database (không có dữ liệu)
public/             login.html, web_test.html, contribute.html, compare.html, ...
railway.json        cấu hình deploy Railway
```

## 1. Chạy thử trên máy (tùy chọn)

```bash
npm install
cp .env.example .env      # điền DB_* hoặc MYSQL_URL, SESSION_SECRET
npm start                 # mở http://127.0.0.1:8000/login.html
```
Cần MySQL 8 (bảng dùng collation `utf8mb4_0900_ai_ci`). Server tự tạo bảng lần chạy đầu.

## 2. Đưa lên GitHub

```bash
git init
git add .
git commit -m "Terrestrial Analog Finder"
git branch -M main
git remote add origin https://github.com/<tai-khoan>/<ten-repo>.git
git push -u origin main
```
`.gitignore` đã loại `node_modules`, `.env` và mọi file `*.sql` dump (chứa email + hash mật khẩu thật).
Nên chạy `npm install` một lần ở máy để sinh `package-lock.json` rồi commit kèm.

## 3. Deploy lên Railway

1. Railway → **New Project** → **Deploy from GitHub repo** → chọn repo vừa push.
2. Trong project: **+ New** → **Database** → **Add MySQL**.
3. Mở service web (repo của bạn) → tab **Variables** → thêm:
   | Biến | Giá trị |
   |---|---|
   | `MYSQL_URL` | `${{MySQL.MYSQL_URL}}` (đổi `MySQL` nếu service database của bạn tên khác) |
   | `SESSION_SECRET` | một chuỗi dài, ngẫu nhiên (vd. `openssl rand -hex 32`) |
4. Tab **Settings** → **Networking** → **Generate Domain**. Railway cấp URL dạng `https://<ten>.up.railway.app`.
5. Mở `https://<ten>.up.railway.app/` -> tự chuyển tới trang đăng nhập. Bảng được tạo tự động ở lần khởi động đầu (xem log: `[db] Schema OK`).

Kiểm tra nhanh: `https://<ten>.up.railway.app/health` phải trả về `{"ok":true}`.

## 4. Nhập dữ liệu cũ (tùy chọn)

Nếu muốn giữ tài khoản và địa điểm trong `nasa_railway.sql`: ở service MySQL trên Railway mở **Connect** để lấy thông tin *Public Network*, rồi

```bash
mysql -h <host> -P <port> -u root -p railway < nasa_railway.sql
```
(hoặc dùng HeidiSQL với cùng thông tin). Tài khoản cũ đăng nhập được với mật khẩu cũ.

## Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `MYSQL_URL` / `DATABASE_URL` | chuỗi kết nối MySQL (ưu tiên số 1) |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASS` `DB_NAME` | thay thế khi không có URL (cũng đọc được `MYSQLHOST`, ...) |
| `DB_SSL` | `true` nếu MySQL yêu cầu SSL |
| `SESSION_SECRET` | khóa ký cookie phiên (bắt buộc đặt khi deploy) |
| `PORT` | Railway tự cấp |
| `DEBUG_ERRORS` | `true` để API trả chi tiết lỗi (chỉ khi debug) |
