/**
 * منصة BTL - الطلب (السلة) والدفع بالوصل ومراجعة الإدارة.
 * مسار الطلب: open (سلة قابلة للتعديل) -> checkout (تجميد الأسعار وحجز المقاعد وتحديد حساب CCP) -> paid_pending (رُفع الوصل)
 * -> paid (أكدت الإدارة). المرفوض يعود إلى checkout. الدفع من حساب واحد يعطي الخصم؛ من يدفع وحده ينشئ طلبه الخاص من جلسته.
 * كل المبالغ بالسنتيم (أعداد صحيحة نصا). الأسعار تُحسب في الخادم فقط. النتيجة الشخصية لا تُكشف لغير صاحبها.
 */
var ORDER_EDITABLE_ = { open: 1 };
var RECEIPT_MIME_ = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function lines_(o) { return parseJson_(o.lines_json, []); }

// ---------- أدوات ----------
/** الطلب المفتوح/المجمّد للدافع (واحد على الأكثر). */
function activeOrderOf_(userId) {
  var list = rows_('Orders').filter(function (o) { return String(o.payer_user_id) === String(userId) && (String(o.status) === 'open' || String(o.status) === 'checkout' || String(o.status) === 'paid_pending'); });
  return list.length ? list[list.length - 1] : null;
}

function enrollmentConflict_(personId, language, exceptOrderId) {
  return rows_('Enrollments').some(function (e) {
    if (String(e.user_id) !== String(personId) || String(e.order_id) === String(exceptOrderId)) return false;
    var s = String(e.status); if (!(s === 'reserved' || s === 'pending' || s === 'confirmed' || s === 'active')) return false;
    var g = findRowFast_('Groups', 'group_id', String(e.group_id));
    return g && String(g.language) === language;
  });
}

function stateOfLine_(person, language) {
  var sug = suggestGroup_(person, language);
  return sug.status === 'ok' ? { state: 'ready', sug: sug } : { state: 'waiting_test', sug: null };
}

function priceReady_(order, ready) {
  var items = ready.map(function (r, i) { return { ref: r.ref, type: 'group', language: r.language, ageGroup: String(r.person.age_group) === 'kids' ? 'kids' : 'adult', level: r.sug.level_code, groupCode: r.sug.group.code, amount: itemPrice_({ type: 'group', ageGroup: String(r.person.age_group) === 'kids' ? 'kids' : 'adult' }) }; });
  return items.length ? priceOrder_(items, rows_('Offers'), discountCfg_(), now_()) : null;
}

/** عرض الطلب للدافع: كل سطر بحالته، مع التسعير للأسطر الجاهزة. لا يُكشف مستوى أي شخص. */
function orderView_(o, user) {
  var ls = lines_(o), views = [], ready = [];
  var frozen = String(o.status) !== 'open';
  ls.forEach(function (l) {
    if (frozen) { views.push({ ref: l.ref, person_id: l.person_id, name: l.name, language: l.language, state: 'ready', group_code: l.group_code, start_date: l.start_date }); return; }
    var p = findRowFast_('Users', 'user_id', String(l.person_id));
    if (!p) return;
    var st = stateOfLine_(p, l.language), v = { ref: l.ref, person_id: String(p.user_id), name: String(p.name_latin), language: l.language, state: st.state };
    if (st.sug) { v.group_code = st.sug.group.code; v.start_date = st.sug.group.start_date; v.is_new = st.sug.group.is_new; v.seats = st.sug.group.seats; v.hours = st.sug.group.hours; v.per_week = st.sug.group.per_week; ready.push({ ref: l.ref, language: l.language, person: p, sug: st.sug }); }
    views.push(v);
  });
  var out = { order_id: String(o.order_id), status: String(o.status), lines: views, expires_at: String(o.expires_at) };
  var gross, disc, net, tier = 0;
  if (frozen) { var d = parseJson_(o.discount_json, {}); gross = Number(o.gross); disc = Number(o.discount); net = Number(o.net); tier = d.tierPct || 0; views.forEach(function (v, i) { var f = ls[i]; v.price = fmtDA_(Number(f.gross_cents)); v.net = fmtDA_(Number(f.net_cents)); v.discount_pct = f.pct; }); }
  else {
    var r = priceReady_(o, ready);
    gross = r ? r.grossCents : 0; disc = r ? r.discountCents : 0; net = r ? r.netCents : 0; tier = r ? r.tierPct : 0;
    if (r) r.lines.forEach(function (pl) { var v = views.filter(function (x) { return x.ref === pl.ref; })[0]; if (v) { v.price = fmtDA_(pl.grossCents); v.net = fmtDA_(pl.netCents); v.discount_pct = pl.pct; } });
  }
  out.gross = fmtDA_(gross); out.discount = disc ? fmtDA_(disc, true) : ''; out.net = fmtDA_(net); out.net_cents = net; out.tier_pct = tier;
  out.waiting = views.filter(function (v) { return v.state === 'waiting_test'; }).length;
  out.can_checkout = String(o.status) === 'open' && views.length > 0 && out.waiting === 0;
  return out;
}

