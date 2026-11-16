/**
 * منصة BTL - مركز الإشعارات: كتالوج أحداث + قواعد قابلة للتعديل من الإدارة + مؤقّت + رسائل جماعية.
 * القاعدة (لكل حدث): مفعّل؟ إشعار الهاتف؟ تلغرام؟ نص العنوان والرسالة (مع متغيرات {name} {group}...) والتوقيت.
 * الافتراضات في الكتالوج أدناه، وما تعدّله الإدارة يُحفظ في ورقة NotifRules (يتغلب على الافتراضي).
 * الطفل: يصل الإشعار إلى ولي أمره (حسابه الأساسي) مع اسم الطفل في الرسالة.
 */
var NOTIF_CATALOG_ = [
  // ---- الطالب
  { event: 'payment_received', aud: 'student', label: 'وصلنا وصل الدفع', desc: 'فور رفع الوصل.', title: 'وصلنا وصلك', body: 'تتحقق الإدارة من وصلك الآن، وسنُعلمك فور التأكيد.', url: 'home', push: 1, tg: 1, on: 1 },
  { event: 'payment_confirmed', aud: 'student', label: 'تأكيد الاشتراك', desc: 'عند تأكيد الإدارة للدفع.', title: 'تم تأكيد اشتراكك', body: 'فوجك {group} يبدأ {date}. ستجد رابط مجموعة تلغرام في منصتك.', url: 'home', push: 1, tg: 1, on: 1 },
  { event: 'payment_rejected', aud: 'student', label: 'رفض الوصل', desc: 'عند رفض الإدارة للوصل مع السبب.', title: 'لم نتمكن من تأكيد الدفع', body: '{note} يمكنك رفع وصل جديد من حالة اشتراكك.', url: 'pay', push: 1, tg: 1, on: 1 },
  { event: 'order_expiring', aud: 'student', label: 'قرب انتهاء حجز المقعد', desc: 'قبل انتهاء الطلب غير المدفوع بعدد الساعات المحدد.', title: 'مقعدك سينتهي حجزه قريبا', body: 'مقعدك في {group} محجوز لمدة {hours} ساعات فقط، أكمل الدفع كي لا يضيع.', url: 'pay', push: 1, tg: 1, on: 1, timing: { key: 'hours', label: 'قبل الانتهاء بـ (ساعات)', def: 12 } },
  { event: 'order_expired', aud: 'student', label: 'انتهاء حجز المقعد', desc: 'عند إلغاء الطلب تلقائيا لانتهاء مدته.', title: 'انتهى حجز مقعدك', body: 'انتهت مدة طلبك. يمكنك التسجيل من جديد متى شئت.', url: 'home', push: 1, tg: 1, on: 1 },
  { event: 'group_start_soon', aud: 'student', label: 'قرب بداية الفوج', desc: 'قبل أول حصة بعدد الأيام المحدد (يُرسل بعد التاسعة صباحا).', title: 'فوجك يبدأ قريبا', body: '{group} يبدأ {date} الساعة {time}. استعد!', url: 'home', push: 1, tg: 1, on: 1, timing: { key: 'days', label: 'قبل البداية بـ (أيام)', def: 1 } },
  { event: 'session_reminder', aud: 'student', label: 'تذكير قبل كل حصة', desc: 'قبل موعد كل حصة بعدد الدقائق المحدد.', title: 'حصتك تبدأ بعد {minutes} دقيقة', body: '{group} · الرابط جاهز في مجموعة الفوج.', url: 'home', push: 1, tg: 1, on: 1, timing: { key: 'minutes', label: 'قبل الحصة بـ (دقائق)', def: 15 } },
  { event: 'renewal_offer', aud: 'student', label: 'عرض التجديد المبكر', desc: 'مرة واحدة لكل مستوى عند بلوغ نسبة التقدم المحددة في الإعدادات.', title: 'عرض خاص لك', body: 'خصم {pct}% عند تجديد مستواك مبكرا.', url: 'home', push: 1, tg: 1, on: 1 },
  { event: 'abandoned_test', aud: 'student', label: 'تذكير بإكمال اختبار المستوى', desc: 'لمن سجّل ولم يُجرِ اختبارا بعد مضي عدد الساعات المحدد (مرة واحدة).', title: 'أكمل اختبار مستواك', body: 'اختبارك ينتظرك، 15 دقيقة فقط لتعرف فوجك المناسب.', url: 'home', push: 1, tg: 1, on: 0, timing: { key: 'hours', label: 'بعد التسجيل بـ (ساعات)', def: 24 } },
  // ---- المسجِّل (من يسجّل غيره)
  { event: 'invitee_tested', aud: 'payer', label: 'أنهى المدعو اختباره', desc: 'للمسجِّل، دون ذكر النتيجة.', title: 'أنهى {name} اختباره', body: 'يمكنك الآن متابعة التسجيل والدفع من سلتك.', url: 'cart', push: 1, tg: 1, on: 1 },
  { event: 'invitee_reminder', aud: 'payer', label: 'تذكير المسجِّل بمن لم يختبر', desc: 'حسب إعداد ساعات التذكير (test_remind_hours).', title: '{name} لم ينهِ اختباره بعد', body: 'ذكّره بإجراء اختبار المستوى ليكتمل تسجيلكما.', url: 'cart', push: 1, tg: 1, on: 1 },
  // ---- الإدارة (تلغرام فقط، لمن ربط حسابه بتلغرام في ورقة Staff)
  { event: 'staff_receipt_new', aud: 'staff', roles: ['finance', 'admin'], label: 'وصل جديد بانتظار التأكيد', desc: 'للماليين والمدير.', title: 'وصل جديد', body: '{name} · {amount} DA بانتظار التأكيد.', push: 0, tg: 1, on: 1 },
  { event: 'staff_receipt_stale', aud: 'staff', roles: ['finance', 'admin'], label: 'وصل تأخر تأكيده', desc: 'تذكير بعد مضي عدد الساعات المحدد دون تأكيد.', title: 'وصل ينتظر التأكيد', body: '{name} · {amount} DA منذ أكثر من {hours} ساعات.', push: 0, tg: 1, on: 1, timing: { key: 'hours', label: 'بعد (ساعات)', def: 2 } },
  { event: 'staff_stop_request', aud: 'staff', roles: ['support', 'admin'], label: 'طلب توقف جديد', desc: 'عند إرسال طالب لسبب توقفه.', title: 'طلب توقف {type}', body: '{name} · {group}', push: 0, tg: 1, on: 1 },
  { event: 'staff_backup_failed', aud: 'staff', roles: ['admin'], label: 'فشل النسخ الاحتياطي', desc: 'للمدير فقط.', title: 'فشل النسخ الاحتياطي', body: '{error}', push: 0, tg: 1, on: 1 }
];
var NOTIF_AUD_ = { student: 'الطالب', payer: 'من يسجّل غيره', staff: 'الإدارة' };

