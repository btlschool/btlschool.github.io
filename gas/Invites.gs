/**
 * منصة BTL - دعوات الاختبار وقائمة «بانتظار التواصل» للإدارة.
 * المسجِّل يضيف بالغا آخر (اسمه وهاتفه الخاص). الاختبار إما فورا على جهاز المسجِّل (mode=device) أو تتولى الإدارة
 * إرسال رابطه (mode=admin): تلغرام أولا ثم واتساب. كل شخص يجري اختباره ويرى رمزه ونتيجته على هاتفه، والمسجِّل لا يرى النتيجة.
 * الأسرار: رمز الرابط يُخزَّن مُجزَّأ (HMAC) فقط، ويُجدَّد كلما أعدّت الإدارة إرساله (الرابط القديم يبطل).
 */
var OUTREACH_OPEN_ = { pending: 1, sent: 1 };

function appUrl_() { return String(getSetting_('app_url', 'https://btlschool.github.io/')).replace(/\/?$/, '/'); }
function fillTpl_(tpl, vars) { return String(tpl).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] === undefined ? m : vars[k]; }); }
function newTgToken_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 24); }

// ---------- إشعار عام (داخل التطبيق + تلغرام إن وُجد) ----------
function notifyUser_(userId, type, title, body, url) {
  appendRow_('Notifications', { notif_id: uid_('n'), user_id: String(userId), type: type, title: title, body: body, url: url || '', created_at: now_(), status: 'pending' });
  try {
    var u = findRowFast_('Users', 'user_id', String(userId));
    if (u && nz_(u.telegram_id)) tg_('sendMessage', { chat_id: String(u.telegram_id), text: title + '\n' + body });
  } catch (e) { log_('notify_tg_error', String(userId), String(e)); }
}

// ---------- طابور التواصل ----------
function outreachCreate_(userId, kind, refId) {
  appendRow_('Outreach', { outreach_id: uid_('o'), user_id: String(userId), kind: kind, ref_id: String(refId || ''), status: 'pending', channel_tried: '', created_at: now_() });
}
function outreachClose_(userId, kind, status, by, note) {
  rows_('Outreach').filter(function (r) { return String(r.user_id) === String(userId) && String(r.kind) === kind && OUTREACH_OPEN_[String(r.status)]; })
    .forEach(function (r) { updateRow_('Outreach', r._row, { status: status, done_at: now_(), done_by: by || '', note: note || '' }); });
}

// ---------- دعوة شخص آخر ----------
/**
 * invite_create (مشارك): data {name, gender, birthYear, languages, phone, country, mode:'device'|'admin'}
 * بالغ فقط (الأبناء عبر reg_add_child). الهاتف خاص به ويختلف عن هاتف المسجِّل وعن أي حساب قائم.
 */
function act_inviteCreate_(ctx) {
  var u = ctx.user, d = ctx.data;
  if (nz_(u.guardian_id)) fail_('forbidden');
  var name = cleanName_(d.name), g = String(d.gender), mode = String(d.mode);
  if (!name) fail_('bad_name');
  if (g !== 'M' && g !== 'F') fail_('bad_gender');
  if (mode !== 'device' && mode !== 'admin') fail_('bad_mode');
  var phone = normPhone_(d.phone, d.country || u.country);
  if (!phone) fail_('bad_phone');
  if (phone === String(u.phone)) fail_('same_phone');
  var info = ageInfo_(d.birthYear, Number(Utilities.formatDate(new Date(), 'Africa/Algiers', 'yyyy')), ageCfg_());
  if (!info || info.group !== 'adult') fail_('bad_birth_year');
  var langs = cleanLangs_(d.languages);
  if (!langs) fail_('bad_languages');
  rateLimit_('invite|' + u.user_id, 8, 86400);
  if (findPrimaryByPhone_(phone)) fail_('phone_taken');
  var id = uid_('u'), inv = uid_('i'), hours = Number(getSetting_('test_invite_hours', 24));
  appendRow_('Users', { user_id: id, phone: phone, name_latin: name, gender: g, role: 'student', status: 'new', age_group: 'adult', birth_year: String(d.birthYear), languages: langs.join(','), source: 'invite', country: String(d.country || u.country || 'DZ').slice(0, 2).toUpperCase(), created_at: now_(), failed_logins: '0' });
  appendRow_('TestInvites', { invite_id: inv, order_id: '', user_id: id, phone: phone, created_by: String(u.user_id), created_at: now_(), expires_at: isoPlus_(hours * 3600000), reminders_sent: '0', status: 'waiting', mode: mode });
  if (mode === 'admin') outreachCreate_(id, 'test_link', inv);
  audit_(String(u.user_id), 'invite_create', id, mode);
  return { invite_id: inv, person_id: id, name: name, mode: mode, languages: langs, expires_at: isoPlus_(hours * 3600000) };
}

