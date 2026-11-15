'use strict';
// routes/data.js - phần "Add data & maps" của web_test.html, lưu trong database `railway` - bảng data_types, site_values, map_layers (thay cho data.php)
//   GET    /api/data                  -> { types: [...], values: [...], maps: [...] } của tài khoản đang đăng nhập
//   POST   /api/data?res=type         -> thêm data type (tiêu chí mới)
//   POST   /api/data?res=value        -> lưu giá trị của 1 tiêu chí cho 1 site
//   POST   /api/data?res=map          -> thêm map layer
//   DELETE /api/data?res=type&id=N    -> xóa data type (kèm các giá trị của nó)
//   DELETE /api/data?res=map&id=N     -> xóa map layer
const crypto = require('crypto');
const express = require('express');
const {
  pool, q, fail, handler, requireLogin, body, num, str, toInt, truthy,
  SITE_TABLE, BASE, BASE_TO_TARGET,
} = require('../config');

const router = express.Router();

// Tiêu chí có sẵn của web lưu thẳng vào cột của bảng sites
const SITE_COLUMN = {
  humidity: 'Humidity',
  popDensity: 'Pop_density',
  elevation: 'Elevation',
  temp: 'Temperature',
  wind: 'Wind_Speed',
  pressure: 'Pressure',
};
// Tiêu chí có sẵn nhưng không có cột trong sites -> lưu vào site_values (tự tạo data type lần đầu)
const BUILTIN_TYPE = {
  solar: { name: 'Solar radiation', unit: 'kWh/m²/day', min: 0, max: 8, dir: 'higher' },
};

const typeJson = (r) => ({
  dbId: Number(r.id),
  k: r.crit_key,
  label: r.name,
  unit: r.unit ?? '',
  min: Number(r.range_min),
  max: Number(r.range_max),
  better: r.direction === 'lower' ? 'low' : 'high',
});
const mapJson = (r) => ({
  id: 'm' + r.id,
  dbId: Number(r.id),
  preset: r.preset,
  name: r.name,
  url: r.tile_url,
  zoom: r.max_zoom === null || r.max_zoom === undefined ? 18 : Number(r.max_zoom),
  overlay: r.mode === 'overlay',
});