// ---------- القواعد ----------
function notifSheetEnsure_(name, cols) {
  var ss = db_(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold'); sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@'); }
}
function notifRuleRows_() {
  try { return rows_('NotifRules'); } catch (e) { try { notifSheetEnsure_('NotifRules', ['event', 'enabled', 'push', 'tg', 'title_tpl', 'body_tpl', 'timing', 'updated_at']); } catch (e2) {} return []; }
}
/** القاعدة الفعلية لحدث: الافتراضي مدموجا بتعديلات الإدارة. */
function notifRule_(event, rowsCache) {
  var c = NOTIF_CATALOG_.filter(function (x) { return x.event === event; })[0];
  if (!c) return null;
  var o = (rowsCache || notifRuleRows_()).filter(function (r) { return String(r.event) === event; })[0] || {};
  function flag(v, d) { return nz_(v) ? String(v) === '1' : !!d; }
  return { event: event, aud: c.aud, roles: c.roles || null, label: c.label, desc: c.desc, enabled: flag(o.enabled, c.on), push: flag(o.push, c.push), tg: flag(o.tg, c.tg),
    title: nz_(o.title_tpl) ? String(o.title_tpl) : c.title, body: nz_(o.body_tpl) ? String(o.body_tpl) : c.body, url: c.url || '',
    timing: c.timing ? { key: c.timing.key, label: c.timing.label, value: nz_(o.timing) ? Number(o.timing) : c.timing.def, def: c.timing.def } : null, custom: !!(nz_(o.title_tpl) || nz_(o.body_tpl)) };
}
function notifFill_(tpl, vars) { return String(tpl).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] === undefined || vars[k] === null ? '' : String(vars[k]); }); }

