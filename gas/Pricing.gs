/**
 * منصة BTL - محرك التسعير (دوال نقية بلا اعتماد على الشيت، قابلة للاختبار).
 * القواعد:
 *  - الخصم على الدروس الجماعية فقط؛ دروس VIP بلا خصم وتُجمع كما هي.
 *  - خصم الأفواج: بحسب عدد الأفواج الجماعية في الدفعة الواحدة (مستويان قابلان للضبط من الإعدادات).
 *  - العروض الموسمية: نسبة ونطاق ومدة؛ لكل بند يُطبَّق الأفضل للزبون من (خصم الأفواج، العروض) ولا يجتمعان.
 *  - تتحمل المدرسة الخصم: أجر الأستاذ يُحسب على السعر الكامل (gross) لا الصافي.
 *  - كل الحساب بالسنتيم (أعداد صحيحة) لتفادي أخطاء الكسور.
 */

/** pct: نسبة مئوية؛ amountCents: المبلغ بالسنتيم. يقرّب إلى أقرب سنتيم. */
function pctOfCents_(amountCents, pct) {
  return Math.round(amountCents * Number(pct) / 100);
}

/** يحوّل مبلغا بالدينار إلى سنتيم (إعدادات/أوراق قد تعيده نصا). */
function toCents_(dinars) { return Math.round(Number(dinars) * 100); }

/** يطابق عرض بندا؟ scope_type: all | language | age_group | level | group_code */
function offerMatches_(offer, item) {
  var t = String(offer.scope_type || 'all'), v = String(offer.scope_value || '');
  if (t === 'all') return true;
  if (t === 'language') return String(item.language) === v;
  if (t === 'age_group') return String(item.ageGroup) === v;
  if (t === 'level') return String(item.level) === v;
  if (t === 'group_code') return String(item.groupCode) === v;
  return false;
}

/** العروض السارية الآن (التواريخ ISO بتوقيت الجزائر). */
function activeOffers_(offers, nowIso) {
  return (offers || []).filter(function (o) {
    if (String(o.active) !== '1') return false;
    if (o.starts_at && String(o.starts_at) > nowIso) return false;
    if (o.ends_at && String(o.ends_at) < nowIso) return false;
    return Number(o.pct) > 0;
  });
}

/** نسبة خصم الأفواج بحسب العدد. cfg: {t1Min,t1Pct,t2Min,t2Pct} */
function tierPct_(groupCount, cfg) {
  if (cfg.t2Min && groupCount >= cfg.t2Min) return Number(cfg.t2Pct);
  if (cfg.t1Min && groupCount >= cfg.t1Min) return Number(cfg.t1Pct);
  return 0;
}

/**
 * items: [{ref, type:'group'|'vip', amount(دج), language, level, ageGroup, groupCode, userId}]
 * offers: صفوف ورقة Offers. cfg: إعدادات الخصم. nowIso: الوقت الحالي.
 * يعيد: { lines:[{ref,type,grossCents,pct,reason,offerId,discountCents,netCents}], grossCents, discountCents, netCents, tierPct, groupCount, appliedOfferIds }
 */
function priceOrder_(items, offers, cfg, nowIso) {
  var live = activeOffers_(offers, nowIso);
  var groups = items.filter(function (i) { return i.type === 'group'; });
  var tier = tierPct_(groups.length, cfg);
  var lines = [], gross = 0, disc = 0, used = {};
  items.forEach(function (it) {
    var g = toCents_(it.amount), pct = 0, reason = 'none', offerId = '';
    if (it.type === 'group') {
      var best = null;
      live.forEach(function (o) {
        if (offerMatches_(o, it) && (!best || Number(o.pct) > Number(best.pct))) best = o;
      });
      if (best && Number(best.pct) > tier) { pct = Number(best.pct); reason = 'offer'; offerId = String(best.offer_id); used[offerId] = true; }
      else if (tier > 0) { pct = tier; reason = 'tier'; }
      if (Number(it.renewPct) > pct) { pct = Number(it.renewPct); reason = 'renewal'; offerId = ''; }
    }
    var d = pctOfCents_(g, pct);
    lines.push({ ref: it.ref, type: it.type, grossCents: g, pct: pct, reason: reason, offerId: offerId, discountCents: d, netCents: g - d });
    gross += g; disc += d;
  });
  return { lines: lines, grossCents: gross, discountCents: disc, netCents: gross - disc, tierPct: tier, groupCount: groups.length, appliedOfferIds: Object.keys(used) };
}

