/**
 * منصة BTL - اقتراح الفوج وإنشاؤه تلقائيا.
 * القواعد: لا تظهر عبارة «لا يوجد فوج» أبدا. إن لم يوجد فوج مفتوح للمستوى يُنشأ فوج جديد يكون صاحب الطلب أول المنضمين،
 * ويبدأ خلال 15 يوما كحد أقصى (group_start_gap_days ثم أقرب يوم من جدول الفوج).
 * المستوى الفرعي: نتيجة الاختبار تحدد المرحلة (مثل B1)، والفوج المتاح يحدد الفرعي: إن توفر .1 يُعرض .1، وإلا إن توفر .2 يُعرض،
 * وإن لم يتوفر شيء يُنشأ .1. الصغار: المستوى 1..6 يقابل K1..K6.
 * تفضّل القاعدة الفوج الأكثر امتلاء (يصل الحد الأدنى أسرع)، ولا يُعرض للعميل عدد الأعضاء بل نطاق فقط (available | few).
 */
var LEVELS_ = ['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2', 'B2.1', 'B2.2', 'C1.1', 'C1.2', 'C2.1', 'C2.2'];
var MONTHS_ = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
var SEAT_STATUSES_ = { reserved: 1, pending: 1, confirmed: 1, active: 1 };