router.all('/', handler(async (req, res) => {
  const uid = requireLogin(req);
  const method = req.method;
  const resource = req.query.res || '';
  const rid = toInt(req.query.id);

  if (method === 'GET') {
    const [t] = await pool.execute(`SELECT * FROM data_types WHERE user_id = ? ORDER BY id`, [uid]);
    const [v] = await pool.execute(
      `SELECT v.base, v.site_id, v.value, t.crit_key
         FROM site_values v JOIN data_types t ON t.id = v.data_type_id
        WHERE v.user_id = ?`, [uid]);
    const [m] = await pool.execute(`SELECT * FROM map_layers WHERE user_id = ? ORDER BY id`, [uid]);
    return res.json({
      types: t.map(typeJson),
      values: v.map((r) => ({
        target: BASE_TO_TARGET[r.base] ?? r.base,
        siteId: Number(r.site_id),
        key: r.crit_key,
        value: Number(r.value),
      })),
      maps: m.map(mapJson),
    });
  }

  if (method === 'POST' && resource === 'type') {
    const b = body(req);
    const name = str(b.label);
    const unit = str(b.unit);
    const min = num(b.min);
    const max = num(b.max);
    if (name === '' || name.length > 100) fail(422, 'Enter a name (up to 100 characters).');
    if (unit.length > 30) fail(422, 'Unit is too long (max 30 characters).');
    if (min === null || max === null || min >= max) fail(422, 'Range minimum must be smaller than the maximum.');
    const dir = (b.better ?? 'high') === 'low' ? 'lower' : 'higher';
    const key = 'x_' + crypto.randomBytes(5).toString('hex');

    let insertId;
    try {
      const [r] = await pool.execute(
        `INSERT INTO data_types (user_id, crit_key, name, unit, range_min, range_max, direction)
         VALUES (?,?,?,?,?,?,?)`, [uid, key, name, unit === '' ? null : unit, min, max, dir]);
      insertId = r.insertId;
    } catch (e) {
      if (e.errno === 1062) fail(409, 'You already have a data type with this name.');
      throw e;
    }
    const [rows] = await pool.execute(`SELECT * FROM data_types WHERE id = ? AND user_id = ?`, [insertId, uid]);
    return res.status(201).json({ ok: true, type: typeJson(rows[0]) });
  }

  if (method === 'POST' && resource === 'value') {
    const b = body(req);
    const target = b.target ?? '';
    const siteId = toInt(b.siteId);
    const key = String(b.key ?? '');
    const value = num(b.value);
    if (!SITE_TABLE[target]) fail(422, 'target must be Moon or Mars');
    if (siteId <= 0 || key === '' || value === null) fail(422, 'Pick a site and a criterion, then enter a number.');

    const sites = q(SITE_TABLE[target]);
    const [own] = await pool.execute(`SELECT id FROM ${sites} WHERE id = ? AND user_id = ?`, [siteId, uid]);
    if (!own.length) fail(404, 'Site not found.');

    if (Object.prototype.hasOwnProperty.call(SITE_COLUMN, key)) { // lưu thẳng vào bảng sites
      if (key === 'humidity' && (value < 0 || value > 100)) fail(422, 'Humidity must be between 0 and 100.');
      if ((key === 'popDensity' || key === 'wind') && value < 0) fail(422, 'Value cannot be negative.');
      const col = SITE_COLUMN[key];
      await pool.execute(`UPDATE ${sites} SET ${q(col)} = ? WHERE id = ? AND user_id = ?`, [value, siteId, uid]);
      return res.json({ ok: true, stored: 'sites' });
    }

    const [tr] = await pool.execute(`SELECT id FROM data_types WHERE user_id = ? AND crit_key = ?`, [uid, key]);
    let typeId = tr[0] ? tr[0].id : null;
    if (!typeId) {
      if (!Object.prototype.hasOwnProperty.call(BUILTIN_TYPE, key)) fail(404, 'Data type not found.');
      const t = BUILTIN_TYPE[key];
      const [r] = await pool.execute(
        `INSERT INTO data_types (user_id, crit_key, name, unit, range_min, range_max, direction)
         VALUES (?,?,?,?,?,?,?)`, [uid, key, t.name, t.unit, t.min, t.max, t.dir]);
      typeId = r.insertId;
    }

    await pool.execute(
      `INSERT INTO site_values (user_id, base, site_id, data_type_id, value)
       VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [uid, BASE[target], siteId, typeId, value]);
    return res.json({ ok: true, stored: 'site_values' });
  }

  if (method === 'POST' && resource === 'map') {
    const b = body(req);
    const name = str(b.name);
    const url = str(b.url);
    if (name === '' || name.length > 100) fail(422, 'Enter a map name (up to 100 characters).');
    if (!/^https:\/\//i.test(url) || url.length > 500
      || !url.includes('{z}') || !url.includes('{x}') || !url.includes('{y}'))
      fail(422, 'The URL must start with https:// and contain {z}, {x} and {y}.');
    let zoom = num(b.zoom);
    zoom = zoom !== null && zoom >= 1 && zoom <= 18 ? Math.trunc(zoom) : null;
    const mode = truthy(b.overlay) ? 'overlay' : 'base';
    const preset = str(b.preset);

    const [r] = await pool.execute(
      `INSERT INTO map_layers (user_id, preset, name, max_zoom, mode, tile_url) VALUES (?,?,?,?,?,?)`,
      [uid, preset === '' ? null : preset.slice(0, 100), name, zoom, mode, url]);
    const [rows] = await pool.execute(`SELECT * FROM map_layers WHERE id = ? AND user_id = ?`, [r.insertId, uid]);
    return res.status(201).json({ ok: true, map: mapJson(rows[0]) });
  }

  if (method === 'DELETE' && (resource === 'type' || resource === 'map')) {
    if (rid <= 0) fail(422, 'Missing id.');
    const tbl = resource === 'type' ? 'data_types' : 'map_layers';
    const [r] = await pool.execute(`DELETE FROM ${tbl} WHERE id = ? AND user_id = ?`, [rid, uid]);
    return res.json({ ok: true, deleted: r.affectedRows });
  }

  fail(400, 'Invalid request.');
}));

module.exports = router;
