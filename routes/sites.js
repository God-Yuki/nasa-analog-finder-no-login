'use strict';
// routes/sites.js - lưu và đọc địa điểm theo từng tài khoản (thay cho sites.php)
//   GET  /api/sites?target=all|Moon|Mars -> danh sách địa điểm của tài khoản đang đăng nhập
//   POST /api/sites                      -> thêm địa điểm; nếu body có "id" thì cập nhật địa điểm đó
const express = require('express');
const {
  pool, q, fail, handler, requireLogin, body, num, str, isNumeric, scoreSite,
  SITE_TABLE, TERRAINS,
} = require('../config');

const router = express.Router();

// "15, 14, 13" <-> [15, 14, 13]
function seriesToArray(s) {
  if (s === null || s === undefined || s === '') return [];
  return String(s).split(',').filter(isNumeric).map(Number);
}
function seriesToString(v) {
  if (!Array.isArray(v)) return null;
  const a = v.filter(isNumeric).slice(0, 24).map(Number);
  return a.length ? a.join(',') : null;
}

// Hàng MySQL -> object web_test.html dùng trong mảng `cat`
function rowToSite(r, target) {
  const f = (v) => (v === null || v === undefined ? null : Number(v));
  return {
    id: Number(r.id),
    target,
    locationName: r.Earth_Location,
    latitude: f(r.Latitude),
    longitude: f(r.Longitude),
    humidity: f(r.Humidity),
    popDensity: f(r.Pop_density),
    temp: f(r.Temperature),
    wind: f(r.Wind_Speed),
    windDir: f(r.Wind_Direction),
    pressure: f(r.Pressure),
    elevation: f(r.Elevation),
    hourlyTemp: seriesToArray(r.temperature_24h),
    hourlyWind: seriesToArray(r.wind_speed_24h),
    terrainType: r.Terrain,
    features: r.Geology_and_environment ?? '',
    contributor: r.contributor ?? '',
    refUrl: r.ref_url ?? '',
    image: r.image ?? '',
    score: Number(r.score),
    timestamp: new Date(r.created_at).getTime(),
  };
}

router.get('/', handler(async (req, res) => {
  const uid = requireLogin(req);
  const f = req.query.target || 'all';
  const targets = f === 'all' ? Object.keys(SITE_TABLE) : (SITE_TABLE[f] ? [f] : []);
  const rows = [];
  for (const tg of targets) {
    const tbl = q(SITE_TABLE[tg]);
    const [list] = await pool.execute(`SELECT * FROM ${tbl} WHERE user_id = ? ORDER BY created_at DESC, id DESC`, [uid]);
    for (const r of list) rows.push(rowToSite(r, tg));
  }
  rows.sort((a, b) => b.timestamp - a.timestamp);
  res.json({ sites: rows });
}));

