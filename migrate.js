'use strict';
// migrate.js - tự tạo bảng (database/schema.sql) khi server khởi động.
// Chỉ dùng CREATE TABLE IF NOT EXISTS nên chạy lại bao nhiêu lần cũng an toàn, không xóa dữ liệu.
const fs = require('fs');
const path = require('path');
const { pool } = require('./config');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readStatements() {
  const sql = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');
  return sql
    .split(/;[ \t]*\r?\n/)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean);
}

async function migrate({ retries = 6, delayMs = 3000 } = {}) {
  const statements = readStatements();
  for (let attempt = 1; ; attempt++) {
    try {
      for (const s of statements) await pool.query(s);
      console.log(`[db] Schema OK (${statements.length} bảng).`);
      return true;
    } catch (e) {
      console.error(`[db] Migrate lần ${attempt}/${retries} lỗi: ${e.code || ''} ${e.message}`);
      if (attempt >= retries) return false;
      await sleep(delayMs); // MySQL trên Railway có thể khởi động chậm hơn web
    }
  }
}

module.exports = { migrate, readStatements };