function inviteStatus_(inv) {
  var s = String(inv.status);
  if ((s === 'waiting' || s === 'opened') && String(inv.expires_at) <= now_()) return 'expired';
  return s;
}

/** invite_list (مشارك): دعواته. بلا أي نتيجة اختبار (خصوصية الشخص). */
function act_inviteList_(ctx) {
  var uid = String(ctx.user.user_id);
  return rows_('TestInvites').filter(function (r) { return String(r.created_by) === uid && String(r.status) !== 'cancelled'; }).map(function (r) {
    var p = findRowFast_('Users', 'user_id', String(r.user_id));
    return { invite_id: String(r.invite_id), person_id: String(r.user_id), name: p ? String(p.name_latin) : '', languages: p ? String(p.languages).split(',').filter(Boolean) : [],
      mode: String(r.mode), status: inviteStatus_(r), expires_at: String(r.expires_at) };
  });
}

function act_inviteCancel_(ctx) {
  var inv = findRowFast_('TestInvites', 'invite_id', String(ctx.data.invite_id || ''));
  if (!inv || String(inv.created_by) !== String(ctx.user.user_id)) fail_('not_found');
  if (String(inv.status) === 'tested') fail_('not_allowed');
  updateRow_('TestInvites', inv._row, { status: 'cancelled', token_hash: '', tg_hash: '' });
  outreachClose_(String(inv.user_id), 'test_link', 'cancelled', String(ctx.user.user_id), 'cancel');
  return { ok: true };
}

/** invite_open (عام): data {token, device}. يعيد جلسة اختبار (scope=test) للشخص المدعو. رد موحّد عند أي فشل. */
function act_inviteOpen_(ctx) {
  var tok = String(ctx.data.token || '');
  if (tok.length !== 64) fail_('invalid_link');
  rateLimit_('inviteopen', 600, 3600);
  var h = hmacHex_('inv|' + tok), inv = findRowFast_('TestInvites', 'token_hash', h);
  if (!inv || !safeEq_(String(inv.token_hash), h) || String(inv.status) === 'cancelled' || String(inv.expires_at) <= now_()) fail_('invalid_link');
  var u = findRowFast_('Users', 'user_id', String(inv.user_id));
  if (!u || String(u.status) === 'blocked') fail_('invalid_link');
  updateRow_('TestInvites', inv._row, { used_at: nz_(inv.used_at) ? inv.used_at : now_(), status: String(inv.status) === 'tested' ? 'tested' : 'opened' });
  var session = createSession_(String(u.user_id), 'test', ctx.data.device, 2);
  return { token: session, user: publicUser_(u) };
}

// ---------- الإدارة ----------
function staffGate_(ctx) { requireRole_(ctx.staff, ['support']); }

