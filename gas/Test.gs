/**
 * منصة BTL - محرك اختبار المستوى.
 * القواعد (من مستند البنك): كبار 24 سؤالا (A1:5, A2:6, B1:6, B2:7، منها 3 استماع)، صغار 24 (4 لكل مستوى 1..6، أحدها استماع)،
 * مؤقت 15 دقيقة يفرضه الخادم، لا يُرسَل مفتاح الجواب للعميل، ترتيب الاختيارات يُخلط عند السحب، ولا تتكرر الأسئلة في المحاولات اللاحقة.
 * كل أرقام الإعداد في الورقة Settings (test_*).
 */
var ADULT_STAGES_ = ['A1', 'A2', 'B1', 'B2'];
var KID_LEVELS_ = ['1', '2', '3', '4', '5', '6'];

function parseCounts_(s) {
  var o = {};
  String(s || '').split(',').forEach(function (p) {
    var kv = p.split(':'); if (kv.length === 2 && kv[0].trim()) o[kv[0].trim()] = Number(kv[1]) || 0;
  });
  return o;
}

function testCfg_() {
  return {
    minutes: Number(getSetting_('test_minutes', 15)),
    grace: Number(getSetting_('test_grace_sec', 15)),
    adultCounts: parseCounts_(getSetting_('test_adult_counts', 'A1:5,A2:6,B1:6,B2:7')),
    adultListen: parseCounts_(getSetting_('test_adult_listening', 'A2:1,B1:1,B2:1')),
    kidPer: Number(getSetting_('test_kid_per_level', 4)),
    kidListen: Number(getSetting_('test_kid_listening', 1)),
    passPct: Number(getSetting_('test_pass_pct', 60)),
    kidPass: Number(getSetting_('test_kid_pass_correct', 3)),
    begAfter: Number(getSetting_('test_beginner_after', 6)),
    begMax: Number(getSetting_('test_beginner_max', 2)),
    retakeMax: Number(getSetting_('test_retake_max', 3)),
    retakeDays: Number(getSetting_('test_retake_days', 30))
  };
}

// ---------- البنك ----------
function bankFromRows_(rows) {
  return rows.map(function (r) {
    var opts; try { opts = JSON.parse(String(r.options_json)); } catch (e) { opts = []; }
    return { qid: String(r.qid), language: String(r.language), audience: String(r.audience), level: String(r.level), skill: String(r.skill),
      stem: String(r.stem), options: opts, answer: String(r.answer_key), audio_text: String(r.audio_text || ''), audio_url: String(r.audio_url || ''),
      image_hint: String(r.image_hint || ''), image_url: String(r.image_url || ''), active: String(r.active) !== '0' };
  }).filter(function (q) { return q.options.length === 4 && q.options.indexOf(q.answer) !== -1; });
}

/** كل أسئلة لغة وفئة (مع غير المفعّلة لقراءة اختبارات جارية). كاش ساعة لأن الأسئلة تتغير نادرا. */
function loadBank_(language, audience) {
  var cache = CacheService.getScriptCache(), k = 'qb_' + language + '_' + audience, hit = cache.get(k);
  if (hit) return JSON.parse(hit);
  var bank = bankFromRows_(rows_('Questions').filter(function (r) { return String(r.language) === language && String(r.audience) === audience; }));
  try { cache.put(k, JSON.stringify(bank), 3600); } catch (e) { /* أكبر من حد الكاش: نقرأ من الورقة كل مرة */ }
  return bank;
}

function clearBankCache_() {
  var c = CacheService.getScriptCache();
  ['EN', 'FR'].forEach(function (l) { ['adult', 'kid'].forEach(function (a) { c.remove('qb_' + l + '_' + a); }); });
}

/** يستورد/يحدّث بنك الأسئلة من QuestionBank.gs (بحسب qid، ولا يمسّ active وtimes_used). */
function seedQuestions() {
  var sh = sheet_('Questions'), h = headers_(sh), have = {};
  rows_('Questions').forEach(function (r) { have[String(r.qid)] = r._row; });
  var add = [], upd = 0;
  QUESTION_BANK_.forEach(function (b) {
    var obj = { qid: b[0], language: b[1], audience: b[2], level: b[3], skill: b[4], type: 'mcq', stem: b[5], options_json: JSON.stringify(b[6]), answer_key: b[7], audio_text: b[8], image_hint: b[9] };
    if (have[b[0]]) { updateRow_('Questions', have[b[0]], obj); upd++; }
    else { obj.active = '1'; obj.times_used = '0'; add.push(h.map(function (k) { return safeCell_(obj[k]); })); }
  });
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, h.length).setNumberFormat('@').setValues(add);
  clearBankCache_();
  Logger.log('أسئلة جديدة: ' + add.length + ' · محدّثة: ' + upd);
  return { added: add.length, updated: upd };
}

