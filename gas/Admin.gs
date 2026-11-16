/**
 * منصة BTL - مركز الإعدادات (للمدير فقط) والنسخ الاحتياطي اليومي.
 * كل قيمة قابلة للتعديل من الإعدادات؛ لا تُعرض الأسرار ولا يمكن إضافة مفاتيح جديدة من الواجهة.
 */
var SECRET_KEY_RE_ = /token|secret|pepper|password|private/i;
var SETTING_GROUPS_ = [
  ['pricing', 'الأسعار والخصومات', /^(price_|discount_|vip_|order_)/],
  ['test', 'الاختبار', /^test_/],
  ['groups', 'الأفواج والجداول', /^(group_|level_hours|session_hours|seats_)/],
  ['messages', 'الرسائل والتذكيرات', /^(msg_|outreach_|tg_link|test_remind)/],
  ['backup', 'النسخ الاحتياطي', /^backup_/],
  ['system', 'النظام', /./]
];

function settingDefaults_() { var m = {}; DEFAULT_SETTINGS.forEach(function (r) { m[r[0]] = { value: String(r[1]), label: String(r[2]) }; }); return m; }
function groupOfSetting_(key) { for (var i = 0; i < SETTING_GROUPS_.length; i++) if (SETTING_GROUPS_[i][2].test(key)) return SETTING_GROUPS_[i][0]; return 'system'; }
function settingKind_(def) { var d = String(def); if (/^-?\d+(\.\d+)?$/.test(d)) return 'number'; if (/^[\[{]/.test(d)) return 'json'; return 'text'; }

/** staff_settings_get: يعرض الإعدادات مجمّعة (القيمة الحالية + الافتراضية + الوصف). */
function act_staffSettingsGet_(ctx) {
  requireRole_(ctx.staff, []);
  var defs = settingDefaults_(), cur = {};
  rows_('Settings').forEach(function (r) { cur[String(r.key)] = String(r.value); });
  var groups = {};
  Object.keys(defs).forEach(function (k) {
    if (SECRET_KEY_RE_.test(k)) return;
    var g = groupOfSetting_(k); (groups[g] = groups[g] || []).push({ key: k, label: defs[k].label, value: cur[k] !== undefined ? cur[k] : defs[k].value, default: defs[k].value, kind: settingKind_(defs[k].value) });
  });
  return SETTING_GROUPS_.filter(function (g) { return groups[g[0]]; }).map(function (g) { return { id: g[0], title: g[1], items: groups[g[0]] }; });
}

/** staff_settings_set: data {changes:{key:value}}. يتحقق من النوع ثم يحفظ مع سجل تدقيق (القيمة القديمة والجديدة). */
function act_staffSettingsSet_(ctx) {
  requireRole_(ctx.staff, []);
  var ch = ctx.data.changes, defs = settingDefaults_();
  if (!ch || typeof ch !== 'object') fail_('bad_changes');
  var keys = Object.keys(ch);
  if (!keys.length || keys.length > 40) fail_('bad_changes');
  keys.forEach(function (k) {
    if (!defs[k] || SECRET_KEY_RE_.test(k)) fail_('unknown_setting');
    var v = String(ch[k]).trim(), kind = settingKind_(defs[k].value);
    if (v.length > 2000) fail_('bad_value');
    if (kind === 'number' && !/^-?\d+(\.\d+)?$/.test(v)) fail_('bad_value');
    if (kind === 'json') { try { JSON.parse(v); } catch (e) { fail_('bad_value'); } }
  });
  keys.forEach(function (k) {
    var old = getSetting_(k, defs[k].value), v = String(ch[k]).trim();
    if (old === v) return;
    setSetting_(k, v);
    audit_(String(ctx.staff.staff_id), 'setting_changed', k, old + ' -> ' + v);
  });
  return { saved: keys.length };
}

// ---------- النسخ الاحتياطي ----------
/** ينسخ ملف قاعدة البيانات إلى مجلد النسخ مرة كل يوم (في الساعة backup_hour) ويحذف الأقدم من backup_keep_days. */
function backupTick_() {
  if (String(getSetting_('backup_enabled', '1')) !== '1') return;
  var now = now_(), today = now.slice(0, 10), hour = Number(now.slice(11, 13));
  if (getSetting_('backup_last', '') === today || hour < Number(getSetting_('backup_hour', 3))) return;
  try {
    var file = DriveApp.getFileById(db_().getId()), fid = getSetting_('backup_folder_id', ''), folder = fid ? DriveApp.getFolderById(fid) : DriveApp.getRootFolder();
    file.makeCopy('BTL-backup-' + today, folder);
    setSetting_('backup_last', today);
    var keep = Number(getSetting_('backup_keep_days', 14)), cut = addDays_(today, -keep), it = folder.getFiles();
    while (it.hasNext()) { var f = it.next(), m = /^BTL-backup-(\d{4}-\d{2}-\d{2})$/.exec(f.getName()); if (m && m[1] < cut) f.setTrashed(true); }
    audit_('system', 'backup_done', today, '');
  } catch (e) { log_('backup_error', today, String(e)); audit_('system', 'backup_failed', today, String(e).slice(0, 200)); }
}

/** staff_inbox: أرقام «يحتاج إلى انتباهك» للوحة الإدارة (أي إداري فعّال). */
function act_staffInbox_(ctx) {
  var pay = rows_('Payments').filter(function (p) { return String(p.status) === 'pending'; }).length;
  var oc = rows_('Outreach').filter(function (r) { return OUTREACH_OPEN_[String(r.status)]; });
  var wait = Number(getSetting_('outreach_tg_wait_hours', 24)), now = now_();
  var urgent = oc.filter(function (r) { return String(r.channel_tried) === 'tg' && nz_(r.last_attempt_at) && secBetween_(String(r.last_attempt_at), now) >= wait * 3600; }).length;
  var open = rows_('Orders').filter(function (o) { return String(o.status) === 'open' || String(o.status) === 'checkout'; }).length;
  return { payments_pending: pay, outreach_pending: oc.length, outreach_urgent: urgent, orders_unpaid: open, stops_pending: stopsOpen_().length, stops_final: stopsOpen_().filter(function (s) { return String(s.stop_type) === 'final'; }).length, staff: { name: String(ctx.staff.name || ''), role: String(ctx.staff.role) } };
}

/** staff_logout: يُبطل جلسة الإداري الحالية. */
function act_staffLogout_(ctx) {
  var h = hmacHex_('sess|' + ctx.token), r = findRowFast_('AuthSessions', 'token_hash', h);
  if (r) { updateRow_('AuthSessions', r._row, { revoked: '1' }); try { revokeSessionCache_(h); } catch (e) {} }
  return { ok: true };
}

/** شغّلها يدويا مرة واحدة من المحرر بعد أي تحديث للصلاحيات: تطلب كل الأذونات (Drive وSheets والشبكة والمؤقّتات) دفعة واحدة. */
function authorizeAll() {
  var out = [];
  out.push('sheets: ' + SpreadsheetApp.getActiveSpreadsheet().getName());
  out.push('drive: ' + DriveApp.getRootFolder().getName());
  out.push('triggers: ' + ScriptApp.getProjectTriggers().length);
  out.push('fetch: ' + UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true }).getResponseCode());
  Logger.log(out.join('\n'));
}