// ---------- أفعال الدافع ----------
/** order_save: data {lines:[{person_id?, language}]}. يحفظ/يستبدل سلة الدافع المفتوحة (idempotent). */
function act_orderSave_(ctx) {
  var u = ctx.user, raw = ctx.data.lines;
  if (!Array.isArray(raw) || !raw.length || raw.length > 12) fail_('bad_lines');
  var cur = activeOrderOf_(u.user_id);
  if (cur && String(cur.status) !== 'open') fail_('order_locked');
  var seen = {}, lines = [];
  raw.forEach(function (l, i) {
    var p = testSubject_(u, l.person_id), lang = String(l.language || '').toUpperCase();
    if (!LANGS[lang]) fail_('bad_language');
    if (String(p.languages).split(',').indexOf(lang) === -1) fail_('bad_language');
    var k = p.user_id + '|' + lang; if (seen[k]) fail_('duplicate_line'); seen[k] = true;
    if (enrollmentConflict_(p.user_id, lang, '')) fail_('already_enrolled');
    lines.push({ ref: 'l' + (i + 1), person_id: String(p.user_id), language: lang });
  });
  var exp = isoPlus_(Number(getSetting_('order_expire_hours', 72)) * 3600000), id;
  if (cur) { id = String(cur.order_id); updateRow_('Orders', cur._row, { lines_json: JSON.stringify(lines), updated_at: now_(), expires_at: exp }); }
  else { id = uid_('or'); appendRow_('Orders', { order_id: id, payer_user_id: String(u.user_id), status: 'open', lines_json: JSON.stringify(lines), created_at: now_(), updated_at: now_(), expires_at: exp }); }
  return orderView_(findRowFast_('Orders', 'order_id', id), u);
}

function act_orderGet_(ctx) {
  var o = activeOrderOf_(ctx.user.user_id);
  if (!o) return null;
  var v = orderView_(o, ctx.user);
  if (String(o.status) !== 'open') { v.account = accountView_(orderAccount_(o)); }
  return v;
}

function accountView_(a) { return a ? { label: String(a.label), ccp_number: String(a.ccp_number), rip: String(a.rip), holder_name: String(a.holder_name) } : null; }

/** order_drop_waiting: يحذف أسطر من لم ينهوا اختبارهم ليدفع الدافع عن الجاهزين الآن (يدفع الآخرون لاحقا من طلبهم). */
function act_orderDropWaiting_(ctx) {
  var o = activeOrderOf_(ctx.user.user_id);
  if (!o || String(o.status) !== 'open') fail_('not_found');
  var keep = lines_(o).filter(function (l) { var p = findRowFast_('Users', 'user_id', String(l.person_id)); return p && stateOfLine_(p, l.language).state === 'ready'; });
  if (!keep.length) fail_('nothing_ready');
  updateRow_('Orders', o._row, { lines_json: JSON.stringify(keep), updated_at: now_() });
  return orderView_(findRowFast_('Orders', 'order_id', String(o.order_id)), ctx.user);
}

