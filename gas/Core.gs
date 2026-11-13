/**
 * منصة BTL - النواة: الموجّه (Router) + أدوات الشيت + الإعدادات + السجل + الحماية.
 * كل الطلبات من الواجهة تصل إلى doPost بصيغة JSON: {action:"...", token:"...", data:{...}}
 */

var API_VERSION = '0.1.0';
var PUBLIC_ACTIONS = {};   // أفعال مسموحة بدون جلسة (تُسجَّل في ملفات الوحدات)
var USER_ACTIONS = {};     // أفعال تحتاج جلسة مشارك
var STAFF_ACTIONS = {};    // أفعال تحتاج صلاحية إدارية

// ---------- الموجّه ----------
function doGet(e) {
  return json_({ ok: true, name: 'BTL API', version: API_VERSION });
}

function doPost(e) {
  var req, res;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  try {
    if (String(getSetting_('maintenance', '0')) === '1' && req.action !== 'ping') {
      return json_({ ok: false, error: 'maintenance' });
    }
    var fn = null, ctx = { data: req.data || {}, user: null, staff: null };
    if (req.action === 'ping') { return json_({ ok: true, version: API_VERSION, time: new Date().toISOString() }); }
    if (PUBLIC_ACTIONS[req.action]) { fn = PUBLIC_ACTIONS[req.action]; }
    else if (USER_ACTIONS[req.action]) { ctx.user = requireUser_(req.token); fn = USER_ACTIONS[req.action]; }
    else if (STAFF_ACTIONS[req.action]) { ctx.staff = requireStaff_(req.token); fn = STAFF_ACTIONS[req.action]; }
    else { return json_({ ok: false, error: 'unknown_action' }); }
    res = fn(ctx);
    return json_({ ok: true, result: res === undefined ? null : res });
  } catch (err) {
    var code = (err && err.code) ? err.code : 'server_error';
    if (code === 'server_error') { log_('error', String(req && req.action), String(err && err.stack || err)); }
    return json_({ ok: false, error: code });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function fail_(code) { var e = new Error(code); e.code = code; throw e; }

// ---------- الشيت ----------
function db_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name) {
  var sh = db_().getSheetByName(name);
  if (!sh) fail_('missing_sheet_' + name);
  return sh;
}

function headers_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
}

/** كل الصفوف ككائنات (مفاتيح الأعمدة). */
function rows_(name) {
  var sh = sheet_(name), last = sh.getLastRow();
  if (last < 2) return [];
  var h = headers_(sh);
  var vals = sh.getRange(2, 1, last - 1, h.length).getValues();
  return vals.map(function (r, i) {
    var o = { _row: i + 2 };
    for (var c = 0; c < h.length; c++) o[h[c]] = r[c];
    return o;
  });
}

function findRow_(name, key, value) {
  var v = String(value);
  return rows_(name).filter(function (r) { return String(r[key]) === v; })[0] || null;
}

/** إضافة صف. القيم تُخزَّن نصا، وأي نص يبدأ بـ = + - @ يُحصَّن ضد حقن الصيغ. */
function appendRow_(name, obj) {
  var sh = sheet_(name), h = headers_(sh);
  var row = h.map(function (k) { return safeCell_(obj[k]); });
  sh.appendRow(row);
}

function updateRow_(name, rowNum, patch) {
  var sh = sheet_(name), h = headers_(sh);
  Object.keys(patch).forEach(function (k) {
    var c = h.indexOf(k);
    if (c !== -1) sh.getRange(rowNum, c + 1).setValue(safeCell_(patch[k]));
  });
}

function safeCell_(v) {
  if (v === undefined || v === null) return '';
  var s = String(v);
  return /^[=+\-@]/.test(s) && !/^\+?\d[\d\s]*$/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? "'" + s : s;
}

// ---------- الإعدادات (مع كاش) ----------
function getSetting_(key, def) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('s_' + key);
  if (hit !== null) return hit;
  var r = findRow_('Settings', 'key', key);
  var val = r ? String(r.value) : (def === undefined ? '' : String(def));
  cache.put('s_' + key, val, 300);
  return val;
}

function setSetting_(key, value) {
  var r = findRow_('Settings', 'key', key);
  if (r) updateRow_('Settings', r._row, { value: value });
  else appendRow_('Settings', { key: key, value: value });
  CacheService.getScriptCache().remove('s_' + key);
}

// ---------- أدوات ----------
function now_() { return Utilities.formatDate(new Date(), 'Africa/Algiers', "yyyy-MM-dd'T'HH:mm:ss"); }

function uid_(prefix) {
  return prefix + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}

function sha256_(s) {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return d.map(function (b) { return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2); }).join('');
}

/** رقم هاتف جزائري موحّد: 0XXXXXXXXX (10 أرقام) أو null. */
function normPhone_(p) {
  var s = String(p || '').replace(/[\s\-().]/g, '');
  s = s.replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
  s = s.replace(/^(\+|00)213/, '0');
  return /^0[567]\d{8}$/.test(s) ? s : null;
}

function log_(action, target, details) {
  try { appendRow_('Audit', { ts: now_(), actor: 'system', action: action, target: target, details: String(details).slice(0, 2000) }); } catch (e) {}
}

function audit_(actor, action, target, details) {
  appendRow_('Audit', { ts: now_(), actor: actor, action: action, target: target, details: String(details || '').slice(0, 2000) });
}

/** حد للمعدّل: يرفض بعد max محاولة خلال sec ثانية لنفس المفتاح. */
function rateLimit_(key, max, sec) {
  var cache = CacheService.getScriptCache(), k = 'rl_' + sha256_(key).slice(0, 24);
  var n = Number(cache.get(k) || 0) + 1;
  cache.put(k, String(n), sec);
  if (n > max) fail_('rate_limited');
}

// ---------- الجلسات (تُستكمل في Auth.gs) ----------
function requireUser_(token) { fail_('auth_not_ready'); }
function requireStaff_(token) { fail_('auth_not_ready'); }