// ---------- تواريخ (نص yyyy-MM-dd) ----------
function addDays_(ymd, n) { var d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function dow_(ymd) { return new Date(ymd + 'T00:00:00Z').getUTCDay(); }   // 0 = الأحد
function todayYmd_() { return String(now_()).slice(0, 10); }

/** أقرب يوم حصة بعد gapDays من اليوم، حسب جدول الفوج [{d:0..6,t:'HH:mm'}]. */
function nextStartDate_(todayStr, schedule, gapDays) {
  var days = {}; (schedule || []).forEach(function (s) { days[Number(s.d)] = true; });
  if (!Object.keys(days).length) return addDays_(todayStr, gapDays);
  for (var i = gapDays; i < gapDays + 7; i++) { var c = addDays_(todayStr, i); if (days[dow_(c)]) return c; }
  return addDays_(todayStr, gapDays);
}

// ---------- مستويات وأكواد ----------
function adultLevelPick_(stage, openLevels) {
  var a = stage + '.1', b = stage + '.2';
  if (openLevels[a]) return a;
  if (openLevels[b]) return b;
  return a;
}
function kidLevelCode_(n) { return 'K' + String(n); }

/** EN - B1.1 - NOV26 (وإن تكرر في الشهر نفسه: ...-2). */
function groupCode_(language, level, startYmd, taken) {
  var base = language + ' - ' + level + ' - ' + MONTHS_[Number(startYmd.slice(5, 7)) - 1] + startYmd.slice(2, 4), code = base, i = 2;
  while (taken[code]) { code = base + '-' + i; i++; }
  return code;
}

function seatsBand_(left, fewAt) { return left <= fewAt ? 'few' : 'available'; }

// ---------- القراءة ----------
function seatCounts_() {
  var m = {};
  rows_('Enrollments').forEach(function (e) { if (SEAT_STATUSES_[String(e.status)]) m[String(e.group_id)] = (m[String(e.group_id)] || 0) + 1; });
  return m;
}

/** أفواج مفتوحة للانضمام: status=open ولم تبدأ بعد وفيها مقعد. مرتبة بالأكثر امتلاء ثم الأبكر. */
function openGroups_(language, ageGroup, counts) {
  var today = todayYmd_();
  return rows_('Groups').filter(function (g) {
    return String(g.language) === language && String(g.age_group) === ageGroup && String(g.status) === 'open' && String(g.start_date) >= today && (counts[String(g.group_id)] || 0) < Number(g.seats_max || 12);
  }).sort(function (a, b) {
    var ca = counts[String(a.group_id)] || 0, cb = counts[String(b.group_id)] || 0;
    return cb - ca || (String(a.start_date) < String(b.start_date) ? -1 : 1);
  });
}

function scheduleFor_(ageGroup) {
  try { return JSON.parse(getSetting_(ageGroup === 'kids' ? 'group_schedule_kids' : 'group_schedule_adult', '[]')); } catch (e) { return []; }
}

function groupView_(g, isNew, left, ageGroup) {
  var kids = ageGroup === 'kids', price = itemPrice_({ type: 'group', ageGroup: ageGroup });
  var sched; try { sched = typeof g.schedule === 'object' ? g.schedule : JSON.parse(String(g.schedule_json || '[]')); } catch (e) { sched = []; }
  return { group_id: g.group_id ? String(g.group_id) : null, code: String(g.code), level: String(g.level), language: String(g.language), is_new: !!isNew,
    start_date: String(g.start_date), schedule: sched, per_week: sched.length || 2, hours: Number(getSetting_(kids ? 'level_hours_kids' : 'level_hours_adult', kids ? 36 : 48)),
    months: 3, price_cents: toCents_(price), price: fmtDA_(toCents_(price)), seats: seatsBand_(left, Number(getSetting_('group_few_left', 3))) };
}

/** مقترح الفوج لشخص ولغة. لا يكتب شيئا في الشيت. */
function suggestGroup_(subject, language) {
  var res = latestTestResult_(subject.user_id, language);
  if (!res) return { language: language, status: 'test_required' };
  var ageGroup = String(subject.age_group) === 'kids' ? 'kids' : 'adult', counts = seatCounts_(), open = openGroups_(language, ageGroup, counts);
  var openLevels = {}; open.forEach(function (g) { openLevels[String(g.level)] = true; });
  var level = ageGroup === 'kids' ? kidLevelCode_(res.level) : adultLevelPick_(res.level, openLevels);
  var cands = open.filter(function (g) { return String(g.level) === level; });
  var max = Number(getSetting_('group_max', 12));
  if (cands.length) { var g = cands[0]; return { language: language, status: 'ok', level_code: level, group: groupView_(g, false, Number(g.seats_max || max) - (counts[String(g.group_id)] || 0), ageGroup) }; }
  var sched = scheduleFor_(ageGroup), start = nextStartDate_(todayYmd_(), sched, Number(getSetting_('group_start_gap_days', 7)));
  var taken = {}; rows_('Groups').forEach(function (r) { taken[String(r.code)] = true; });
  var proto = { code: groupCode_(language, level, start, taken), level: level, language: language, start_date: start, schedule: sched };
  return { language: language, status: 'ok', level_code: level, group: groupView_(proto, true, max, ageGroup) };
}

/** group_suggest (مشارك أو جلسة اختبار): data {person_id?, languages?:['EN','FR']} -> مقترح لكل لغة. */
function act_groupSuggest_(ctx) {
  var s = testSubject_(ctx.user, ctx.data.person_id);
  if (!nz_(s.age_group)) fail_('profile_incomplete');
  var langs = ctx.data.languages ? cleanLangs_(ctx.data.languages) : cleanLangs_(String(s.languages).split(',').filter(Boolean));
  if (!langs) fail_('bad_languages');
  return langs.map(function (l) { return suggestGroup_(s, l); });
}

/** group_options (للزر «تغيير الفوج»): الأفواج المفتوحة في المستوى المقترح ومستوى واحد قبله وبعده. */
function act_groupOptions_(ctx) {
  var s = testSubject_(ctx.user, ctx.data.person_id), lang = String(ctx.data.language || '').toUpperCase();
  if (!LANGS[lang]) fail_('bad_language');
  var sug = suggestGroup_(s, lang);
  if (sug.status !== 'ok') return sug;
  var ageGroup = String(s.age_group) === 'kids' ? 'kids' : 'adult', counts = seatCounts_(), open = openGroups_(lang, ageGroup, counts);
  var order = ageGroup === 'kids' ? ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'] : LEVELS_, i = order.indexOf(sug.level_code);
  var near = {}; [i - 1, i, i + 1].forEach(function (k) { if (order[k]) near[order[k]] = true; });
  var list = open.filter(function (g) { return near[String(g.level)]; }).map(function (g) { return groupView_(g, false, Number(g.seats_max || 12) - (counts[String(g.group_id)] || 0), ageGroup); });
  if (sug.group.is_new) list.unshift(sug.group);
  return { language: lang, suggested_level: sug.level_code, groups: list };
}

/** يضمن وجود فوج مفتوح للمستوى (ينشئه إن لزم) ويعيد صفه. للاستعمال عند حجز مقعد (الطلبات). */
function ensureGroup_(language, levelCode, ageGroup) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var counts = seatCounts_(), open = openGroups_(language, ageGroup, counts).filter(function (g) { return String(g.level) === levelCode; });
    if (open.length) return { group: open[0], created: false };
    var sched = scheduleFor_(ageGroup), start = nextStartDate_(todayYmd_(), sched, Number(getSetting_('group_start_gap_days', 7)));
    var taken = {}; rows_('Groups').forEach(function (r) { taken[String(r.code)] = true; });
    var row = { group_id: uid_('g'), code: groupCode_(language, levelCode, start, taken), language: language, level: levelCode, sublevel: ageGroup === 'kids' ? '' : levelCode.slice(-1), age_group: ageGroup,
      teacher_id: '', start_date: start, end_date: addDays_(start, 83), schedule_json: JSON.stringify(sched), seats_min: String(getSetting_('group_min', 6)), seats_max: String(getSetting_('group_max', 12)),
      price: String(itemPrice_({ type: 'group', ageGroup: ageGroup })), status: 'open', created_at: now_() };
    appendRow_('Groups', row);
    audit_('system', 'group_auto_created', row.group_id, row.code);
    return { group: row, created: true };
  } finally { lock.releaseLock(); }
}