/** يختار حساب CCP: الأقل استلاما (طلبات قيد الدفع/المؤكدة آخر 7 أيام) بين الحسابات الفعّالة، ثم الأصغر ترتيبا. */
function ensureAccountIds_() {
  rows_('PayAccounts').forEach(function (a) { if (!nz_(a.account_id)) updateRow_('PayAccounts', a._row, { account_id: uid_('acc') }); });
}
/** حساب الطلب: يُصلح الطلب الذي بلا حساب (صفوف قديمة بلا معرّف) بإسناد حساب فعّال. */
function orderAccount_(o) {
  var acc = nz_(o.account_id) ? findRowFast_('PayAccounts', 'account_id', String(o.account_id)) : null;
  if (!acc) { acc = pickPayAccount_(); updateRow_('Orders', o._row, { account_id: String(acc.account_id) }); o.account_id = String(acc.account_id); }
  return acc;
}
function pickPayAccount_() {
  ensureAccountIds_();
  var accs = rows_('PayAccounts').filter(function (a) { return String(a.active) === '1' && nz_(a.account_id); });
  if (!accs.length) fail_('no_pay_account');
  var since = isoAdd_(now_(), -7 * 86400000), load = {};
  rows_('Payments').forEach(function (p) { if (String(p.submitted_at) >= since && String(p.status) !== 'rejected') load[String(p.account_id)] = (load[String(p.account_id)] || 0) + 1; });
  accs.sort(function (a, b) { return (load[String(a.account_id)] || 0) - (load[String(b.account_id)] || 0) || Number(a.sort || 0) - Number(b.sort || 0); });
  return accs[0];
}

/** order_checkout: يجمّد الأسعار ويحجز المقاعد (ينشئ الفوج الناقص) ويحدد حساب الدفع. */
function act_orderCheckout_(ctx) {
  var o = activeOrderOf_(ctx.user.user_id);
  if (!o || String(o.status) !== 'open') fail_('not_found');
  if (String(getSetting_('payments_open', '1')) !== '1') fail_('payments_closed');
  var view = orderView_(o, ctx.user);
  if (!view.can_checkout) fail_('not_ready');
  var ls = lines_(o), ready = [];
  ls.forEach(function (l) { var p = findRowFast_('Users', 'user_id', String(l.person_id)); var st = stateOfLine_(p, l.language); if (enrollmentConflict_(p.user_id, l.language, String(o.order_id))) fail_('line_taken'); ready.push({ ref: l.ref, language: l.language, person: p, sug: st.sug }); });
  var acc = pickPayAccount_(), r = priceReady_(o, ready), frozen = [];
  ready.forEach(function (x, i) {
    var age = String(x.person.age_group) === 'kids' ? 'kids' : 'adult', g = ensureGroup_(x.language, x.sug.level_code, age).group, pl = r.lines[i], kids = age === 'kids';
    var eid = uid_('en'), total = Math.round(Number(getSetting_(kids ? 'level_hours_kids' : 'level_hours_adult', kids ? 36 : 48)) / Number(getSetting_(kids ? 'session_hours_kids' : 'session_hours_adult', kids ? 1.5 : 2)));
    appendRow_('Enrollments', { enroll_id: eid, user_id: String(x.person.user_id), group_id: String(g.group_id), status: 'reserved', price: String(pl.netCents), discount_pct: String(pl.pct), discount_reason: pl.reason, early_renewal: '0', created_at: now_(), sessions_done: '0', sessions_total: String(total), order_id: String(o.order_id), gross_price: String(pl.grossCents), offer_id: pl.offerId });
    frozen.push({ ref: x.ref, person_id: String(x.person.user_id), name: String(x.person.name_latin), language: x.language, group_id: String(g.group_id), group_code: String(g.code), start_date: String(g.start_date), level: x.sug.level_code,
      gross_cents: pl.grossCents, pct: pl.pct, reason: pl.reason, offer_id: pl.offerId, discount_cents: pl.discountCents, net_cents: pl.netCents, enroll_id: eid });
  });
  updateRow_('Orders', o._row, { status: 'checkout', lines_json: JSON.stringify(frozen), gross: String(r.grossCents), discount: String(r.discountCents), net: String(r.netCents), discount_json: JSON.stringify({ tierPct: r.tierPct, offerIds: r.appliedOfferIds }),
    account_id: String(acc.account_id), updated_at: now_(), expires_at: isoPlus_(Number(getSetting_('order_expire_hours', 72)) * 3600000) });
  audit_(String(ctx.user.user_id), 'order_checkout', String(o.order_id), 'net=' + r.netCents);
  var out = orderView_(findRowFast_('Orders', 'order_id', String(o.order_id)), ctx.user); out.account = accountView_(acc);
  return out;
}

