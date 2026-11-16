/**
 * منصة BTL - الدخول والجلسات والتسجيل الأولي.
 *
 * النموذج:
 *  - لا كلمات مرور: رمز دخول معقد يُولَّد مرة واحدة بعد رفع الوصل ويُعرض مرة واحدة ويصل واتساب أيضا.
 *    يُخزَّن بصمة HMAC-SHA256 بسر خادم (AUTH_PEPPER في Script Properties) ولا يُخزَّن الرمز نفسه.
 *  - جلسة دائمة بمعرّف عشوائي (244 بتا) تُخزَّن بصمته فقط، وتتجدد مع الاستعمال، ويمكن إبطالها.
 *  - الصغار حسابات فرعية تحت حساب ولي الأمر (guardian_id) ويشاركون هاتفه؛ تسجيل الدخول بهاتف الحساب الرئيسي.
 *  - الإداريون: دخول بحساب Google (رمز الهوية يُتحقَّق منه عبر Google) ومطابقة بريدهم بورقة Staff.
 *  - رفض الدخول موحّد (bad_credentials) فلا يُكشف هل الرقم مسجَّل أم الرمز خاطئ. الاستثناء الوحيد المقصود:
 *    reg_contact يعيد existing لرقم له رمز دخول ليوجّهه إلى الدخول، وهو محدود المعدّل (5 في الساعة للرقم).
 */

// ---------- أسرار ----------
function pepper_() {
  var p = PropertiesService.getScriptProperties().getProperty('AUTH_PEPPER');
  if (!p) fail_('auth_not_ready');
  return p;
}

/** شغّلها مرة واحدة بعد النشر: تولّد سر الخادم. إعادة تشغيلها تُبطل كل الرموز والجلسات القائمة، فتتجاهل إن وُجد. */
function setupAuth() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('AUTH_PEPPER')) { Logger.log('AUTH_PEPPER موجود أصلا، لم يتغير شيء.'); return 'exists'; }
  props.setProperty('AUTH_PEPPER', Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid());
  Logger.log('تم توليد AUTH_PEPPER. أضف أيضا GOOGLE_CLIENT_ID (لدخول الإداريين) من Script Properties.');
  return 'created';
}

function hmacHex_(msg) {
  var sig = Utilities.computeHmacSha256Signature(String(msg), pepper_());
  return sig.map(function (b) { return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2); }).join('');
}

/** مقارنة بزمن ثابت لتفادي تسريب التطابق بالتوقيت. */
/** هل الخلية غير فارغة؟ (undefined/null/'' كلها فارغة) */
function nz_(v) { return v !== undefined && v !== null && String(v) !== ''; }