/** من الإعدادات إلى cfg (قيم نصية). */
function discountCfg_() {
  return {
    t1Min: Number(getSetting_('discount_tier1_min', 2)), t1Pct: Number(getSetting_('discount_tier1_pct', 5)),
    t2Min: Number(getSetting_('discount_tier2_min', 4)), t2Pct: Number(getSetting_('discount_tier2_pct', 10))
  };
}

/** للعرض: سنتيم -> نص بصيغة جزائرية (NBSP للآلاف، دائما .00، السالب بين قوسين). */
function fmtDA_(cents, negative) {
  var neg = cents < 0 || negative, c = Math.abs(cents);
  var d = Math.floor(c / 100), f = ('0' + (c % 100)).slice(-2);
  var s = String(d).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + '.' + f;
  return neg ? '(' + s + ')' : s;
}

// ---------- واجهات عامة (السعر يُحسب في الخادم دائما ولا يُقبل من الواجهة) ----------

/** سعر بند من الإعدادات. item: {type:'group',ageGroup:'adult'|'kids'} أو {type:'vip',hours:10|20|30} */
function itemPrice_(item) {
  var p;
  if (item.type === 'group') {
    if (item.ageGroup !== 'adult' && item.ageGroup !== 'kids') fail_('bad_item');
    p = Number(getSetting_(item.ageGroup === 'kids' ? 'price_kids_level' : 'price_adult_level', 0));
  } else if (item.type === 'vip') {
    var h = Number(item.hours);
    if ([10, 20, 30].indexOf(h) === -1) fail_('bad_item');
    p = Number(getSetting_('vip_' + h + 'h', 0));
  } else { fail_('bad_item'); }
  if (!(p > 0)) fail_('price_not_set');
  return p;
}

/** يبني بنود التسعير من مدخلات الواجهة (يتجاهل أي مبلغ تُرسله). */
function buildItems_(raw) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 12) fail_('bad_items');
  return raw.map(function (r, i) {
    var it = { ref: String(r.ref || i), type: String(r.type), language: String(r.language || ''), ageGroup: String(r.ageGroup || 'adult'), level: String(r.level || ''), groupCode: String(r.groupCode || ''), hours: r.hours };
    it.amount = itemPrice_(it);
    return it;
  });
}

function offersNow_() { return activeOffers_(rows_('Offers'), now_()); }

/** price_preview: معاينة الحساب للسلة (للكبار والصغار وVIP). */
function act_pricePreview_(ctx) {
  var items = buildItems_(ctx.data.items);
  var r = priceOrder_(items, rows_('Offers'), discountCfg_(), now_());
  return {
    lines: r.lines.map(function (l) { return { ref: l.ref, type: l.type, gross: fmtDA_(l.grossCents), pct: l.pct, reason: l.reason, discount: l.discountCents ? fmtDA_(l.discountCents, true) : '', net: fmtDA_(l.netCents) }; }),
    gross: fmtDA_(r.grossCents), discount: r.discountCents ? fmtDA_(r.discountCents, true) : '', net: fmtDA_(r.netCents),
    netCents: r.netCents, tierPct: r.tierPct, groupCount: r.groupCount, offerIds: r.appliedOfferIds
  };
}

/** offers_now: لافتة العرض السارية (الأعلى نسبة) مع وقت الانتهاء للعدّاد. */
function act_offersNow_(ctx) {
  var live = offersNow_().sort(function (a, b) { return Number(b.pct) - Number(a.pct); });
  return live.slice(0, 1).map(function (o) { return { id: String(o.offer_id), name: String(o.name), pct: Number(o.pct), scopeType: String(o.scope_type), scopeValue: String(o.scope_value), endsAt: String(o.ends_at), banner: String(o.banner_text) }; });
}