function cancelOrder_(o, newStatus, by) {
  rows_('Enrollments').filter(function (e) { return String(e.order_id) === String(o.order_id) && (String(e.status) === 'reserved'); }).forEach(function (e) { updateRow_('Enrollments', e._row, { status: 'cancelled', stopped_at: now_(), stop_type: newStatus }); });
  updateRow_('Orders', o._row, { status: newStatus, updated_at: now_() });
  audit_(by, 'order_' + newStatus, String(o.order_id), '');
}

/** order_cancel: إلغاء قبل رفع الوصل (يحرر المقاعد). */
function act_orderCancel_(ctx) {
  var o = activeOrderOf_(ctx.user.user_id);
  if (!o || String(o.status) === 'paid_pending') fail_('not_allowed');
  cancelOrder_(o, 'cancelled', String(ctx.user.user_id));
  return { ok: true };
}

// ---------- الوصل ----------
/** تخزين الوصل (Drive). تُستبدل في الاختبار. */
function receiptStore_(name, mime, b64) {
  var folderId = getSetting_('receipts_folder_id', ''), blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, name);
  var f = (folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder()).createFile(blob);
  return f.getId();
}
function receiptRead_(fileId) { var b = DriveApp.getFileById(fileId).getBlob(); return { mime: b.getContentType(), b64: Utilities.base64Encode(b.getBytes()) }; }

/** يرسل الوصل إلى مجموعة صاحب الحساب في تلغرام (لا يُفشل الرفع إن تعذر). */
function forwardReceipt_(acc, order, fileId, caption) {
  try { if (acc && nz_(acc.telegram_chat_id)) tgSendPhoto_(String(acc.telegram_chat_id), fileId, caption); } catch (e) { log_('receipt_forward_error', String(order.order_id), String(e)); }
}

/** order_receipt: data {order_id, image_base64, mime}. يرفع الوصل ويُدخل الطلب مراجعة الإدارة. */
function act_orderReceipt_(ctx) {
  var d = ctx.data, o = findRowFast_('Orders', 'order_id', String(d.order_id || ''));
  if (!o || String(o.payer_user_id) !== String(ctx.user.user_id)) fail_('not_found');
  if (String(o.status) !== 'checkout') fail_('not_allowed');
  var mime = String(d.mime || ''), b64 = String(d.image_base64 || '');
  if (!RECEIPT_MIME_[mime]) fail_('bad_file');
  if (b64.length < 200 || b64.length > 3000000 || !/^[A-Za-z0-9+\/=\s]+$/.test(b64)) fail_('bad_file');
  rateLimit_('receipt|' + ctx.user.user_id, 6, 3600);
  var fileId;
  try { fileId = receiptStore_('receipt-' + o.order_id + '-' + now_().replace(/[^0-9]/g, '') + '.' + RECEIPT_MIME_[mime], mime, b64.replace(/\s/g, '')); }
  catch (e) { log_('receipt_store_error', String(o.order_id), String(e)); fail_('storage_error'); }
  var pid = uid_('pay'), acc = orderAccount_(o);
  appendRow_('Payments', { payment_id: pid, user_id: String(o.payer_user_id), amount: String(o.net), method: 'ccp', account_id: String(o.account_id), receipt_file_id: fileId, status: 'pending', submitted_at: now_(), order_id: String(o.order_id) });
  updateRow_('Orders', o._row, { status: 'paid_pending', payment_id: pid, updated_at: now_() });
  var ls = lines_(o);
  rows_('Enrollments').filter(function (e) { return String(e.order_id) === String(o.order_id) && String(e.status) === 'reserved'; }).forEach(function (e) { updateRow_('Enrollments', e._row, { status: 'pending', payment_id: pid }); });
  ls.forEach(function (l) {
    var p = findRowFast_('Users', 'user_id', String(l.person_id));
    if (p) { updateRow_('Users', p._row, { status: 'pending_payment' }); if (!nz_(p.guardian_id) && String(p.user_id) !== String(o.payer_user_id)) { if (!rows_('Outreach').some(function (r) { return String(r.user_id) === String(p.user_id) && String(r.kind) === 'code_ready' && OUTREACH_OPEN_[String(r.status)]; })) outreachCreate_(p.user_id, 'code_ready', ''); } }
  });
  var payer = findRowFast_('Users', 'user_id', String(o.payer_user_id));
  forwardReceipt_(acc, o, fileId, 'وصل جديد · ' + String(payer ? payer.name_latin : '') + ' · ' + fmtDA_(Number(o.net)) + ' DA · ' + pid);
  audit_(String(ctx.user.user_id), 'receipt_uploaded', pid, String(o.order_id));
  return { payment_id: pid, status: 'pending' };
}

