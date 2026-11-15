'use strict';
// routes/contribute.js - cầu nối giữa contribute.html và database `railway` (thay cho contribute.php)
//   GET  /api/contribute -> mọi địa điểm của tài khoản đang đăng nhập, gộp từ 3 bảng:
//                           moon_base_sites + mars_outpost_sites + contributions
//                           (trường "source" cho biết nguồn: 'moon base' | 'mars outpost' | 'contribute')
//   POST /api/contribute -> thêm 1 địa điểm đóng góp vào bảng contributions, trả về địa điểm vừa lưu
const express = require('express');
const {
  pool, q, fail, handler, requireLogin, body, num, str, scoreSite,
  SITE_TABLE, BASE, BASE_TO_TARGET, TERRAINS,
} = require('../config');

const router = express.Router();
const f = (v) => (v === null || v === undefined ? null : Number(v));

// Hàng của moon_base_sites / mars_outpost_sites -> object mà contribute.html dùng trong mảng `cat`
function siteRowToSite(r, target) {
  return {
    id: Number(r.id),
    source: BASE[target],                 // 'moon base' | 'mars outpost'
    target,                               // 'Moon' | 'Mars'
    locationName: r.Earth_Location,
    latitude: f(r.Latitude),
    longitude: f(r.Longitude),
    humidity: f(r.Humidity),
    popDensity: f(r.Pop_density),
    terrainType: r.Terrain,
    features: r.Geology_and_environment ?? '',
    contributor: r.contributor ?? '',
    refUrl: r.ref_url ?? '',
    score: Number(r.score),
    timestamp: new Date(r.created_at).getTime(),
  };
}

// Hàng của contributions -> cùng định dạng
function contributionToSite(r) {
  return {
    id: Number(r.id),
    source: 'contribute',
    target: BASE_TO_TARGET[r.base],
    locationName: `${r.site_name}, ${r.country}`,
    latitude: f(r.latitude),
    longitude: f(r.longitude),
    humidity: f(r.humidity),
    popDensity: f(r.pop_density),
    terrainType: r.terrain,
    features: r.features ?? '',
    contributor: r.contributor ?? '',
    refUrl: r.ref_url ?? '',
    score: Number(r.score),
    timestamp: new Date(r.created_at).getTime(),
  };
}

router.get('/', handler(async (req, res) => {
  const uid = requireLogin(req);
  const sites = [];
  for (const target of Object.keys(SITE_TABLE)) {
    const [rows] = await pool.execute(`SELECT * FROM ${q(SITE_TABLE[target])} WHERE user_id = ?`, [uid]);
    for (const r of rows) sites.push(siteRowToSite(r, target));
  }
  const [contribs] = await pool.execute('SELECT * FROM contributions WHERE user_id = ?', [uid]);
  for (const r of contribs) sites.push(contributionToSite(r));

  sites.sort((a, b) => b.timestamp - a.timestamp || b.id - a.id);
  res.json({ sites });
}));

router.post('/', handler(async (req, res) => {
  const uid = requireLogin(req);
  const b = body(req);
  const target = b.target ?? '';
  if (!SITE_TABLE[target]) fail(422, 'target must be Moon or Mars');

  const name = str(b.siteName);
  const country = str(b.country);
  const terrain = b.terrain ?? '';
  const feat = str(b.features);
  const contrib = str(b.contributor);
  const ref = str(b.refUrl);
  const lat = num(b.latitude);
  const lng = num(b.longitude);
  const hum = num(b.humidity);
  const pop = num(b.popDensity);

  if (name === '' || country === '' || feat === '' || contrib === '')
    fail(422, 'Fill in site name, country, geology details and contributor.');
  if (name.length > 100 || country.length > 100 || contrib.length > 100)
    fail(422, 'Site name, country and contributor must each be 100 characters or fewer.');
  if (!TERRAINS.includes(terrain)) fail(422, 'Invalid terrain.');
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180)
    fail(422, 'Enter valid coordinates (latitude -90..90, longitude -180..180).');
  if (hum !== null && (hum < 0 || hum > 100)) fail(422, 'Humidity must be between 0 and 100.');
  if (pop !== null && pop < 0) fail(422, 'Population density cannot be negative.');
  if (pop !== null && pop > 50000) fail(422, 'Population density must be at most 50,000 per km².');
  if (ref !== '' && (!/^https?:\/\//i.test(ref) || ref.length > 500))
    fail(422, 'Reference link must start with http(s):// (max 500 characters).');

  const score = scoreSite(target, terrain, feat, hum, pop);

  const [r] = await pool.execute(
    `INSERT INTO contributions
       (user_id, base, site_name, country, latitude, longitude, humidity, pop_density,
        terrain, features, contributor, ref_url, score)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [uid, BASE[target], name, country, lat, lng, hum, pop,
      terrain, feat, contrib, ref === '' ? null : ref, score]);

  const [rows] = await pool.execute('SELECT * FROM contributions WHERE id = ? AND user_id = ?', [r.insertId, uid]);
  res.status(201).json({ ok: true, site: contributionToSite(rows[0]) });
}));

module.exports = router;
