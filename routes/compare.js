'use strict';
// routes/compare.js - danh sách sites Moon & Mars cho compare.html (thay cho compare_api.php)
// Đọc moon_base_sites / mars_outpost_sites + giá trị mở rộng trong site_values / data_types (database `railway`)
const express = require('express');
const { pool, q, handler, requireLogin, SITE_TABLE, BASE } = require('../config');

const router = express.Router();

router.get('/', handler(async (req, res) => {
  const uid = requireLogin(req);
  const result = { Moon: [], Mars: [] };

  for (const target of ['Moon', 'Mars']) {
    // Tất cả các cột của bảng sites thuộc user hiện tại
    const [sites] = await pool.execute(`SELECT * FROM ${q(SITE_TABLE[target])} WHERE user_id = ? ORDER BY id ASC`, [uid]);

    // Giá trị mở rộng (solar hoặc tiêu chí tùy chỉnh) từ site_values
    const [vals] = await pool.execute(
      `SELECT v.site_id, t.name, t.unit, v.value
         FROM site_values v
         JOIN data_types t ON t.id = v.data_type_id
        WHERE v.user_id = ? AND v.base = ?`, [uid, BASE[target]]);
    const extraMap = new Map();
    for (const row of vals) {
      const sid = Number(row.site_id);
      if (!extraMap.has(sid)) extraMap.set(sid, []);
      extraMap.get(sid).push({ name: row.name, unit: row.unit ?? '', value: Number(row.value) });
    }

    result[target] = sites.map((s) => ({ ...s, extra_values: extraMap.get(Number(s.id)) || [] }));
  }

  res.json({ ok: true, sites: result });
}));

module.exports = router;
