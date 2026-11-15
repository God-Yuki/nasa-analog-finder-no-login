'use strict';
// routes/auth.js - đăng ký / đăng nhập / đăng xuất / kiểm tra phiên (thay cho auth.php)
// Gọi: /api/auth?action=register|login|logout|me
const express = require('express');
const bcrypt = require('bcryptjs');
const { pool, q, fail, handler, body, str, truthy } = require('../config');

const router = express.Router();
const U = q('users');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Giới hạn đơn giản: tối đa 30 lần đăng nhập/đăng ký mỗi 15 phút cho mỗi IP
const attempts = new Map();
function rateLimit(req) {
  const now = Date.now();
  const rec = attempts.get(req.ip);
  if (!rec || rec.reset < now) { attempts.set(req.ip, { n: 1, reset: now + 15 * 60 * 1000 }); return; }
  if (++rec.n > 30) fail(429, 'Too many attempts. Try again in a few minutes.');
}
setInterval(() => { const t = Date.now(); for (const [k, v] of attempts) if (v.reset < t) attempts.delete(k); }, 600000).unref();

const regenerate = (req) => new Promise((ok, no) => req.session.regenerate((e) => (e ? no(e) : ok())));
const save = (req) => new Promise((ok, no) => req.session.save((e) => (e ? no(e) : ok())));

// Đăng nhập xong: tạo phiên mới (chống session fixation), "Keep me signed in" = cookie sống 30 ngày
async function startSession(req, user, remember) {
  await regenerate(req);
  req.session.uid = Number(user.id);
  req.session.name = user.name;
  req.session.email = user.email;
  if (remember) req.session.cookie.maxAge = 30 * 86400 * 1000;
  await save(req);
}

router.all('/', handler(async (req, res) => {
  const action = req.query.action || '';

  if (action === 'me') {
    if (!req.session.uid) return res.json({ loggedIn: false });
    return res.json({ loggedIn: true, id: Number(req.session.uid), name: req.session.name, email: req.session.email });
  }

  if (action === 'logout') {
    await new Promise((ok) => (req.session ? req.session.destroy(() => ok()) : ok()));
    res.clearCookie('nasa_sid');
    return res.json({ ok: true });
  }

  if (req.method !== 'POST') fail(405, 'Use POST.');
  rateLimit(req);
  const b = body(req);

  if (action === 'register') {
    const name = str(b.name);
    const email = str(b.email).toLowerCase();
    const pass = String(b.password ?? '');
    if (name === '') fail(422, 'Enter your name.');
    if (!EMAIL_RE.test(email)) fail(422, 'Enter a valid email address.');
    if (pass.length < 8) fail(422, 'Use at least 8 characters for your password.');

    const [exist] = await pool.execute(`SELECT id FROM ${U} WHERE email = ?`, [email]);
    if (exist.length) fail(409, 'An account with this email already exists. Sign in instead.');

    const hash = await bcrypt.hash(pass, 10);
    const [r] = await pool.execute(`INSERT INTO ${U} (name, email, password_hash) VALUES (?,?,?)`, [name, email, hash]);
    await startSession(req, { id: r.insertId, name, email }, truthy(b.remember));
    return res.json({ ok: true, name, email });
  }

  if (action === 'login') {
    const email = str(b.email).toLowerCase();
    const pass = String(b.password ?? '');
    const [rows] = await pool.execute(`SELECT id, name, email, password_hash FROM ${U} WHERE email = ?`, [email]);
    const row = rows[0];
    // Hash do PHP tạo ra có tiền tố $2y$ - tương đương $2a$ nên đổi lại để bcryptjs đọc được
    const ok = row && await bcrypt.compare(pass, String(row.password_hash).replace(/^\$2y\$/, '$2a$'));
    if (!ok) fail(401, 'Email or password is incorrect.');

    await startSession(req, row, truthy(b.remember));
    return res.json({ ok: true, name: row.name, email: row.email });
  }

  fail(400, 'Invalid action.');
}));

module.exports = router;