// ---------- الإرسال ----------
/** يوجّه الإشعار لولي الأمر إن كان المستلم طفلا. يعيد {user, prefix}. */
function notifRecipient_(userId) {
  var u = findRowFast_('Users', 'user_id', String(userId));
  if (!u) return null;
  if (nz_(u.guardian_id)) { var g = findRowFast_('Users', 'user_id', String(u.guardian_id)); if (g) return { user: g, prefix: '(' + String(u.name_latin).split(' ')[0] + ') ', child: u }; }
  return { user: u, prefix: '', child: null };
}
/** حدث لمستخدم: يحترم القاعدة (مفعّل/قنوات/نص). يعيد true إن أُرسل. */
function notifyEvent_(event, userId, vars, rulesCache) {
  var rule = notifRule_(event, rulesCache);
  if (!rule || !rule.enabled || rule.aud === 'staff') return false;
  var rc = notifRecipient_(userId);
  if (!rc) return false;
  vars = vars || {};
  if (!vars.name) vars.name = String((rc.child || rc.user).name_latin || '').split(' ')[0];
  var title = notifFill_(rule.title, vars), body = rc.prefix + notifFill_(rule.body, vars);
  notifyUser_(String(rc.user.user_id), event, title, body, rule.url, { push: rule.push, tg: rule.tg });
  return true;
}
/** حدث للإداريين (تلغرام): لكل إداري فعّال بدوره ضمن roles ومربوط بتلغرام. */
function notifyStaff_(event, vars) {
  var rule = notifRule_(event);
  if (!rule || !rule.enabled || rule.aud !== 'staff' || !rule.tg) return 0;
  var text = notifFill_(rule.title, vars || {}) + '\n' + notifFill_(rule.body, vars || {}), n = 0;
  rows_('Staff').forEach(function (s) {
    if (String(s.active) !== '1' || !nz_(s.telegram_id)) return;
    if (rule.roles && String(s.role) !== 'admin' && rule.roles.indexOf(String(s.role)) < 0) return;
    try { tg_('sendMessage', { chat_id: String(s.telegram_id), text: text }); n++; } catch (e) { log_('notify_staff_error', event, String(e)); }
  });
  return n;
}

