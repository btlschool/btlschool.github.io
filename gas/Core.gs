/**
 * منصة BTL - النواة: الموجّه (Router) + أدوات الشيت + الإعدادات + السجل + الحماية.
 * كل الطلبات من الواجهة تصل إلى doPost بصيغة JSON: {action:"...", token:"...", data:{...}}
 */

var API_VERSION = '0.1.0';
var PUBLIC_ACTIONS = {   // أفعال مسموحة بدون جلسة (الدوال تُستدعى عند الطلب فلا يهم ترتيب الملفات)
  reg_contact: function (c) { return act_regContact_(c); },
  login: function (c) { return act_login_(c); },
  login_request_code: function (c) { return act_loginRequestCode_(c); },
  staff_login: function (c) { return act_staffLogin_(c); },
  price_preview: function (c) { return act_pricePreview_(c); },
  offers_now: function (c) { return act_offersNow_(c); },
  invite_open: function (c) { return act_inviteOpen_(c); }
};
var USER_ACTIONS = {       // أفعال تحتاج جلسة مشارك
  me: function (c) { return act_me_(c); },
  logout: function (c) { return act_logout_(c); },
  logout_all: function (c) { return act_logoutAll_(c); },
  reg_profile: function (c) { return act_regProfile_(c); },
  reg_add_child: function (c) { return act_regAddChild_(c); },
  test_start: function (c) { return act_testStart_(c); },
  test_answer: function (c) { return act_testAnswer_(c); },
  test_beginner_stop: function (c) { return act_testBeginnerStop_(c); },
  test_finish: function (c) { return act_testFinish_(c); },
  test_result: function (c) { return act_testResult_(c); },
  invite_create: function (c) { return act_inviteCreate_(c); },
  invite_list: function (c) { return act_inviteList_(c); },
  invite_cancel: function (c) { return act_inviteCancel_(c); },
  group_suggest: function (c) { return act_groupSuggest_(c); },
  group_options: function (c) { return act_groupOptions_(c); },
  app_state: function (c) { return act_appState_(c); },
  report: function (c) { return act_report_(c); },
  stop_send: function (c) { return act_stopSend_(c); },
  order_save: function (c) { return act_orderSave_(c); },
  order_get: function (c) { return act_orderGet_(c); },
  order_drop_waiting: function (c) { return act_orderDropWaiting_(c); },
  order_checkout: function (c) { return act_orderCheckout_(c); },
  order_cancel: function (c) { return act_orderCancel_(c); },
  order_receipt: function (c) { return act_orderReceipt_(c); },
  code_reveal: function (c) { return act_codeReveal_(c); }
};
var TEST_SCOPE_ACTIONS = { me: 1, logout: 1, test_start: 1, test_answer: 1, test_beginner_stop: 1, test_finish: 1, test_result: 1, group_suggest: 1, group_options: 1, order_save: 1, order_get: 1, order_drop_waiting: 1, order_checkout: 1, order_cancel: 1, order_receipt: 1, code_reveal: 1 };  // أفعال تسمح بها جلسة رابط الاختبار (scope=test) إضافة إلى جلسة المشارك
var STAFF_ACTIONS = {      // أفعال تحتاج صلاحية إدارية
  staff_outreach_list: function (c) { return act_staffOutreachList_(c); },
  staff_outreach_prepare: function (c) { return act_staffOutreachPrepare_(c); },
  staff_outreach_done: function (c) { return act_staffOutreachDone_(c); },
  staff_payment_list: function (c) { return act_staffPaymentList_(c); },
  staff_payment_receipt: function (c) { return act_staffPaymentReceipt_(c); },
  staff_payment_review: function (c) { return act_staffPaymentReview_(c); },
  staff_logout: function (c) { return act_staffLogout_(c); },
  staff_inbox: function (c) { return act_staffInbox_(c); },
  staff_stops_list: function (c) { return act_staffStopsList_(c); },
  staff_stop_done: function (c) { return act_staffStopDone_(c); },
  staff_settings_get: function (c) { return act_staffSettingsGet_(c); },
  staff_settings_set: function (c) { return act_staffSettingsSet_(c); }
};

// ---------- الموجّه ----------
function doGet(e) {
  return json_({ ok: true, name: 'BTL API', version: API_VERSION });
}

function doPost(e) {
  if (e.parameter && e.parameter.k) { return handleTelegram_(e); }
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
    var fn = null, ctx = { data: req.data || {}, user: null, staff: null, token: req.token };
    if (req.action === 'ping') { return json_({ ok: true, version: API_VERSION, time: new Date().toISOString() }); }
    if (PUBLIC_ACTIONS[req.action]) { fn = PUBLIC_ACTIONS[req.action]; }
    else if (USER_ACTIONS[req.action]) { ctx.user = requireUser_(req.token, !!TEST_SCOPE_ACTIONS[req.action]); fn = USER_ACTIONS[req.action]; }
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
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var r = sh.getLastRow() + 1;
    // نص صريح قبل الكتابة: يحفظ الصفر الأول في أرقام الهاتف ويمنع تحويل القيم
    sh.getRange(r, 1, 1, h.length).setNumberFormat('@').setValues([row]);
  } finally { lock.releaseLock(); }
}

function updateRow_(name, rowNum, patch) {
  var sh = sheet_(name), h = headers_(sh);
  Object.keys(patch).forEach(function (k) {
    var c = h.indexOf(k);
    if (c !== -1) sh.getRange(rowNum, c + 1).setNumberFormat('@').setValue(safeCell_(patch[k]));
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

var DIAL_CODES = { DZ:'213', FR:'33', SA:'966', AE:'971', QA:'974', KW:'965', BH:'973', OM:'968', JO:'962',
  CA:'1', US:'1', GB:'44', DE:'49', ES:'34', IT:'39', BE:'32', CH:'41', NL:'31', SE:'46',
  TR:'90', TN:'216', MA:'212', LY:'218', EG:'20', MR:'222' };

/**
 * يوحّد أي رقم إلى الصيغة الدولية E.164 (مثل +213779343047) أو يعيد null.
 * يقبل: مسافات ونقاط وشرطات وأقواس وأرقام عربية، مع صفر أو بدونه، ومع +213 أو 00213 أو 213.
 * country: رمز الدولة المختارة (الافتراضي DZ) ويُستعمل فقط عند غياب الرمز الدولي.
 */
function normPhone_(raw, country) {
  var s = String(raw || '');
  s = s.replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
  s = s.replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
  var plus = /^\s*\+/.test(s);
  s = s.replace(/[^\d]/g, '');
  if (!s) return null;
  var cc = DIAL_CODES[country || 'DZ'] || DIAL_CODES.DZ, digits;
  if (plus) { digits = s; }
  else if (s.indexOf('00') === 0) { digits = s.slice(2); }
  else if (cc === '213' && /^213[567]\d{8}$/.test(s)) { digits = s; }
  else if (cc === '213' && /^0?[567]\d{8}$/.test(s)) { digits = '213' + s.replace(/^0/, ''); }
  else if (cc !== '213') { digits = (s.indexOf(cc) === 0 && s.length > 10 ? s : cc + s.replace(/^0/, '')); }
  else { return null; }
  if (digits.indexOf('213') === 0 && !/^213[567]\d{8}$/.test(digits)) return null;
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return '+' + digits;
}

/** للعرض: الجزائري بصيغته المحلية 0XXXXXXXXX وغيره كما هو. */
function phoneDisplay_(e164) {
  var p = String(e164 || '');
  return p.indexOf('+213') === 0 ? '0' + p.slice(4) : p;
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
