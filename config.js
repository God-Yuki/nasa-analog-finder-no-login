'use strict';
// config.js - cấu hình MySQL (database `railway`) + các hàm dùng chung (thay cho config.php)
require('dotenv').config();
const mysql = require('mysql2/promise');

// ---- Kết nối MySQL: database duy nhất `railway` (xem nasa_railway.sql) ----
// Ưu tiên MYSQL_URL / DATABASE_URL (Railway tự cấp), sau đó tới DB_* hoặc MYSQL* trong .env
function dbConfig() {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (url) {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port) || 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'railway',
    };
  }
  const env = process.env;
  return {
    host: env.DB_HOST || env.MYSQLHOST || '127.0.0.1',
    port: Number(env.DB_PORT || env.MYSQLPORT) || 3306,
    user: env.DB_USER || env.MYSQLUSER || 'root',
    password: env.DB_PASS ?? env.MYSQLPASSWORD ?? '',
    database: env.DB_NAME || env.MYSQLDATABASE || 'railway',
  };
}

// Bảng địa điểm theo target của web -> tên bảng trong database `railway`
const SITE_TABLE = {
  Moon: 'moon_base_sites',
  Mars: 'mars_outpost_sites',
};
// Giá trị enum cột `base` (contributions, site_values, tif_scores) theo target
const BASE = {
  Moon: 'moon base',
  Mars: 'mars outpost',
};
const BASE_TO_TARGET = Object.fromEntries(Object.entries(BASE).map(([t, b]) => [b, t]));

// Dùng chung cho sites và contribute
const TERRAINS = ['Impact Crater', 'Volcanic & Basaltic', 'Lava Tube & Cave',
  'Hyperarid Desert', 'Polar & Permafrost', 'Hydrothermal & Saline'];

const pool = mysql.createPool({
  ...dbConfig(),
  charset: 'utf8mb4',
  timezone: 'Z', // đọc/ghi TIMESTAMP theo UTC để dấu thời gian không lệch theo múi giờ máy
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
});
pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));

// Bọc tên bảng / cột bằng dấu backtick
const q = (name) => '`' + String(name).replace(/`/g, '``') + '`';

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
// Tương đương out(['error'=>...], code) của PHP: ném lỗi để dừng xử lý ngay
const fail = (status, message) => { throw new ApiError(status, message); };

// Bọc handler async: bắt ApiError và lỗi MySQL, luôn trả về JSON
const handler = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof ApiError) return res.status(e.status).json({ error: e.message });
    console.error(e);
    const debug = process.env.DEBUG_ERRORS === 'true'; // chi tiết lỗi chỉ hiện khi đang debug
    if (e && (e.sqlMessage || e.errno)) {
      return res.status(500).json({ error: 'Database error' + (debug ? ': ' + (e.sqlMessage || e.message) : '.') });
    }
    res.status(500).json({ error: 'Server error' + (debug ? ': ' + (e && e.message) : '.') });
  }
};

function requireLogin(req) {
  if (!req.session || !req.session.uid) fail(401, 'Chưa đăng nhập');
  return Number(req.session.uid);
}

const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});

// Tương đương is_numeric của PHP (đủ dùng cho dữ liệu form/JSON)
function isNumeric(v) {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return v.trim() !== '' && Number.isFinite(Number(v));
  return false;
}
// Số hoặc null (chuỗi rỗng / không phải số -> null)
const num = (v) => (v === null || v === undefined || v === '' || !isNumeric(v) ? null : Number(v));
// trim an toàn cho mọi kiểu dữ liệu
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
// (int) của PHP
const toInt = (v) => Number.parseInt(v, 10) || 0;
// !empty() của PHP
const truthy = (v) => !(v === undefined || v === null || v === false || v === 0 || v === '' || v === '0');

// Port của offline() trong web_test.html (dùng khi web không gửi kèm điểm)
function scoreSite(target, terrain, features, hum, pop) {
  const t = (features + ' ' + terrain).toLowerCase();
  const has = (...w) => w.some((x) => t.includes(x));
  let s = 66;
  if (target === 'Moon') {
    if (has('crater', 'impact', 'breccia')) s += 14;
    if (has('lava tube', 'cave')) s += 16;
    if (has('basalt', 'regolith')) s += 12;
  } else {
    if (has('hyperarid', 'desert', 'uv')) s += 14;
    if (has('permafrost', 'ice', 'brine')) s += 13;
    if (has('perchlorate', 'oxide', 'iron')) s += 12;
  }
  if (hum !== null) {
    if (hum <= 20) s += 8; else if (hum <= 45) s += 3; else if (hum > 65) s -= 8;
  }
  if (pop !== null) {
    if (pop <= 1) s += 8; else if (pop <= 15) s += 4; else if (pop > 100) s -= 10;
  }
  return Math.max(45, Math.min(96, s));
}

module.exports = {
  pool, q, ApiError, fail, handler, requireLogin, body,
  num, str, toInt, truthy, isNumeric, scoreSite,
  SITE_TABLE, BASE, BASE_TO_TARGET, TERRAINS,
};