// ---------- مؤقّت (كل 10 دقائق) ----------
function notifLogRows_() { try { return rows_('NotifLog'); } catch (e) { try { notifSheetEnsure_('NotifLog', ['key', 'at']); } catch (e2) {} return []; } }
function notifTick_() {
  var now = now_(), today = todayYmd_(), nowMin = Number(now.slice(11, 13)) * 60 + Number(now.slice(14, 16)), hour = Math.floor(nowMin / 60);
  var rcache = notifRuleRows_(), done = {};
  notifLogRows_().forEach(function (r) { done[String(r.key)] = 1; });
  function once(key) { if (done[key]) return false; done[key] = 1; try { appendRow_('NotifLog', { key: key, at: now }); } catch (e) {} return true; }
  function R(ev) { var r = notifRule_(ev, rcache); return r && r.enabled ? r : null; }
  var quiet = hour >= Number(getSetting_('notif_quiet_from', 22)) || hour < Number(getSetting_('notif_quiet_to', 7));
  var groups = rows_('Groups'), enr = rows_('Enrollments'), live = { confirmed: 1, active: 1 };
  function members(gid) { return enr.filter(function (e) { return String(e.group_id) === String(gid) && live[String(e.status)]; }); }
  // تذكير الحصة
  var rs = R('session_reminder');
  if (rs) groups.forEach(function (g) {
    if (['closed', 'cancelled', 'finished'].indexOf(String(g.status)) >= 0 || String(g.start_date) > today || (nz_(g.end_date) && String(g.end_date) < today)) return;
    parseJson_(g.schedule_json, []).forEach(function (s) {
      if (Number(s.d) !== dow_(today)) return;
      var hm = String(s.t).split(':'), st = Number(hm[0]) * 60 + Number(hm[1]), lead = rs.timing.value;
      if (nowMin >= st - lead && nowMin < st && once('sr|' + g.group_id + '|' + today + '|' + s.t)) members(g.group_id).forEach(function (e) { notifyEvent_('session_reminder', e.user_id, { group: g.code, minutes: st - nowMin > 0 ? Math.max(1, Math.round((st - nowMin) / 5) * 5) : lead, time: s.t }, rcache); });
    });
  });
  if (!quiet && hour >= 9) {
    var gs = R('group_start_soon');
    if (gs) groups.forEach(function (g) { if (String(g.start_date) === addDays_(today, gs.timing.value) && ['closed', 'cancelled'].indexOf(String(g.status)) < 0 && once('gs|' + g.group_id)) {
      var sch = parseJson_(g.schedule_json, []), first = sch.filter(function (s) { return Number(s.d) === dow_(String(g.start_date)); })[0] || sch[0] || {};
      members(g.group_id).forEach(function (e) { notifyEvent_('group_start_soon', e.user_id, { group: g.code, date: String(g.start_date), time: first.t || '' }, rcache); }); } });
    var oe = R('order_expiring');
    if (oe) rows_('Orders').forEach(function (o) {
      if (String(o.status) !== 'checkout' || !nz_(o.expires_at)) return;
      var left = secBetween_(now, String(o.expires_at)) / 3600;
      if (left > 0 && left <= oe.timing.value && once('oe|' + o.order_id)) notifyEvent_('order_expiring', o.payer_user_id, { group: parseJson_(o.lines_json, []).map(function (l) { return l.group_code; }).join(' + '), hours: Math.max(1, Math.round(left)) }, rcache);
    });
    if (hour >= 10 && R('renewal_offer')) {
      var cnt = 0;
      enr.forEach(function (e) {
        if (cnt >= 40 || !live[String(e.status)] || done['rn|' + e.enroll_id]) return;
        var u = findRowFast_('Users', 'user_id', String(e.user_id));
        if (u && renewalOf_(u, e.enroll_id) && once('rn|' + e.enroll_id)) { cnt++; notifyEvent_('renewal_offer', e.user_id, { pct: getSetting_('early_renewal_pct', 5) }, rcache); }
      });
    }
    var ab = R('abandoned_test');
    if (ab) {
      var tested = {}; rows_('Tests').forEach(function (t) { tested[String(t.user_id)] = 1; });
      var c2 = 0;
      rows_('Users').forEach(function (u) {
        if (c2 >= 30 || String(u.role) !== 'student' || nz_(u.guardian_id) || !nz_(u.languages) || tested[String(u.user_id)] || !nz_(u.created_at)) return;
        var age = secBetween_(String(u.created_at), now) / 3600;
        if (age >= ab.timing.value && age < 24 * 7 && once('ab|' + u.user_id)) { c2++; notifyEvent_('abandoned_test', u.user_id, {}, rcache); }
      });
    }
    var st = R('staff_receipt_stale');
    if (st) rows_('Payments').forEach(function (p) {
      if (String(p.status) !== 'pending' || !nz_(p.submitted_at)) return;
      if (secBetween_(String(p.submitted_at), now) / 3600 >= st.timing.value && once('rs|' + p.payment_id)) {
        var u = findRowFast_('Users', 'user_id', String(p.user_id));
        notifyStaff_('staff_receipt_stale', { name: u ? String(u.name_latin) : '', amount: fmtDA_(Number(p.amount) || 0), hours: st.timing.value });
      }
    });
  }
  // تنظيف السجل (أقدم من 20 يوما)
  if (hour === 4) notifLogRows_().filter(function (r) { return String(r.at) < addDays_(today, -20); }).reverse().forEach(function (r) { try { db_().getSheetByName('NotifLog').deleteRow(r._row); } catch (e) {} });
}