/** طلبات التوقف التي لم تُتابَع بعد (المتابعة تُسجَّل في Audit بفعل stop_handled). */
function stopsHandledMap_() {
  var m = {}; rows_('Audit').forEach(function (r) { if (String(r.action) === 'stop_handled') m[String(r.target)] = { by: String(r.actor), note: String(r.details || ''), at: String(r.ts) }; });
  return m;
}
function stopsOpen_() { var h = stopsHandledMap_(); return rows_('StopReasons').filter(function (s) { return !h[String(s.stop_id)]; }); }

/** staff_stops_list: أسباب التوقف مع ملخص الأسباب. data {all?:bool} (افتراضيا غير المتابَعة ثم آخر 30 متابَعة). */
function act_staffStopsList_(ctx) {
  var h = stopsHandledMap_(), users = {}, groups = {}, enr = {};
  rows_('Users').forEach(function (u) { users[String(u.user_id)] = u; });
  rows_('Groups').forEach(function (g) { groups[String(g.group_id)] = g; });
  rows_('Enrollments').forEach(function (e) { enr[String(e.enroll_id)] = e; });
  var all = rows_('StopReasons').sort(function (a, b) { return String(b.created_at) < String(a.created_at) ? -1 : 1; }), counts = {};
  var list = all.map(function (s) {
    var u = users[String(s.user_id)] || {}, e = enr[String(s.enroll_id)] || {}, g = groups[String(e.group_id)] || {}, hd = h[String(s.stop_id)] || null, rs = parseJson_(s.reasons_json, []);
    rs.forEach(function (k) { counts[k] = (counts[k] || 0) + 1; });
    return { id: String(s.stop_id), person: { name: String(u.name_latin || ''), phone: String(u.phone || ''), telegram: nz_(u.telegram_id) }, group_code: String(g.code || ''), stop_type: String(s.stop_type), reasons: rs,
      resume_when: String(s.resume_when || ''), comment: String(s.comment || ''), created_at: String(s.created_at), handled: hd };
  });
  var open = list.filter(function (x) { return !x.handled; }), done = list.filter(function (x) { return x.handled; }).slice(0, 30);
  return { open: open, done: done, counts: counts, total: list.length };
}

/** staff_stop_done: تسجيل متابعة طلب توقف (اتصال/محاولة استرجاع). data {stop_id, note?}. */
function act_staffStopDone_(ctx) {
  var id = String(ctx.data.stop_id || ''), s = findRowFast_('StopReasons', 'stop_id', id);
  if (!s) fail_('not_found');
  if (stopsHandledMap_()[id]) fail_('not_allowed');
  audit_(String(ctx.staff.staff_id), 'stop_handled', id, String(ctx.data.note || '').slice(0, 200));
  return { ok: true };
}