function safeEq_(a, b) {
  a = String(a); b = String(b);
  var d = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

// ---------- رمز الدخول ----------
var CODE_ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'; // بلا 0 O o 1 l I
var CODE_SYMS = '#@$%&*';

function randIndex_(n) {
  // يستخدم UUID عشوائيا (v4) كمصدر؛ يُرفض الانحياز بإعادة المحاولة
  var lim = 256 - (256 % n);
  for (;;) {
    var hex = Utilities.getUuid().replace(/-/g, '');
    for (var i = 0; i + 2 <= hex.length; i += 2) {
      var v = parseInt(hex.substr(i, 2), 16);
      if (i === 12 || i === 16) continue; // خانتا النسخة والمتغيّر في UUID ليستا عشوائيتين بالكامل
      if (v < lim) return v % n;
    }
  }
}

/** شكل الرمز يطابق التصميم: XX#XXX-XXXX (9 خانات + رمز + شرطة، نحو 52 بتا). */
function genCode_() {
  function chunk(k) { var s = ''; for (var i = 0; i < k; i++) s += CODE_ALPHA.charAt(randIndex_(CODE_ALPHA.length)); return s; }
  return chunk(2) + CODE_SYMS.charAt(randIndex_(CODE_SYMS.length)) + chunk(3) + '-' + chunk(4);
}

function normCode_(raw) { return String(raw || '').replace(/\s+/g, ''); }

/** يُصدر رمزا جديدا للمستخدم الرئيسي ويعيده نصا مرة واحدة. الرمز القديم يبطل. */
function issueAccessCode_(userId) {
  var u = findRowFast_('Users', 'user_id', userId);
  if (!u) fail_('no_user');
  var code = genCode_();
  updateRow_('Users', u._row, { code_hash: hmacHex_('code|' + userId + '|' + code), code_issued_at: now_(), failed_logins: '0', locked_until: '' });
  audit_('system', 'code_issued', userId, '');
  return code;
}

// ---------- أدوات الشيت السريعة ----------
/** بحث سريع بالقيمة الكاملة في عمود (TextFinder) بدل قراءة الورقة كلها. */
function findRowFast_(sheetName, key, value) {
  var sh = sheet_(sheetName), h = headers_(sh), c = h.indexOf(key);
  if (c === -1) fail_('bad_column');
  var last = sh.getLastRow();
  if (last < 2) return null;
  var rng = sh.getRange(2, c + 1, last - 1, 1);
  var f = rng.createTextFinder(String(value)).matchEntireCell(true).matchCase(true).findNext();
  if (!f) return null;
  var r = f.getRow(), vals = sh.getRange(r, 1, 1, h.length).getValues()[0], o = { _row: r };
  for (var i = 0; i < h.length; i++) o[h[i]] = vals[i];
  return o;
}

/** الحساب الرئيسي لرقم (يستبعد حسابات الصغار الفرعية). */
function findPrimaryByPhone_(phone) {
  var sh = sheet_('Users'), h = headers_(sh), c = h.indexOf('phone'), g = h.indexOf('guardian_id');
  var last = sh.getLastRow();
  if (last < 2) return null;
  var finder = sh.getRange(2, c + 1, last - 1, 1).createTextFinder(String(phone)).matchEntireCell(true);
  var all = finder.findAll();
  for (var i = 0; i < all.length; i++) {
    var r = all[i].getRow();
    if (!nz_(sh.getRange(r, g + 1).getValue())) {
      var vals = sh.getRange(r, 1, 1, h.length).getValues()[0], o = { _row: r };
      for (var k = 0; k < h.length; k++) o[h[k]] = vals[k];
      return o;
    }
  }
  return null;
}

// ---------- التحقق من المدخلات ----------
/** يُنظّف الاسم اللاتيني: يحذف الرموز، يوحّد المسافات، وأول حرف كبير من كل كلمة. يعيد null إن لم يصلح. */
function cleanName_(raw) {
  var s = String(raw || '').replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'\- ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 40 || !/[A-Za-zÀ-ÿ]/.test(s)) return null;
  return s.toLowerCase().replace(/(^|[ \-'])([a-zà-ÿ])/g, function (m, p, ch) { return p + ch.toUpperCase(); });
}

/** age_group من سنة الميلاد: adult | kids | null (مرفوض). young=true تعني دون السن المعتاد مع تنبيه المرافقة. */
function ageInfo_(birthYear, thisYear, cfg) {
  var by = Number(birthYear);
  if (!isFinite(by) || by < 1900 || by > thisYear) return null;
  var age = thisYear - by;
  if (age > cfg.maxAge || age < cfg.floorAge) return null;
  if (age >= cfg.adultMin) return { group: 'adult', age: age, young: false };
  return { group: 'kids', age: age, young: age < cfg.kidsMin };
}

function ageCfg_() {
  return { adultMin: Number(getSetting_('adult_min_age', 15)), kidsMin: Number(getSetting_('kids_min_age', 8)), floorAge: Number(getSetting_('kids_floor_age', 5)), maxAge: Number(getSetting_('max_age', 90)) };
}

var LANGS = { EN: 1, FR: 1 };
function cleanLangs_(arr) {
  if (!Array.isArray(arr) || !arr.length || arr.length > 6) return null;
  var out = [];
  for (var i = 0; i < arr.length; i++) { var l = String(arr[i]).toUpperCase(); if (!LANGS[l]) return null; if (out.indexOf(l) === -1) out.push(l); }
  return out;
}

// ---------- الجلسات ----------
/** الوقت الحالي (بتوقيت الجزائر، ثابت UTC+1) + ms، بصيغة ISO. يعتمد now_() ليكون قابلا للاختبار. */
function isoPlus_(ms) {
  return Utilities.formatDate(new Date(new Date(now_() + '+01:00').getTime() + ms), 'Africa/Algiers', "yyyy-MM-dd'T'HH:mm:ss");
}

function newToken_() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); }

function createSession_(userId, scope, device, days) {
  var token = newToken_(), exp = isoPlus_(days * 86400000);
  var maxS = Number(getSetting_('max_sessions_per_user', 5));
  if (scope === 'user') {
    var mine = rows_('AuthSessions').filter(function (r) { return String(r.user_id) === String(userId) && String(r.scope) === 'user' && String(r.revoked) !== '1'; });
    mine.sort(function (a, b) { return String(a.created_at) === String(b.created_at) ? a._row - b._row : (String(a.created_at) < String(b.created_at) ? -1 : 1); });
    while (mine.length >= maxS) { var old = mine.shift(); updateRow_('AuthSessions', old._row, { revoked: '1' }); revokeSessionCache_(String(old.token_hash)); }
  }
  appendRow_('AuthSessions', { token_hash: hmacHex_('sess|' + token), user_id: userId, created_at: now_(), expires_at: exp, device: String(device || '').slice(0, 80), revoked: '0', scope: scope, last_seen: now_() });
  return token;
}

/** يتحقق من الجلسة. allowTest=true يسمح أيضا بجلسة scope=test (رابط اختبار). */
function requireUser_(token, allowTest) {
  if (!token || String(token).length !== 64) fail_('unauthorized');
  var h = hmacHex_('sess|' + token), cache = CacheService.getScriptCache(), ck = 'ss_' + h.slice(0, 32);
  var hit = cache.get(ck), sess;
  if (hit) { sess = JSON.parse(hit); }
  else {
    var r = findRowFast_('AuthSessions', 'token_hash', h);
    if (!r || !safeEq_(r.token_hash, h) || String(r.revoked) === '1') fail_('unauthorized');
    sess = { uid: String(r.user_id), scope: String(r.scope), exp: String(r.expires_at), row: r._row };
  }
  if (sess.exp < now_()) fail_('unauthorized');
  if (sess.scope !== 'user' && !(allowTest && sess.scope === 'test')) fail_('forbidden');
  var u = findRowFast_('Users', 'user_id', sess.uid);
  if (!u || String(u.status) === 'blocked') fail_('unauthorized');
  if (!hit) {
    cache.put(ck, JSON.stringify(sess), 600);
    // تجديد انزلاقي: نمدّ الصلاحية مرة كل 10 دقائق على الأكثر (يوم الكاش)
    var days = Number(getSetting_('session_days', 365));
    updateRow_('AuthSessions', sess.row, { last_seen: now_(), expires_at: isoPlus_(days * 86400000) });
  }
  u._scope = sess.scope; u._tokenHash = h; u._sessRow = sess.row;
  return u;
}

function revokeSessionCache_(h) { CacheService.getScriptCache().remove('ss_' + h.slice(0, 32)); }

// ---------- التسجيل الأولي ----------
/**
 * reg_contact (عام): خطوة بيانات التواصل المشتركة. data: {name, phone, country, device}
 * - رقم له رمز دخول مُصدَر سابقا: يُرفض بـ existing (يذهب إلى الدخول) دون كشف أي بيانات ودون جلسة.
 * - رقم بلا رمز (تسجيل لم يكتمل): يُعاد تسجيله من الصفر وتُبطل جلساته القديمة.
 */
function act_regContact_(ctx) {
  var d = ctx.data;
  if (String(getSetting_('registration_open', '1')) !== '1') fail_('registration_closed');
  var phone = normPhone_(d.phone, d.country);
  var name = cleanName_(d.name);
  if (!phone) fail_('bad_phone');
  if (!name) fail_('bad_name');
  rateLimit_('regphone_' + phone, 5, 3600);
  rateLimit_('regglobal', 600, 3600);
  var u = findPrimaryByPhone_(phone), id;
  if (u && nz_(u.code_hash)) return { existing: true };
  if (u) {
    id = String(u.user_id);
    rows_('AuthSessions').filter(function (r) { return String(r.user_id) === id && String(r.revoked) !== '1'; }).forEach(function (r) { updateRow_('AuthSessions', r._row, { revoked: '1' }); revokeSessionCache_(String(r.token_hash)); });
    updateRow_('Users', u._row, { name_latin: name, country: String(d.country || 'DZ').slice(0, 2).toUpperCase(), status: 'new', gender: '', birth_year: '', age_group: '', languages: '', last_seen: now_() });
  } else {
    id = uid_('u');
    appendRow_('Users', { user_id: id, phone: phone, name_latin: name, role: 'student', status: 'new', source: 'web', country: String(d.country || 'DZ').slice(0, 2).toUpperCase(), created_at: now_(), last_seen: now_(), failed_logins: '0' });
  }
  var token = createSession_(id, 'user', d.device, Number(getSetting_('session_days', 365)));
  return { existing: false, token: token, name: name, phone: phoneDisplay_(phone) };
}

/** reg_profile (مشارك): الجنس وسنة الميلاد واللغات. يحدد الفئة (كبار/صغار) ويعيدها. */
function act_regProfile_(ctx) {
  var d = ctx.data, g = String(d.gender);
  if (g !== 'M' && g !== 'F') fail_('bad_gender');
  var info = ageInfo_(d.birthYear, Number(Utilities.formatDate(new Date(), 'Africa/Algiers', 'yyyy')), ageCfg_());
  if (!info) fail_('bad_birth_year');
  var langs = cleanLangs_(d.languages);
  if (!langs) fail_('bad_languages');
  updateRow_('Users', ctx.user._row, { gender: g, birth_year: String(d.birthYear), age_group: info.group, languages: langs.join(','), last_seen: now_() });
  return { ageGroup: info.group, young: info.young, languages: langs };
}

/** reg_add_child (مشارك): ابن/ابنة تحت هذا الحساب. data: {name, gender, birthYear, languages}. يرث هاتف ولي الأمر. */
function act_regAddChild_(ctx) {
  if (nz_(ctx.user.guardian_id)) fail_('forbidden');
  var d = ctx.data, name = cleanName_(d.name), g = String(d.gender);
  if (!name) fail_('bad_name');
  if (g !== 'M' && g !== 'F') fail_('bad_gender');
  var info = ageInfo_(d.birthYear, Number(Utilities.formatDate(new Date(), 'Africa/Algiers', 'yyyy')), ageCfg_());
  if (!info || info.group !== 'kids') fail_('bad_birth_year');
  var langs = cleanLangs_(d.languages);
  if (!langs) fail_('bad_languages');
  var kids = rows_('Users').filter(function (r) { return String(r.guardian_id) === String(ctx.user.user_id); });
  if (kids.length >= 8) fail_('too_many_children');
  var id = uid_('u');
  appendRow_('Users', { user_id: id, phone: ctx.user.phone, name_latin: name, gender: g, role: 'student', status: 'new', age_group: 'kids', birth_year: String(d.birthYear), languages: langs.join(','), source: 'web', guardian_id: ctx.user.user_id, country: ctx.user.country, created_at: now_() });
  return { childId: id, young: info.young };
}

// ---------- الدخول ----------
/** login (عام): data {phone, country, code, device}. رد موحّد عند أي فشل. */
function act_login_(ctx) {
  var d = ctx.data, phone = normPhone_(d.phone, d.country), code = normCode_(d.code);
  if (!phone || !code || code.length > 40) fail_('bad_credentials');
  rateLimit_('loginphone_' + phone, 20, 900);
  rateLimit_('loginglobal', 1500, 900);
  var u = findPrimaryByPhone_(phone);
  var lockedUntil = u && nz_(u.locked_until) ? String(u.locked_until) : '';
  if (u && lockedUntil && lockedUntil > now_()) fail_('bad_credentials');
  // نحسب البصمة دائما حتى لو لم يوجد مستخدم (يقرّب زمن الرد)
  var calc = hmacHex_('code|' + (u ? u.user_id : 'x') + '|' + code);
  var ok = u && nz_(u.code_hash) && safeEq_(calc, String(u.code_hash)) && String(u.status) !== 'blocked';
  if (!ok) {
    if (u) {
      var f = Number(u.failed_logins || 0) + 1, patch = { failed_logins: String(f) };
      if (f >= Number(getSetting_('login_max_fails', 5))) {
        patch.locked_until = isoPlus_(Number(getSetting_('login_lock_minutes', 15)) * 60000);
        patch.failed_logins = '0';
        audit_('system', 'login_locked', String(u.user_id), '');
      }
      updateRow_('Users', u._row, patch);
    }
    fail_('bad_credentials');
  }
  updateRow_('Users', u._row, { failed_logins: '0', locked_until: '', last_login: now_(), last_seen: now_() });
  var token = createSession_(String(u.user_id), 'user', d.device, Number(getSetting_('session_days', 365)));
  return { token: token, user: publicUser_(u) };
}

function publicUser_(u) {
  return { id: String(u.user_id), name: String(u.name_latin), phone: phoneDisplay_(u.phone), status: String(u.status), ageGroup: String(u.age_group), languages: String(u.languages).split(',').filter(Boolean), telegram: nz_(u.telegram_id) };
}

/**
 * login_request_code (عام): نسيت الرمز. يُرسَل رمز جديد إلى محادثة تلغرام الموثّقة للرقم فقط (لأنها دليل الملكية).
 * الرد موحّد دائما (sent=true) كي لا يُكشف وجود الرقم. بلا تلغرام موثّق: يُنصح بالتواصل مع الإدارة.
 */
function act_loginRequestCode_(ctx) {
  var phone = normPhone_(ctx.data.phone, ctx.data.country);
  if (!phone) fail_('bad_phone');
  rateLimit_('reqcode_' + phone, 3, 3600);
  rateLimit_('reqcodeglobal', 200, 3600);
  var u = findPrimaryByPhone_(phone);
  if (u && nz_(u.telegram_id) && String(u.phone_verified) === '1' && nz_(u.code_hash)) {
    var code = issueAccessCode_(String(u.user_id));
    try { tg_('sendMessage', { chat_id: u.telegram_id, text: 'رمز دخولك الجديد إلى منصة BTL:\n' + code + '\nاحفظه ولا تشاركه مع أحد. الرمز القديم لم يعد يعمل.' }); } catch (e) { log_('code_send_fail', String(u.user_id), String(e)); }
  }
  return { sent: true };
}

function act_me_(ctx) {
  var u = ctx.user, kids = rows_('Users').filter(function (r) { return String(r.guardian_id) === String(u.user_id); });
  var out = publicUser_(u);
  out.children = kids.map(function (k) { return { id: String(k.user_id), name: String(k.name_latin), birthYear: String(k.birth_year), languages: String(k.languages).split(',').filter(Boolean), status: String(k.status) }; });
  return out;
}

function act_logout_(ctx) {
  updateRow_('AuthSessions', ctx.user._sessRow, { revoked: '1' });
  revokeSessionCache_(ctx.user._tokenHash);
  return { ok: true };
}

function act_logoutAll_(ctx) {
  rows_('AuthSessions').filter(function (r) { return String(r.user_id) === String(ctx.user.user_id) && String(r.revoked) !== '1'; }).forEach(function (r) {
    updateRow_('AuthSessions', r._row, { revoked: '1' });
    revokeSessionCache_(String(r.token_hash));
  });
  return { ok: true };
}

// ---------- الإداريون (Google) ----------
/** staff_login (عام): data {idToken}. يتحقق من رمز Google ثم من ورقة Staff. */
function act_staffLogin_(ctx) {
  var idt = String(ctx.data.idToken || '');
  if (idt.length < 100 || idt.length > 4000) fail_('bad_credentials');
  rateLimit_('stafflogin', 60, 900);
  var clientId = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID');
  if (!clientId) fail_('auth_not_ready');
  var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idt), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) fail_('bad_credentials');
  var t = JSON.parse(r.getContentText());
  if (t.aud !== clientId || String(t.email_verified) !== 'true' || !t.email) fail_('bad_credentials');
  if (Number(t.exp) * 1000 < Date.now()) fail_('bad_credentials');
  var email = String(t.email).toLowerCase();
  var s = rows_('Staff').filter(function (x) { return String(x.email).toLowerCase() === email && String(x.active) === '1'; })[0];
  if (!s) { audit_('system', 'staff_login_denied', email, ''); fail_('bad_credentials'); }
  var token = createSession_(String(s.staff_id), 'staff', ctx.data.device, 14);
  audit_(String(s.staff_id), 'staff_login', email, '');
  return { token: token, staff: { id: String(s.staff_id), name: String(s.name), role: String(s.role) } };
}

function requireStaff_(token) {
  if (!token || String(token).length !== 64) fail_('unauthorized');
  var h = hmacHex_('sess|' + token);
  var r = findRowFast_('AuthSessions', 'token_hash', h);
  if (!r || !safeEq_(r.token_hash, h) || String(r.revoked) === '1' || String(r.scope) !== 'staff' || String(r.expires_at) < now_()) fail_('unauthorized');
  var s = findRowFast_('Staff', 'staff_id', String(r.user_id));
  if (!s || String(s.active) !== '1') fail_('unauthorized');
  return s;
}

/** صلاحية دور: roles قائمة مثل ['admin','finance']. المدير 'admin' يمر دائما. */
function requireRole_(staff, roles) {
  var r = String(staff.role);
  if (r !== 'admin' && roles.indexOf(r) === -1) fail_('forbidden');
}
