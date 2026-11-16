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