// ---------- الرمز ----------
function hasPaidAccess_(user) {
  var uid = String(user.user_id);
  var kids = rows_('Users').filter(function (r) { return String(r.guardian_id) === uid; }).map(function (r) { return String(r.user_id); });
  var mine = {}; mine[uid] = 1; kids.forEach(function (k) { mine[k] = 1; });
  var enr = rows_('Enrollments').some(function (e) { var s = String(e.status); return mine[String(e.user_id)] && (s === 'pending' || s === 'confirmed' || s === 'active'); });
  return enr || rows_('Orders').some(function (o) { return String(o.payer_user_id) === uid && (String(o.status) === 'paid_pending' || String(o.status) === 'paid'); });
}

/**
 * code_reveal (مشارك أو جلسة اختبار): data {regenerate?:true}. يُظهر رمز دخول صاحب الجلسة نفسه مرة واحدة (بعد رفع الوصل).
 * لا يُخزَّن الرمز الصريح. الرمز الضائع: regenerate (3 مرات يوميا) من جلسة قائمة.
 */
function act_codeReveal_(ctx) {
  var u = ctx.user;
  if (!hasPaidAccess_(u)) fail_('not_allowed');
  var has = nz_(u.code_hash);
  if (has && !ctx.data.regenerate) fail_('code_exists');
  rateLimit_('codereveal|' + u.user_id, 3, 86400);
  var code = issueAccessCode_(String(u.user_id));
  return { code: code, phone: phoneDisplay_(String(u.phone)), regenerated: has };
}

// ---------- الإدارة ----------
function financeGate_(ctx) { requireRole_(ctx.staff, ['finance']); }

function act_staffPaymentList_(ctx) {
  financeGate_(ctx);
  var out = rows_('Payments').filter(function (p) { return String(p.status) === 'pending'; }).map(function (p) {
    var o = findRowFast_('Orders', 'order_id', String(p.order_id)) || {}, payer = findRowFast_('Users', 'user_id', String(p.user_id)) || {}, acc = findRowFast_('PayAccounts', 'account_id', String(p.account_id)) || {};
    return { payment_id: String(p.payment_id), order_id: String(p.order_id), payer: String(payer.name_latin || ''), amount: fmtDA_(Number(p.amount)), account: String(acc.label || ''), submitted_at: String(p.submitted_at), hours: Math.round(secBetween_(String(p.submitted_at), now_()) / 3600),
      lines: lines_(o).map(function (l) { return { name: l.name, language: l.language, group_code: l.group_code, net: fmtDA_(Number(l.net_cents)), discount_pct: l.pct }; }) };
  });
  out.sort(function (a, b) { return a.submitted_at < b.submitted_at ? -1 : 1; });
  return out;
}

function act_staffPaymentReceipt_(ctx) {
  financeGate_(ctx);
  var p = findRowFast_('Payments', 'payment_id', String(ctx.data.payment_id || ''));
  if (!p) fail_('not_found');
  return receiptRead_(String(p.receipt_file_id));
}