// ---------- السحب ----------
function shuffle_(a, rnd) {
  rnd = rnd || Math.random;
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

/** من المجموعة نختار n مفضّلين ما لم يره الشخص من قبل، ثم نكمل مما رآه إن نفد البنك. */
function pickFrom_(pool, n, seen, rnd) {
  var fresh = shuffle_(pool.filter(function (q) { return !seen[q.qid]; }), rnd);
  var old = shuffle_(pool.filter(function (q) { return seen[q.qid]; }), rnd);
  return fresh.concat(old).slice(0, n);
}

/** يسحب أسئلة الاختبار مرتبة بالمراحل. bank: الأسئلة المفعّلة. seen: {qid:true}. */
function drawTest_(bank, audience, cfg, seen, rnd) {
  var groups = audience === 'kid' ? KID_LEVELS_ : ADULT_STAGES_, out = [];
  groups.forEach(function (g) {
    var n = audience === 'kid' ? cfg.kidPer : (cfg.adultCounts[g] || 0);
    var L = audience === 'kid' ? cfg.kidListen : (cfg.adultListen[g] || 0);
    var pool = bank.filter(function (q) { return q.level === g && q.active; });
    var lis = pool.filter(function (q) { return q.skill === 'listening'; });
    var rest = pool.filter(function (q) { return q.skill !== 'listening'; });
    var picked = pickFrom_(lis, L, seen, rnd).concat(pickFrom_(rest, n - Math.min(L, lis.length), seen, rnd));
    if (picked.length < n) {   // نقص في البنك: نكمل من أي سؤال متبقٍ في المرحلة
      var left = pool.filter(function (q) { return picked.indexOf(q) === -1; });
      picked = picked.concat(pickFrom_(left, n - picked.length, seen, rnd));
    }
    shuffle_(picked, rnd).forEach(function (q) { out.push({ q: q, stage: g }); });
  });
  return out;
}

function permutation_(rnd) { return shuffle_([0, 1, 2, 3], rnd); }

// ---------- التصحيح (دالة نقية) ----------
function pct_(c, t) { return t ? Math.round(c * 100 / t) : 0; }

/**
 * list: [{stage, skill, ok}] حيث ok = true/false أو null إن لم يُجَب (يُحسب خطأ).
 * كبار: المستوى = أعلى مرحلة ≥ passPct% بشرط ≥ passPct% في كل ما قبلها. A1 دون العتبة = A1 مبتدئ.
 * صغار: المستوى = أعلى مستوى فيه ≥ kidPass صحيحة بشرط نجاح كل ما قبله. الفشل في المستوى 1 = المستوى 1.
 */
function gradeResults_(audience, list, cfg, opt) {
  opt = opt || {};
  var groups = audience === 'kid' ? KID_LEVELS_ : ADULT_STAGES_, byG = {}, skills = {}, c = 0, answered = 0;
  groups.forEach(function (g) { byG[g] = { c: 0, t: 0 }; });
  list.forEach(function (x) {
    var g = byG[x.stage]; g.t++;
    var s = skills[x.skill] || (skills[x.skill] = { c: 0, t: 0 }); s.t++;
    if (x.ok !== null && x.ok !== undefined) answered++;
    if (x.ok === true) { g.c++; s.c++; c++; }
  });
  var level = groups[0], beginner = false, ok = true;
  groups.forEach(function (g, i) {
    var passed = audience === 'kid' ? byG[g].c >= cfg.kidPass : (byG[g].t > 0 && pct_(byG[g].c, byG[g].t) >= cfg.passPct);
    if (i === 0) { if (!passed) { ok = false; beginner = audience !== 'kid'; } else level = g; return; }
    if (ok && passed) level = g; else ok = false;
  });
  if (opt.forceBeginner) { level = groups[0]; beginner = audience !== 'kid'; }
  Object.keys(skills).forEach(function (k) { skills[k].pct = pct_(skills[k].c, skills[k].t); });
  groups.forEach(function (g) { byG[g].pct = pct_(byG[g].c, byG[g].t); });
  return { audience: audience, level: level, beginner: beginner, groups: byG, skills: skills, score: c, total: list.length, answered: answered,
    stars: answered, timedOut: !!opt.timedOut, beginnerStop: !!opt.forceBeginner };
}

/** الصغار: بعد مستويين متتاليين مكتملين دون العتبة يتوقف الاختبار بلطف. */
function kidShouldStop_(list, cfg) {
  var fails = 0;
  for (var i = 0; i < KID_LEVELS_.length; i++) {
    var g = KID_LEVELS_[i], items = list.filter(function (x) { return x.stage === g; });
    if (!items.length || items.some(function (x) { return x.ok === null || x.ok === undefined; })) break;
    var c = items.filter(function (x) { return x.ok === true; }).length;
    if (c >= cfg.kidPass) fails = 0; else { fails++; if (fails >= 2) return true; }
  }
  return false;
}

// ---------- الزمن ----------
function isoAdd_(iso, ms) {
  return Utilities.formatDate(new Date(new Date(iso + '+01:00').getTime() + ms), 'Africa/Algiers', "yyyy-MM-dd'T'HH:mm:ss");
}
function secBetween_(fromIso, toIso) { return Math.round((new Date(toIso + '+01:00').getTime() - new Date(fromIso + '+01:00').getTime()) / 1000); }

// ---------- الصلاحيات ----------
/** من يجوز لصاحب الجلسة أن يختبره: نفسه، أو ابنه، أو بالغ أضافه بدعوة سارية ولم تُلغَ. */
function testSubject_(user, personId) {
  var pid = personId ? String(personId) : String(user.user_id);
  if (pid === String(user.user_id)) return user;
  var p = findRowFast_('Users', 'user_id', pid);
  if (!p) fail_('forbidden');
  if (String(p.guardian_id) === String(user.user_id)) return p;
  var now = now_();
  var inv = rows_('TestInvites').filter(function (r) {
    return String(r.user_id) === pid && String(r.created_by) === String(user.user_id) && String(r.status) !== 'cancelled' && String(r.expires_at) > now;
  })[0];
  if (!inv) fail_('forbidden');
  return p;
}

function ownTest_(ctx, testId) {
  var t = findRowFast_('Tests', 'test_id', String(testId || ''));
  if (!t) fail_('not_found');
  testSubject_(ctx.user, String(t.user_id));
  return t;
}

// ---------- بناء الاختبار للعميل ----------
function parseJson_(s, def) { try { return s ? JSON.parse(String(s)) : def; } catch (e) { return def; } }

function testPayload_(row, bankMap) {
  var list = parseJson_(row.question_ids_json, []), answers = parseJson_(row.answers_json, {});
  var qs = list.map(function (it, i) {
    var q = bankMap[it.q]; if (!q) return null;
    return { no: i + 1, qid: q.qid, stage: q.level, skill: q.skill, stem: q.stem,
      options: it.o.map(function (k) { return q.options[k]; }), audio_text: q.audio_text, audio_url: q.audio_url, image_hint: q.image_hint, image_url: q.image_url };
  }).filter(Boolean);
  return { test_id: String(row.test_id), language: String(row.language), audience: String(row.audience), total: qs.length, minutes: Number(getSetting_('test_minutes', 15)),
    remaining_sec: Math.max(0, secBetween_(now_(), String(row.deadline_at))), answers: answers, questions: qs };
}
function bankMap_(bank) { var m = {}; bank.forEach(function (q) { m[q.qid] = q; }); return m; }

function listWithOk_(row, bankMap) {
  var list = parseJson_(row.question_ids_json, []), answers = parseJson_(row.answers_json, {});
  return list.map(function (it) {
    var q = bankMap[it.q], a = answers[it.q];
    var ok = (a === undefined || a === null) ? null : (q && q.options[it.o[a]] === q.answer);
    return { qid: it.q, stage: q ? q.level : '', skill: q ? q.skill : 'general', ok: ok };
  });
}

// ---------- الأفعال ----------
/** test_start: data {language, person_id?}. يستأنف اختبارا جاريا لم ينتهِ وقته، وإلا يسحب اختبارا جديدا. */
function act_testStart_(ctx) {
  var u = ctx.user, d = ctx.data, s = testSubject_(u, d.person_id), lang = String(d.language || '').toUpperCase();
  if (lang !== 'EN' && lang !== 'FR') fail_('bad_language');
  if (!nz_(s.age_group)) fail_('profile_incomplete');
  rateLimit_('tstart|' + u.user_id, 12, 3600);
  var aud = String(s.age_group) === 'kids' ? 'kid' : 'adult', cfg = testCfg_(), now = now_();
  var bank = loadBank_(lang, aud), bm = bankMap_(bank);
  var mine = rows_('Tests').filter(function (r) { return String(r.user_id) === String(s.user_id) && String(r.language) === lang; });
  var run = mine.filter(function (r) { return String(r.status) === 'running'; })[0];
  if (run) {
    if (String(run.deadline_at) > now) return testPayload_(run, bm);
    finishTest_(run, bm, cfg, { timedOut: true });   // انتهى وقته دون إنهاء: يُصحَّح ما أُجيب
    mine = rows_('Tests').filter(function (r) { return String(r.user_id) === String(s.user_id) && String(r.language) === lang; });
  }
  var cutoff = isoAdd_(now, -cfg.retakeDays * 86400000);
  var done = mine.filter(function (r) { return (String(r.status) === 'finished' || String(r.status) === 'stopped') && String(r.finished_at) >= cutoff; });
  if (done.length >= 1 + cfg.retakeMax) fail_('retake_limit');
  var seen = {};
  mine.forEach(function (r) { parseJson_(r.question_ids_json, []).forEach(function (it) { seen[it.q] = true; }); });
  var drawn = drawTest_(bank, aud, cfg, seen);
  if (!drawn.length) fail_('bank_empty');
  var list = drawn.map(function (x) { return { q: x.q.qid, o: permutation_() }; });
  var row = { test_id: uid_('t'), user_id: String(s.user_id), language: lang, attempt_no: String(mine.length + 1), started_at: now, deadline_at: isoAdd_(now, cfg.minutes * 60000),
    question_ids_json: JSON.stringify(list), answers_json: '{}', status: 'running', audience: aud, taken_by: String(u.user_id), result_json: '{}' };
  appendRow_('Tests', row);
  return testPayload_(row, bm);
}

/** test_answer: data {test_id, qid, choice(0..3 بحسب ترتيب العرض)}. يعيد {answered, offer_beginner, stop}. */
function act_testAnswer_(ctx) {
  var d = ctx.data, cfg = testCfg_(), lock = LockService.getScriptLock();
  var choice = Number(d.choice);
  if (!(choice >= 0 && choice <= 3) || Math.floor(choice) !== choice) fail_('bad_choice');
  lock.waitLock(10000);
  try {
    var t = ownTest_(ctx, d.test_id);
    if (String(t.status) !== 'running') fail_('test_closed');
    if (now_() > isoAdd_(String(t.deadline_at), cfg.grace * 1000)) fail_('time_up');
    var list = parseJson_(t.question_ids_json, []), idx = -1;
    list.forEach(function (it, i) { if (it.q === String(d.qid)) idx = i; });
    if (idx < 0) fail_('bad_question');
    var answers = parseJson_(t.answers_json, {}), meta = parseJson_(t.result_json, {});
    answers[String(d.qid)] = choice;
    var out = { answered: Object.keys(answers).length, offer_beginner: false, stop: false };
    var bm = bankMap_(loadBank_(String(t.language), String(t.audience)));
    var tmp = { question_ids_json: t.question_ids_json, answers_json: JSON.stringify(answers) };
    var ok = listWithOk_(tmp, bm);
    if (String(t.audience) === 'adult' && !meta.beg_asked && idx === cfg.begAfter - 1) {
      var first = ok.slice(0, cfg.begAfter);
      if (first.every(function (x) { return x.ok !== null; }) && first.filter(function (x) { return x.ok === true; }).length <= cfg.begMax) { out.offer_beginner = true; meta.beg_asked = true; }
    }
    if (String(t.audience) === 'kid') out.stop = kidShouldStop_(ok, cfg);
    updateRow_('Tests', t._row, { answers_json: JSON.stringify(answers), result_json: JSON.stringify(meta) });
    return out;
  } finally { lock.releaseLock(); }
}

function clientResult_(row, r) {
  var skills = {}; Object.keys(r.skills).forEach(function (k) { skills[k] = { pct: r.skills[k].pct, c: r.skills[k].c, t: r.skills[k].t }; });
  return { test_id: String(row.test_id), language: String(row.language), audience: String(row.audience), level: r.level, beginner: r.beginner, skills: skills,
    score: r.score, total: r.total, answered: r.answered, stars: r.stars, timed_out: r.timedOut };
}

function finishTest_(row, bm, cfg, opt) {
  var list = listWithOk_(row, bm), r = gradeResults_(String(row.audience), list, cfg, opt);
  var meta = parseJson_(row.result_json, {}); meta.result = r;
  var untouched = r.answered === 0 && !(opt && opt.forceBeginner);
  updateRow_('Tests', row._row, { finished_at: now_(), status: untouched ? 'expired' : ((opt && opt.forceBeginner) ? 'stopped' : 'finished'), score: String(r.score), level: r.level, sublevel: '',
    skills_json: JSON.stringify(r.skills), result_json: JSON.stringify(meta) });
  if (!untouched) {
    var u = findRowFast_('Users', 'user_id', String(row.user_id));
    if (u && (!nz_(u.status) || String(u.status) === 'new')) updateRow_('Users', u._row, { status: 'tested' });
    try { onTestFinished_(row); } catch (e) { log_('on_test_finished_error', String(row.user_id), String(e)); }
  }
  return r;
}

/** test_finish: يُصحَّح ما أُجيب ويُحسب المستوى. آمن للتكرار. */
function act_testFinish_(ctx) {
  var lock = LockService.getScriptLock(), cfg = testCfg_();
  lock.waitLock(10000);
  try {
    var t = ownTest_(ctx, ctx.data.test_id);
    var bm = bankMap_(loadBank_(String(t.language), String(t.audience)));
    if (String(t.status) === 'running') {
      var late = now_() > String(t.deadline_at);
      var r = finishTest_(t, bm, cfg, { timedOut: late });
      return clientResult_(t, r);
    }
    var meta = parseJson_(t.result_json, {});
    if (!meta.result) fail_('not_finished');
    return clientResult_(t, meta.result);
  } finally { lock.releaseLock(); }
}

/** test_beginner_stop: بعد عرض نافذة «ابدأ من المبتدئ» وموافقته يتوقف الاختبار ويُسجَّل A1 مبتدئ. */
function act_testBeginnerStop_(ctx) {
  var lock = LockService.getScriptLock(), cfg = testCfg_();
  lock.waitLock(10000);
  try {
    var t = ownTest_(ctx, ctx.data.test_id);
    var meta = parseJson_(t.result_json, {});
    if (String(t.status) !== 'running' || String(t.audience) !== 'adult' || !meta.beg_asked) fail_('not_allowed');
    var bm = bankMap_(loadBank_(String(t.language), String(t.audience)));
    return clientResult_(t, finishTest_(t, bm, cfg, { forceBeginner: true }));
  } finally { lock.releaseLock(); }
}

function act_testResult_(ctx) {
  var t = ownTest_(ctx, ctx.data.test_id), meta = parseJson_(t.result_json, {});
  if (!meta.result) fail_('not_finished');
  return clientResult_(t, meta.result);
}

/** آخر نتيجة منتهية لشخص في لغة (تُستعمل لاقتراح الفوج). null إن لم يختبر. */
function latestTestResult_(userId, language) {
  var rs = rows_('Tests').filter(function (r) {
    return String(r.user_id) === String(userId) && String(r.language) === String(language) && (String(r.status) === 'finished' || String(r.status) === 'stopped');
  }).sort(function (a, b) { return String(b.finished_at) < String(a.finished_at) ? -1 : 1; });
  if (!rs.length) return null;
  var meta = parseJson_(rs[0].result_json, {});
  return { test_id: String(rs[0].test_id), level: String(rs[0].level), audience: String(rs[0].audience), beginner: !!(meta.result && meta.result.beginner), finished_at: String(rs[0].finished_at) };
}
