'use strict';
// session-store.js - lưu phiên đăng nhập trong bảng `sessions` của MySQL
// (MemoryStore mặc định của express-session không dùng được khi deploy: mất phiên mỗi lần restart).
const session = require('express-session');

const DEFAULT_TTL_MS = 24 * 3600 * 1000; // phiên không tích "Keep me signed in": 1 ngày phía server

class MySqlStore extends session.Store {
  constructor(pool) {
    super();
    this.pool = pool;
    const t = setInterval(() => {
      this.pool.execute('DELETE FROM sessions WHERE expires_at < ?', [Date.now()]).catch(() => {});
    }, 3600 * 1000);
    t.unref();
  }

  static expiry(sess) {
    const e = sess && sess.cookie && sess.cookie.expires;
    return e ? new Date(e).getTime() : Date.now() + DEFAULT_TTL_MS;
  }

  get(sid, cb) {
    this.pool.execute('SELECT data FROM sessions WHERE sid = ? AND expires_at > ?', [sid, Date.now()])
      .then(([rows]) => {
        let data = null;
        try { data = rows[0] ? JSON.parse(rows[0].data) : null; } catch { /* phiên hỏng -> coi như không có */ }
        cb(null, data);
      }, (e) => cb(e));
  }

  set(sid, sess, cb = () => {}) {
    this.pool.execute(
      `INSERT INTO sessions (sid, data, expires_at) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE data = VALUES(data), expires_at = VALUES(expires_at)`,
      [sid, JSON.stringify(sess), MySqlStore.expiry(sess)]
    ).then(() => cb(null), (e) => cb(e));
  }

  touch(sid, sess, cb = () => {}) {
    this.pool.execute('UPDATE sessions SET expires_at = ? WHERE sid = ?', [MySqlStore.expiry(sess), sid])
      .then(() => cb(null), (e) => cb(e));
  }

  destroy(sid, cb = () => {}) {
    this.pool.execute('DELETE FROM sessions WHERE sid = ?', [sid]).then(() => cb(null), (e) => cb(e));
  }
}

module.exports = MySqlStore;