/** staff_payment_review: data {payment_id, decision:'confirm'|'reject', note?}. */
function act_staffPaymentReview_(ctx) {
  financeGate_(ctx);
  var d = ctx.data, p = findRowFast_('Payments', 'payment_id', String(d.payment_id || ''));
  if (!p) fail_('not_found');
  if (String(p.status) !== 'pending') fail_('not_allowed');
  var o = findRowFast_('Orders', 'order_id', String(p.order_id)), by = String(ctx.staff.staff_id), payer = findRowFast_('Users', 'user_id', String(p.user_id)), ls = lines_(o);
  if (d.decision === 'reject') {
    var note = String(d.note || '').slice(0, 200);
    if (!note) fail_('note_required');
    updateRow_('Payments', p._row, { status: 'rejected', reviewed_by: by, reviewed_at: now_(), note: note });
    updateRow_('Orders', o._row, { status: 'checkout', updated_at: now_() });
    rows_('Enrollments').filter(function (e) { return String(e.order_id) === String(o.order_id) && String(e.status) === 'pending'; }).forEach(function (e) { updateRow_('Enrollments', e._row, { status: 'reserved' }); });
    audit_(by, 'payment_rejected', String(p.payment_id), note);
    notifyUser_(String(p.user_id), 'payment_rejected', 'لم نتمكن من تأكيد الدفع', note + ' يمكنك رفع وصل جديد من حالة اشتراكك.', 'pay');
    return { status: 'rejected' };
  }
  if (d.decision !== 'confirm') fail_('bad_decision');
  updateRow_('Payments', p._row, { status: 'confirmed', reviewed_by: by, reviewed_at: now_() });
  updateRow_('Orders', o._row, { status: 'paid', updated_at: now_() });
  var today = now_().slice(0, 10), seats = 0;
  ls.forEach(function (l) {
    var e = findRowFast_('Enrollments', 'enroll_id', String(l.enroll_id));
    if (e) updateRow_('Enrollments', e._row, { status: 'confirmed', confirmed_by: by, confirmed_at: now_() });
    var person = findRowFast_('Users', 'user_id', String(l.person_id));
    if (person) updateRow_('Users', person._row, { status: 'subscribed' });
    var kids = person && String(person.age_group) === 'kids';
    appendRow_('Ledger', { entry_id: uid_('le'), entry_date: today, period: today.slice(0, 7), account_id: String(p.account_id), type: 'income', category: kids ? 'fees_kids' : 'fees_adult', method: 'ccp', amount: String(l.net_cents), status: 'confirmed',
      ref_type: 'enrollment', ref_id: String(l.enroll_id), user_id: String(l.person_id), counterparty: String(payer ? payer.name_latin : ''), note: String(o.order_id), created_by: by, created_at: now_(), confirmed_by: by, confirmed_at: now_() });
    seats++;
  });
  setSetting_('seats_since_founding', String(Number(getSetting_('seats_since_founding', 0)) + seats));
  audit_(by, 'payment_confirmed', String(p.payment_id), 'seats=' + seats);
  ls.forEach(function (l) { notifyUser_(String(l.person_id), 'payment_confirmed', 'تم تأكيد اشتراكك', 'فوجك ' + l.group_code + ' يبدأ ' + l.start_date + '. ستجد رابط مجموعة تلغرام في منصتك.', 'home'); });
  return { status: 'confirmed', seats: seats };
}

// ---------- مؤقّت ----------
/** ينهي الطلبات التي لم تُدفع في مهلتها ويحرر مقاعدها. paid_pending لا ينتهي (الإدارة هي من تحسم). */
function ordersTick_() {
  var now = now_();
  rows_('Orders').forEach(function (o) {
    var s = String(o.status);
    if ((s === 'open' || s === 'checkout') && nz_(o.expires_at) && String(o.expires_at) <= now) cancelOrder_(o, 'expired', 'system');
  });
}
function hourlyTick_() { invitesTick_(); ordersTick_(); backupTick_(); }