// ---------- أفعال الإدارة (مدير فقط) ----------
function act_staffNotifList_(ctx) {
  requireRole_(ctx.staff, []);
  var rc = notifRuleRows_();
  return { rules: NOTIF_CATALOG_.map(function (c) { var r = notifRule_(c.event, rc); r.aud_label = NOTIF_AUD_[c.aud]; r.default_title = c.title; r.default_body = c.body; return r; }),
    vars: ['name', 'group', 'date', 'time', 'minutes', 'hours', 'note', 'amount', 'pct'], quiet: { from: Number(getSetting_('notif_quiet_from', 22)), to: Number(getSetting_('notif_quiet_to', 7)) } };
}
/** staff_notif_save: data {event, enabled?, push?, tg?, title?, body?, timing?, reset?}. */
function act_staffNotifSave_(ctx) {
  requireRole_(ctx.staff, []);
  var d = ctx.data, ev = String(d.event || ''), c = NOTIF_CATALOG_.filter(function (x) { return x.event === ev; })[0];
  if (!c) fail_('not_found');
  var rows = notifRuleRows_(), cur = rows.filter(function (r) { return String(r.event) === ev; })[0];
  var rec = { event: ev, enabled: d.enabled ? '1' : '0', push: d.push ? '1' : '0', tg: d.tg ? '1' : '0', title_tpl: '', body_tpl: '', timing: '', updated_at: now_() };
  if (c.aud === 'staff') rec.push = '0';
  if (!d.reset) {
    var t = String(d.title === undefined ? '' : d.title).slice(0, 120), b = String(d.body === undefined ? '' : d.body).slice(0, 400);
    rec.title_tpl = t === c.title ? '' : t; rec.body_tpl = b === c.body ? '' : b;
    if (c.timing && nz_(d.timing)) { var n = Number(d.timing); if (!(n > 0 && n <= 1000)) fail_('bad_value'); rec.timing = n === c.timing.def ? '' : String(n); }
  } else { rec.enabled = c.on ? '1' : '0'; rec.push = String(c.push); rec.tg = String(c.tg); }
  if (cur) updateRow_('NotifRules', cur._row, rec); else appendRow_('NotifRules', rec);
  audit_(String(ctx.staff.staff_id), 'notif_rule_save', ev, (rec.enabled === '1' ? 'on' : 'off') + ' push=' + rec.push + ' tg=' + rec.tg);
  return notifRule_(ev);
}
/** staff_notif_broadcast: data {audience:{type:'subscribed'|'language'|'group'|'all', value?}, title, body, push, tg}. رسالة جماعية يدوية. */
function act_staffNotifBroadcast_(ctx) {
  requireRole_(ctx.staff, []);
  var d = ctx.data, a = d.audience || {}, title = String(d.title || '').trim().slice(0, 120), body = String(d.body || '').trim().slice(0, 400);
  if (!title || !body) fail_('bad_value');
  var users = rows_('Users').filter(function (u) { return String(u.role) === 'student'; }), ids = {};
  if (a.type === 'subscribed') users = users.filter(function (u) { return String(u.status) === 'subscribed'; });
  else if (a.type === 'language' || a.type === 'group') {
    var gs = rows_('Groups').filter(function (g) { return a.type === 'language' ? String(g.language) === String(a.value).toUpperCase() : String(g.code) === String(a.value); }), gmap = {};
    gs.forEach(function (g) { gmap[String(g.group_id)] = 1; });
    var who = {}; rows_('Enrollments').forEach(function (e) { if (gmap[String(e.group_id)] && (String(e.status) === 'confirmed' || String(e.status) === 'active')) who[String(e.user_id)] = 1; });
    users = users.filter(function (u) { return who[String(u.user_id)]; });
  } else if (a.type !== 'all') fail_('bad_value');
  var sent = 0, max = Number(getSetting_('broadcast_max', 500));
  users.forEach(function (u) {
    var rc = notifRecipient_(String(u.user_id));
    if (!rc || ids[String(rc.user.user_id)] || sent >= max) return;
    ids[String(rc.user.user_id)] = 1; sent++;
    notifyUser_(String(rc.user.user_id), 'broadcast', title, body, 'home', { push: !!d.push, tg: !!d.tg });
  });
  audit_(String(ctx.staff.staff_id), 'notif_broadcast', String(a.type) + ':' + String(a.value || ''), title + ' (' + sent + ')');
  return { recipients: sent };
}
