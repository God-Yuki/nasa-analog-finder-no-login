'use strict';
// server.js - máy chủ Node.js (Express): phục vụ file web trong /public và API dưới /api
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const session = require('express-session');
const { pool } = require('./config'); // đồng thời nạp .env
const MySqlStore = require('./session-store');
const { migrate } = require('./migrate');

const app = express();
const PORT = Number(process.env.PORT) || 8000;   // Railway tự cấp PORT
const HOST = process.env.HOST || '0.0.0.0';
const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;

app.disable('x-powered-by');
app.set('trust proxy', 1); // chạy sau proxy HTTPS của Railway (để cookie secure + req.ip đúng)

// Health check cho Railway - không đụng tới database
app.get('/health', (req, res) => res.json({ ok: true }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ---- CORS: chỉ cho phép trang chạy trên localhost / 127.0.0.1 (vd. Live Server :5500) gọi API ----
const ORIGIN_RE = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (ORIGIN_RE.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---- Phiên đăng nhập (lưu trong MySQL; "Keep me signed in" kéo dài 30 ngày trong routes/auth.js) ----
if (!process.env.SESSION_SECRET) {
  console.warn('[!] Chưa đặt SESSION_SECRET - dùng khóa ngẫu nhiên, mọi người sẽ bị đăng xuất mỗi lần server restart.');
}
app.use(session({
  name: 'nasa_sid',
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  store: new MySqlStore(pool),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: IS_PROD ? 'auto' : false },
}));

// Ảnh gửi dạng base64 (tối đa ~3 triệu ký tự) nên cần nới giới hạn body
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/sites', require('./routes/sites'));
app.use('/api/data', require('./routes/data'));
app.use('/api/contribute', require('./routes/contribute'));
app.use('/api/compare', require('./routes/compare'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// ---- File web tĩnh ----
app.use(express.static(path.join(__dirname, 'public')));

// Mọi lỗi chưa bắt (vd. JSON sai cú pháp) đều trả về JSON
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status === 400 ? 'Invalid request body.' : 'Server error.' });
});

// Mở cổng ngay (để health check qua), rồi tạo bảng nếu chưa có
const server = app.listen(PORT, HOST, () => {
  console.log(`Server chạy tại http://127.0.0.1:${PORT}/  (mở login.html)`);
  migrate().then((ok) => {
    if (!ok) console.error('[db] Không tạo được bảng - kiểm tra MYSQL_URL / DB_* rồi deploy lại.');
  });
});

// Tắt êm khi Railway dừng container
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(() => pool.end().finally(() => process.exit(0))));
}