router.post('/', handler(async (req, res) => {
  const uid = requireLogin(req);
  const b = body(req);
  const target = b.target ?? '';
  if (!SITE_TABLE[target]) fail(422, 'target must be Moon or Mars');

  // web_test gửi locationName / terrainType; contribute.html cũ gửi siteName+country / terrain
  let loc = str(b.locationName);
  if (loc === '' && b.siteName) {
    loc = str(b.siteName + (b.country ? ', ' + b.country : ''));
  }
  const terrain = b.terrainType ?? b.terrain ?? '';
  const feat = str(b.features);
  const contrib = str(b.contributor);
  const ref = str(b.refUrl);
  const image = String(b.image ?? '');
  const lat = num(b.latitude);
  const lng = num(b.longitude);
  const hum = num(b.humidity);
  const pop = num(b.popDensity);
  const tmp = num(b.temp);
  const wnd = num(b.wind);
  const wdr = num(b.windDir);
  const prs = num(b.pressure);
  const elv = num(b.elevation);
  let id = isNumeric(b.id) ? Math.trunc(Number(b.id)) : 0;

  if (loc === '' || feat === '') fail(422, 'Enter the location name and the geology description.');
  if (loc.length > 150) fail(422, 'Location name is too long (max 150 characters).');
  if (!TERRAINS.includes(terrain)) fail(422, 'Invalid terrain.');
  if ((lat === null) !== (lng === null)) fail(422, 'Enter both latitude and longitude, or neither.');
  if (lat !== null && (lat < -90 || lat > 90 || lng < -180 || lng > 180)) fail(422, 'Coordinates out of range.');
  if (hum !== null && (hum < 0 || hum > 100)) fail(422, 'Humidity must be between 0 and 100.');
  if (pop !== null && pop < 0) fail(422, 'Population density cannot be negative.');
  if (wnd !== null && wnd < 0) fail(422, 'Wind speed cannot be negative.');
  if (wdr !== null && (wdr < 0 || wdr > 360)) fail(422, 'Wind direction must be between 0 and 360.');
  // giới hạn sống được: ngoài khoảng này không cho nhập
  if (pop !== null && pop > 50000) fail(422, 'Population density must be at most 50,000 per km².');
  if (wnd !== null && wnd > 120) fail(422, 'Wind speed above 120 km/h is not habitable.');
  if (tmp !== null && (tmp < -70 || tmp > 50)) fail(422, 'Temperature must be between -70 and 50 °C (habitable range).');
  if (prs !== null && (prs < 500 || prs > 1085)) fail(422, 'Pressure must be between 500 and 1085 hPa (habitable range).');
  if (elv !== null && (elv < -430 || elv > 5100)) fail(422, 'Elevation must be between -430 and 5100 m (habitable range).');
  if (ref !== '' && !/^https?:\/\//i.test(ref)) fail(422, 'Reference link must start with http(s)://');
  if (image.length > 3000000) fail(422, 'Image is too large.');

  // Web (Gemini / rules engine) gửi kèm điểm đã chấm -> dùng đúng điểm đó
  const cs = num(b.score);
  const score = cs !== null ? Math.max(0, Math.min(100, Math.round(cs))) : scoreSite(target, terrain, feat, hum, pop);

  const cols = {
    Earth_Location: loc, Latitude: lat, Longitude: lng,
    Humidity: hum, Pop_density: pop, Terrain: terrain,
    Temperature: tmp, Wind_Speed: wnd, Wind_Direction: wdr,
    Pressure: prs, Elevation: elv,
    temperature_24h: seriesToString(b.hourlyTemp),
    wind_speed_24h: seriesToString(b.hourlyWind),
    Geology_and_environment: feat,
    contributor: contrib === '' ? null : contrib,
    ref_url: ref === '' ? null : ref,
    image: image === '' ? null : image,
    score,
  };
  const tbl = q(SITE_TABLE[target]);
  let code;

  if (id > 0) {
    const [ex] = await pool.execute(`SELECT id FROM ${tbl} WHERE id = ? AND user_id = ?`, [id, uid]);
    if (!ex.length) fail(404, 'Site not found.');
    // Không ghi đè ảnh cũ khi lần cập nhật này không gửi ảnh
    if (image === '') delete cols.image;
    const set = Object.keys(cols).map((c) => `${q(c)} = ?`).join(', ');
    await pool.execute(`UPDATE ${tbl} SET ${set} WHERE id = ? AND user_id = ?`, [...Object.values(cols), id, uid]);
    code = 200;
  } else {
    const names = Object.keys(cols).map(q).join(', ');
    const marks = Object.keys(cols).map(() => '?').join(', ');
    const [r] = await pool.execute(`INSERT INTO ${tbl} (user_id, ${names}) VALUES (?, ${marks})`, [uid, ...Object.values(cols)]);
    id = r.insertId;
    code = 201;
  }

  const [rows] = await pool.execute(`SELECT * FROM ${tbl} WHERE id = ? AND user_id = ?`, [id, uid]);
  res.status(code).json({ ok: true, site: rowToSite(rows[0], target) });
}));

module.exports = router;