/** staff_outreach_list: من ينتظر تواصلا، الأحوج أولا. */
function act_staffOutreachList_(ctx) {
  staffGate_(ctx);
  var wait = Number(getSetting_('outreach_tg_wait_hours', 24)), now = now_();
  var out = rows_('Outreach').filter(function (r) { return OUTREACH_OPEN_[String(r.status)]; }).map(function (r) {
    var u = findRowFast_('Users', 'user_id', String(r.user_id)) || {}, inv = findRowFast_('TestInvites', 'invite_id', String(r.ref_id));
    var by = inv && nz_(inv.created_by) ? findRowFast_('Users', 'user_id', String(inv.created_by)) : null;
    var tgOn = nz_(u.telegram_id), tried = String(r.channel_tried), last = String(r.last_attempt_at || '');
    var staleTg = tried === 'tg' && last && secBetween_(last, now) >= wait * 3600;
    var suggested = (!tgOn || staleTg || tried === 'wa') ? 'wa' : 'tg';
    return { id: String(r.outreach_id), kind: String(r.kind), status: String(r.status), person: { id: String(r.user_id), name: String(u.name_latin || ''), phone: phoneDisplay_(String(u.phone || '')), telegram: tgOn },
      requested_by: by ? String(by.name_latin) : '', since: String(r.created_at), channel_tried: tried, last_attempt_at: last, suggested: suggested, urgent: !!staleTg };
  });
  out.sort(function (a, b) { return (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || (a.since < b.since ? -1 : 1); });
  return out;
}

/** يجدّد رابط الاختبار (يبطل القديم) ويعيد {link, tg_link}. */
function rotateInvite_(inv, wantTg) {
  var tok = newToken_(), patch = { token_hash: hmacHex_('inv|' + tok), expires_at: isoPlus_(Number(getSetting_('test_invite_hours', 24)) * 3600000) };
  if (String(inv.status) === 'expired' || String(inv.status) === 'waiting') patch.status = 'waiting';
  var out = { link: appUrl_() + 't.html#' + tok, tg_link: '' };
  if (wantTg) {
    var tg = newTgToken_();
    patch.tg_hash = hmacHex_('tg|' + tg); patch.tg_expires = isoPlus_(Number(getSetting_('tg_link_days', 7)) * 86400000);
    out.tg_link = 'https://t.me/' + String(getSetting_('bot_username', 'BTLSchoolBot')) + '?start=i_' + tg;
  }
  updateRow_('TestInvites', inv._row, patch);
  return out;
}

var MSG_DEFAULTS_ = {
  msg_invite_link: 'السلام عليكم {name}، سجّلك {inviter} في مدرسة BTL Languages. اضغط هنا لإجراء اختبار تحديد المستوى (15 دقيقة) وهو صالح 24 ساعة:\n{link}',
  msg_invite_tg: '\nولتصلك تنبيهاتنا على تلغرام اضغط:\n{tg}',
  msg_code_ready: 'السلام عليكم {name}، تم تأكيد اشتراكك في مدرسة BTL Languages. افتح رابطك لترى رمز دخولك الخاص:\n{link}'
};

/** staff_outreach_prepare: data {outreach_id, channel:'tg'|'wa'}. tg: يرسل عبر البوت. wa: يعيد رابط واتساب جاهزا. */
function act_staffOutreachPrepare_(ctx) {
  staffGate_(ctx);
  var o = findRowFast_('Outreach', 'outreach_id', String(ctx.data.outreach_id || '')), ch = String(ctx.data.channel);
  if (!o || !OUTREACH_OPEN_[String(o.status)]) fail_('not_found');
  if (ch !== 'tg' && ch !== 'wa') fail_('bad_channel');
  var u = findRowFast_('Users', 'user_id', String(o.user_id));
  var inv = findRowFast_('TestInvites', 'invite_id', String(o.ref_id)) || rows_('TestInvites').filter(function (r) { return String(r.user_id) === String(o.user_id) && String(r.status) !== 'cancelled'; })[0];
  if (!u || !inv) fail_('not_found');
  var by = nz_(inv.created_by) ? findRowFast_('Users', 'user_id', String(inv.created_by)) : null;
  var tgOn = nz_(u.telegram_id);
  if (ch === 'tg' && !tgOn) fail_('telegram_not_linked');
  var kind = String(o.kind), r = rotateInvite_(inv, ch === 'wa' && !tgOn);
  var vars = { name: String(u.name_latin), inviter: by ? String(by.name_latin) : '', link: r.link, tg: r.tg_link };
  var text = fillTpl_(getSetting_(kind === 'code_ready' ? 'msg_code_ready' : 'msg_invite_link', MSG_DEFAULTS_[kind === 'code_ready' ? 'msg_code_ready' : 'msg_invite_link']), vars);
  if (ch === 'wa' && r.tg_link && kind === 'test_link') text += fillTpl_(getSetting_('msg_invite_tg', MSG_DEFAULTS_.msg_invite_tg), vars);
  var by_ = String(ctx.staff.staff_id);
  if (ch === 'tg') {
    var res = tg_('sendMessage', { chat_id: String(u.telegram_id), text: text, reply_markup: { inline_keyboard: [[{ text: kind === 'code_ready' ? 'افتح رابطك' : 'ابدأ اختبار المستوى', url: r.link }]] } });
    if (!res || !res.ok) return { sent: false, fallback: 'wa' };
    updateRow_('Outreach', o._row, { status: 'sent', channel_tried: 'tg', last_attempt_at: now_() });
    audit_(by_, 'outreach_tg', String(o.user_id), kind);
    return { sent: true };
  }
  updateRow_('Outreach', o._row, { status: 'sent', channel_tried: 'wa', last_attempt_at: now_() });
  audit_(by_, 'outreach_wa', String(o.user_id), kind);
  return { wa_url: 'https://wa.me/' + String(u.phone).replace(/\D/g, '') + '?text=' + encodeURIComponent(text), message: text };
}

function act_staffOutreachDone_(ctx) {
  staffGate_(ctx);
  var o = findRowFast_('Outreach', 'outreach_id', String(ctx.data.outreach_id || ''));
  if (!o) fail_('not_found');
  updateRow_('Outreach', o._row, { status: 'done', done_at: now_(), done_by: String(ctx.staff.staff_id), note: String(ctx.data.note || '').slice(0, 200) });
  return { ok: true };
}

// ---------- ربط تلغرام برابط شخصي (بلا مشاركة رقم) ----------
/** يُستدعى من البوت عند /start i_<token>. يربط تلغرام بالشخص المدعو ثم يرسل له رابط اختباره فورا. */
function tgBindInvite_(m, tgTok) {
  var chat = m.chat.id, fromId = String(m.from.id);
  var inv = /^[0-9a-f]{24}$/.test(tgTok) ? findRowFast_('TestInvites', 'tg_hash', hmacHex_('tg|' + tgTok)) : null;
  if (!inv || String(inv.status) === 'cancelled' || String(inv.tg_expires) <= now_()) { tg_('sendMessage', { chat_id: chat, text: 'انتهت صلاحية هذا الرابط. تواصل معنا ليُرسَل لك رابط جديد.' }); return; }
  var u = findRowFast_('Users', 'user_id', String(inv.user_id));
  if (!u) return;
  var dup = rows_('Users').filter(function (r) { return String(r.telegram_id) === fromId && String(r.user_id) !== String(u.user_id) && !nz_(r.guardian_id); })[0];
  if (dup || (nz_(u.telegram_id) && String(u.telegram_id) !== fromId)) { tg_('sendMessage', { chat_id: chat, text: 'تعذر ربط هذا الحساب. تواصل معنا وسنساعدك.' }); return; }
  updateRow_('Users', u._row, { telegram_id: fromId, telegram_username: String(m.from.username || '') });
  audit_('telegram', 'invite_bound', String(u.user_id), 'tg_id=' + fromId);
  var open = rows_('Outreach').filter(function (r) { return String(r.user_id) === String(u.user_id) && String(r.kind) === 'test_link' && OUTREACH_OPEN_[String(r.status)]; })[0];
  if (open && String(inv.status) !== 'tested') {
    var r = rotateInvite_(inv, false);
    tg_('sendMessage', { chat_id: chat, text: 'أهلا ' + String(u.name_latin) + '، ربطنا حسابك بتلغرام. هذا رابط اختبار تحديد مستواك (15 دقيقة):', reply_markup: { inline_keyboard: [[{ text: 'ابدأ اختبار المستوى', url: r.link }]] } });
    updateRow_('Outreach', open._row, { status: 'sent', channel_tried: 'tg', last_attempt_at: now_() });
  } else {
    tg_('sendMessage', { chat_id: chat, text: 'أهلا ' + String(u.name_latin) + '، ربطنا حسابك بتلغرام وستصلك تنبيهاتنا هنا.' });
  }
}

// ---------- ربط الحدث بنهاية الاختبار + التذكيرات ----------
/** يُستدعى بعد نهاية اختبار شخص (من Test.gs). يغلق الدعوة والطابور ويُعلم المسجِّل (دون النتيجة). */
function onTestFinished_(testRow) {
  var uid = String(testRow.user_id);
  var invs = rows_('TestInvites').filter(function (r) { return String(r.user_id) === uid && (String(r.status) === 'waiting' || String(r.status) === 'opened' || String(r.status) === 'expired'); });
  if (!invs.length) return;
  var inv = invs[invs.length - 1], p = findRowFast_('Users', 'user_id', uid);
  updateRow_('TestInvites', inv._row, { status: 'tested', used_at: nz_(inv.used_at) ? inv.used_at : now_() });
  outreachClose_(uid, 'test_link', 'done', 'system', 'auto');
  if (nz_(inv.created_by)) notifyUser_(String(inv.created_by), 'invitee_tested', 'أنهى ' + String(p ? p.name_latin : '') + ' اختباره', 'يمكنك الآن متابعة التسجيل والدفع من سلتك.', 'cart');
}

/** مؤقّت كل ساعة: تذكير المسجِّل (test_remind_hours) ثم إسقاط الدعوات المنتهية. */
function invitesTick_() {
  var hrs = String(getSetting_('test_remind_hours', '2,24')).split(',').map(Number).filter(function (x) { return x > 0; }), now = now_();
  rows_('TestInvites').forEach(function (r) {
    var s = String(r.status);
    if (s !== 'waiting' && s !== 'opened') return;
    var sent = Number(r.reminders_sent || 0), age = secBetween_(String(r.created_at), now) / 3600;
    if (sent < hrs.length && age >= hrs[sent] && nz_(r.created_by)) {
      var p = findRowFast_('Users', 'user_id', String(r.user_id));
      notifyUser_(String(r.created_by), 'invitee_reminder', String(p ? p.name_latin : '') + ' لم ينهِ اختباره بعد', 'ذكّره بإجراء اختبار المستوى ليكتمل تسجيلكما.', 'cart');
      updateRow_('TestInvites', r._row, { reminders_sent: String(sent + 1) });
    }
    if (String(r.expires_at) <= now) updateRow_('TestInvites', r._row, { status: 'expired' });
  });
}

/** شغّلها مرة واحدة: تنشئ المؤقّتات الدورية (كل ساعة: تذكيرات الدعوات وانتهاء الطلبات). النسخ الاحتياطي اليومي يُضاف لاحقا هنا. */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { var h = t.getHandlerFunction(); if (h === 'invitesTick_' || h === 'hourlyTick_') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('hourlyTick_').timeBased().everyHours(1).create();
  Logger.log('تم تثبيت المؤقّتات');
}
