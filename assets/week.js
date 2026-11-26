/* الجدول الأسبوعي للأفواج: شبكة السبت→الجمعة، ألوان ثابتة للأساتذة، فلاتر مع أعداد، إحصاءات، تحميل صورة وPDF. */
(function () {
  var DAYS = [6, 0, 1, 2, 3, 4, 5], DN = { 0: 'الأحد', 1: 'الاثنين', 2: 'الثلاثاء', 3: 'الأربعاء', 4: 'الخميس', 5: 'الجمعة', 6: 'السبت' };
  var PAL = ['#4136E6', '#C4087A', '#0E8F6A', '#E56A00', '#7A3FD1', '#0A7EA4', '#B3261E', '#5C7A00', '#D4478B', '#2B5FD9', '#8A5A00', '#00796B', '#9B2FAE', '#3E4A8A'], NOCOL = '#8A87A8';
  var LANG = { EN: 'الإنجليزية', FR: 'الفرنسية' };
  var H = {}, F = {}, B = null, TC = {}, ALL = [], ROWS = [], ADMIN = false;
  var E = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var today = function () { return new Date().toISOString().slice(0, 10); };
  var women = function (g) { return /\(F\)/i.test(g.code); }, kids = function (g) { return g.age_group === 'kids'; };
  var hrs = function (g) { return (g.times_set ? g.schedule || [] : []).map(function (z) { return parseInt(z.t, 10); }); };
  var seats = function (g) { return { min: g.seats_min || 5, max: g.seats_max || 12 }; };

  var DEFS = [
    { k: 'language', l: 'اللغة', o: function () { return [['EN', 'الإنجليزية'], ['FR', 'الفرنسية']]; }, p: function (g, v) { return g.language === v; } },
    { k: 'age', l: 'الفئة', o: function () { return [['adult', 'كبار'], ['kids', 'صغار']]; }, p: function (g, v) { return g.age_group === v; } },
    { k: 'level', l: 'المستوى', o: function () { return ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'K1', 'K2', 'K3', 'K4', 'K5', 'K6'].map(function (x) { return [x, x]; }); }, p: function (g, v) { return String(g.level).indexOf(v) === 0; } },
    { k: 'teacher', l: 'الأستاذ', admin: true, o: function () { return B.teachers.map(function (t) { return [t.id, t.name]; }).concat([['none', 'بلا أستاذ']]); }, p: function (g, v) { return v === 'none' ? !g.teacher_id : g.teacher_id === v; } },
    { k: 'join', l: 'الانضمام', o: function () { return [['open', 'مفتوح'], ['closed', 'مغلق']]; }, p: function (g, v) { var c = g.closed && !g.late_ok; return v === 'closed' ? c : !c; } },
    { k: 'timeset', l: 'المواقيت', o: function () { return [['set', 'مثبّتة'], ['unset', 'غير مثبّتة']]; }, p: function (g, v) { return v === 'set' ? !!g.times_set : !g.times_set; } },
    { k: 'day', l: 'اليوم', o: function () { return DAYS.map(function (d) { return [String(d), DN[d]]; }); }, p: function (g, v) { return g.times_set && (g.schedule || []).some(function (z) { return String(z.d) === v; }); } },
    { k: 'period', l: 'الفترة', o: function () { return [['m', 'صباحا (قبل 12)'], ['a', 'ظهرا وعصرا (12–17)'], ['e', 'مساء (17 فأكثر)']]; }, p: function (g, v) { return hrs(g).some(function (h) { return v === 'm' ? h < 12 : v === 'a' ? h >= 12 && h < 17 : h >= 17; }); } },
    { k: 'stage', l: 'المرحلة', o: function () { return [['soon', 'لم يبدأ بعد'], ['run', 'جارٍ']]; }, p: function (g, v) { var s = g.start_date && g.start_date > today(); return v === 'soon' ? s : !s; } },
    { k: 'fill', l: 'الامتلاء', o: function () { return [['low', 'أقل من الحد الأدنى'], ['ok', 'بين الحدين'], ['full', 'مكتمل']]; }, p: function (g, v) { var s = seats(g); return v === 'low' ? g.members < s.min : v === 'full' ? g.members >= s.max : g.members >= s.min && g.members < s.max; } },
    { k: 'women', l: 'مجموعات النساء', o: function () { return [['1', 'نساء فقط']]; }, p: function (g) { return women(g); } }
  ];
  var defsOf = function () { return DEFS.filter(function (d) { return ADMIN || !d.admin; }); };
  function match(g, skip) { return defsOf().every(function (d) { return d.k === skip || !F[d.k] || d.p(g, F[d.k]); }); }
  function count(d, v) { return ALL.filter(function (g) { return match(g, d.k) && d.p(g, v); }).length; }
  function lvLabel(g) { return g.level + (kids(g) ? ' ص' : '') + (women(g) ? ' ن' : ''); }
  function colorOf(g) { return TC[g.teacher_id] || NOCOL; }
  function sched(g) { return (g.schedule || []).map(function (z) { return DN[z.d] + ' <bdi dir="ltr">' + E(z.t + '–' + z.e) + '</bdi>'; }).join(' · '); }

  function setup(b, admin) {
    B = b; ADMIN = admin && !b.scoped; ALL = b.groups.slice();
    TC = {}; b.teachers.forEach(function (t, i) { TC[t.id] = PAL[i % PAL.length]; });
    if (!document.getElementById('wkcss')) {
      var st = document.createElement('style'); st.id = 'wkcss';
      st.textContent = '.wkw{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:#fff;margin-bottom:10px}.wkt{border-collapse:separate;border-spacing:0;min-width:640px;width:100%;table-layout:fixed}' +
        '.wkt th{font-size:11.5px;background:var(--soft);padding:7px 2px;color:var(--brand2)}.wkt td{border-top:1px solid #EEEDFF;border-inline-start:1px solid #EEEDFF;padding:3px;vertical-align:top}' +
        '.wkt .tm{width:62px;position:sticky;inset-inline-start:0;background:#fff;z-index:1;font-size:11px;font-weight:700;direction:ltr;text-align:center;vertical-align:middle;border-inline-start:0}.wkt th.tm{background:var(--soft)}' +
        '.wkc{display:flex;align-items:center;gap:4px;width:100%;border:0;border-radius:8px;padding:5px;margin:2px 0;color:#fff;font-size:11px;font-weight:700;text-align:start;line-height:1.2}.wkc svg{flex:none}.wkc i{margin-inline-start:auto;font-style:normal;background:rgba(255,255,255,.28);border-radius:6px;padding:0 5px;font-size:10px}' +
        '.wkg{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}.wkg button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:4px 10px 4px 8px;font-size:11.5px;display:flex;align-items:center;gap:6px;color:var(--ink)}.wkg b{width:10px;height:10px;border-radius:50%;display:inline-block}.wkg button.on{border-color:var(--brand);background:var(--soft)}' +
        '.wks{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px}.wks div{background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px 4px;text-align:center}.wks b{font-size:19px;color:var(--brand2);display:block}.wks span{font-size:10.5px;color:var(--mute)}' +
        '@media(max-width:560px){.wkt{min-width:0}.wkt .tm{width:46px;font-size:9.5px}.wkt th{font-size:9.5px;padding:7px 0}.wkt td{padding:2px}.wkc{flex-direction:column;gap:1px;padding:4px 1px;align-items:center;text-align:center;font-size:10px;margin:2px 0}.wkc i{margin:0;font-size:10px;padding:0 6px}}.wkf summary{padding:10px 0}.wkf .fg{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-bottom:12px}.wkf select.on{border-color:var(--brand);background:var(--soft)}';
      document.head.appendChild(st);
    }
    if (!document.getElementById('wkspr')) {
      var d = document.createElement('div'); d.id = 'wkspr'; d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      d.innerHTML = '<svg width="0" height="0"><defs><clipPath id="wkcl"><circle cx="10" cy="10" r="10"/></clipPath></defs>' +
        '<symbol id="fl-FR" viewBox="0 0 20 20"><g clip-path="url(#wkcl)"><rect width="7" height="20" fill="#244AA5"/><rect x="7" width="6" height="20" fill="#fff"/><rect x="13" width="7" height="20" fill="#EE2A35"/></g></symbol>' +
        '<symbol id="fl-EN" viewBox="0 0 20 20"><g clip-path="url(#wkcl)"><rect width="20" height="20" fill="#243B8F"/><path d="M0 0L20 20M20 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0L20 20M20 0L0 20" stroke="#E8283A" stroke-width="1.6"/><path d="M10 0V20M0 10H20" stroke="#fff" stroke-width="6"/><path d="M10 0V20M0 10H20" stroke="#E8283A" stroke-width="3.4"/></g></symbol></svg>';
      document.body.appendChild(d);
    }
  }
  var flag = function (l, s) { return '<svg width="' + s + '" height="' + s + '" aria-hidden="true"><use href="#fl-' + (l === 'FR' ? 'FR' : 'EN') + '"/></svg>'; };

  function view() { return ALL.filter(function (g) { return match(g); }); }
  function rowsOf(gs) {
    var seen = {}; gs.forEach(function (g) { if (g.times_set) (g.schedule || []).forEach(function (z) { seen[parseInt(z.t, 10)] = String(z.t).slice(0, 2) + ':00–' + String(z.e || '').slice(0, 2) + ':00'; }); });
    var slots = (B.slots || []).map(function (s) { var p = s.split('-'); return [Number(p[0]), ('0' + p[0]).slice(-2) + ':00–' + ('0' + p[1]).slice(-2) + ':00']; });
    slots.forEach(function (s) { if (seen[s[0]]) seen[s[0]] = s[1]; });
    return Object.keys(seen).map(Number).sort(function (a, b) { return a - b; }).map(function (h) { return [h, seen[h]]; });
  }
  function title() {
    var p = ['الجدول الأسبوعي'];
    defsOf().forEach(function (d) { if (F[d.k]) { var o = d.o().filter(function (x) { return x[0] === F[d.k]; })[0]; if (o) p.push((d.k === 'teacher' && F[d.k] !== 'none' ? 'الأستاذ ' : '') + o[1]); } });
    return p.length === 1 ? 'الجدول الأسبوعي لكل الأفواج' : p.join(' · ');
  }
  function stats(gs) {
    var m = gs.reduce(function (a, g) { return a + g.members; }, 0), t = {}; gs.forEach(function (g) { if (g.teacher_id) t[g.teacher_id] = 1; });
    var fillSum = 0, fillN = 0; gs.forEach(function (g) { var s = seats(g); fillSum += Math.min(1, g.members / s.max); fillN++; });
    return { groups: gs.length, members: m, teachers: Object.keys(t).length, fill: fillN ? Math.round(fillSum * 100 / fillN) : 0 };
  }

  function html(b, admin) {
    setup(b, admin);
    var gs = view(), rows = rowsOf(gs), st = stats(gs), active = defsOf().filter(function (d) { return F[d.k]; }).length;
    var sel = defsOf().map(function (d) {
      return '<div><label>' + d.l + '</label><select data-wf="' + d.k + '" class="' + (F[d.k] ? 'on' : '') + '"><option value="">الكل (' + ALL.filter(function (g) { return match(g, d.k); }).length + ')</option>' +
        d.o().map(function (o) { var n = count(d, o[0]); return '<option value="' + E(o[0]) + '"' + (F[d.k] === o[0] ? ' selected' : '') + (n || F[d.k] === o[0] ? '' : ' disabled') + '>' + E(o[1]) + ' (' + n + ')</option>'; }).join('') + '</select></div>';
    }).join('');
    var tcount = {}; gs.forEach(function (g) { var k = g.teacher_id || 'none'; tcount[k] = (tcount[k] || 0) + 1; });
    var legend = Object.keys(tcount).map(function (k) {
      var nm = k === 'none' ? 'بلا أستاذ' : (B.teachers.filter(function (t) { return t.id === k; })[0] || {}).name || k;
      return '<button data-wt="' + E(k) + '" class="' + (F.teacher === k ? 'on' : '') + '"><b style="background:' + (TC[k] || NOCOL) + '"></b>' + E(nm) + ' · ' + tcount[k] + '</button>';
    }).join('');
    var head = '<tr><th class="tm">الوقت</th>' + DAYS.map(function (d) { return '<th>' + DN[d] + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (r) {
      return '<tr><td class="tm">' + r[1].replace('–', '<br>') + '</td>' + DAYS.map(function (d) {
        var cell = gs.filter(function (g) { return g.times_set && (g.schedule || []).some(function (z) { return z.d === d && parseInt(z.t, 10) === r[0]; }); });
        return '<td>' + cell.map(function (g) { return '<button class="wkc" data-wg="' + E(g.group_id) + '" style="background:' + colorOf(g) + '">' + flag(g.language, 15) + '<span dir="ltr">' + E(lvLabel(g)) + '</span><i>' + g.members + '</i></button>'; }).join('') + '</td>';
      }).join('') + '</tr>';
    }).join('');
    var unset = gs.filter(function (g) { return !g.times_set; });
    var out = '<details class="wkf card" ' + (active ? 'open' : '') + '><summary>الفلاتر' + (active ? ' <span class="tag">' + active + ' مفعّل</span>' : '') + '</summary><div class="fg">' + sel + '</div>' + (active ? '<button class="btn sec" data-wclear="1" style="width:100%;margin-bottom:10px">مسح كل الفلاتر</button>' : '') + '</details>' +
      '<div class="wks"><div><b>' + st.groups + '</b><span>فوج</span></div><div><b>' + st.members + '</b><span>مشارك</span></div><div><b>' + st.teachers + '</b><span>أستاذ</span></div><div><b>' + st.fill + '%</b><span>متوسط الامتلاء</span></div></div>' +
      (legend ? '<div class="wkg">' + legend + '</div>' : '') +
      (rows.length ? '<div class="wkw"><table class="wkt"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
        '<div class="btns" style="margin:0 0 12px"><button class="btn sec" data-wdl="img">تحميل صورة</button><button class="btn sec" data-wdl="pdf">تحميل PDF</button></div>' :
        '<div class="card mute">لا أفواج بمواقيت مثبّتة بهذه المعايير.</div>') +
      (unset.length ? '<div class="mute" style="margin:0 0 10px">' + unset.length + ' فوج بلا مواقيت مثبّتة لا يظهر في الشبكة (يظهر في القائمة).</div>' : '') +
      '<h2>القائمة (' + gs.length + ')</h2>' + (gs.length ? gs.map(function (g) { return card(g); }).join('') : '<div class="card mute">لا توجد أفواج بهذه المعايير.</div>');
    return out;
  }
  function card(g) {
    var c = g.closed && !g.late_ok;
    return '<div class="card" style="border-inline-start:6px solid ' + colorOf(g) + '"><div class="row"><b dir="ltr" style="display:flex;align-items:center;gap:6px">' + flag(g.language, 16) + E(g.code) + '</b><span class="tag' + (c ? ' urgent' : '') + '">' + (g.late_ok ? 'مفتوح استثناءً' : c ? 'مغلق للانضمام' : 'مفتوح') + '</span></div>' +
      '<div class="mute" style="margin-top:4px">' + (kids(g) ? 'صغار' : 'كبار') + ' · ' + (g.teacher ? E(g.teacher) : 'بلا أستاذ') + ' · يبدأ <bdi dir="ltr">' + E(g.start_date) + '</bdi></div>' +
      '<div style="margin:8px 0;font-weight:700">' + (g.times_set ? sched(g) : '<span style="color:#C62832">لم تُثبَّت المواقيت</span>') + '</div>' +
      '<div class="row"><span class="mute">' + g.members + ' مشترك · حفظ أوقاته ' + g.saved + '</span><span>' + actions(g) + '</span></div></div>';
  }
  function actions(g) {
    return '<button class="btn sec" data-ad="' + E(g.group_id) + '" style="width:auto;padding:6px 14px">الإعلان</button> <button class="btn" data-t="' + E(g.group_id) + '" style="width:auto;padding:6px 14px">' + (g.times_set ? 'تعديل المواقيت' : 'اختيار المواقيت') + '</button>' +
      (ADMIN && g.closed ? ' <button class="btn sec" data-l="' + E(g.group_id) + '" data-on="' + (g.late_ok ? 0 : 1) + '" style="width:auto;padding:6px 14px">' + (g.late_ok ? 'إلغاء الاستثناء' : 'فتح استثناءً') + '</button>' : '');
  }

  function detail(gid, rerender) {
    var g = ALL.filter(function (x) { return x.group_id === gid; })[0]; if (!g) return;
    var s = seats(g), c = g.closed && !g.late_ok;
    H.ask('<div class="row"><h2 dir="ltr" style="margin:0;display:flex;align-items:center;gap:6px">' + flag(g.language, 20) + E(g.code) + '</h2><span class="tag' + (c ? ' urgent' : '') + '">' + (g.late_ok ? 'مفتوح استثناءً' : c ? 'مغلق للانضمام' : 'مفتوح') + '</span></div>' +
      '<div style="margin:10px 0;display:flex;align-items:center;gap:8px"><b style="width:14px;height:14px;border-radius:50%;background:' + colorOf(g) + ';display:inline-block"></b><b>' + (g.teacher ? E(g.teacher) : 'بلا أستاذ') + '</b></div>' +
      '<div class="mute">' + (LANG[g.language] || '') + ' · ' + (kids(g) ? 'صغار' : 'كبار') + ' · المستوى ' + E(g.level) + (women(g) ? ' · نساء' : '') + '</div>' +
      '<div style="margin:10px 0;font-weight:700">' + (g.times_set ? sched(g) : '<span style="color:#C62832">لم تُثبَّت المواقيت</span>') + '</div>' +
      '<div class="stats" style="margin:8px 0"><div class="stat"><b>' + g.members + '</b><span>مشترك من ' + s.max + '</span></div><div class="stat"><b>' + g.saved + '</b><span>حفظوا أوقاتهم</span></div></div>' +
      '<div class="mute">يبدأ <bdi dir="ltr">' + E(g.start_date) + '</bdi> · الحد الأدنى ' + s.min + '</div>' +
      '<div class="btns">' + actions(g) + (ADMIN && g.teacher_id ? ' <button class="btn sec" id="wkprog">برنامج الأستاذ</button>' : '') + '<button class="btn sec" id="wkx">إغلاق</button></div>',
      function () {
        document.getElementById('wkx').onclick = H.closeModal;
        var pr = document.getElementById('wkprog'); if (pr) pr.onclick = function () { F = { teacher: g.teacher_id }; H.closeModal(); rerender(); };
        Array.prototype.forEach.call(document.querySelectorAll('#mbody [data-t]'), function (e) { e.onclick = function () { H.closeModal(); H.timesPick(e.getAttribute('data-t')); }; });
        Array.prototype.forEach.call(document.querySelectorAll('#mbody [data-ad]'), function (e) { e.onclick = function () { H.closeModal(); H.adPick(e.getAttribute('data-ad')); }; });
        Array.prototype.forEach.call(document.querySelectorAll('#mbody [data-l]'), function (e) { e.onclick = function () { H.closeModal(); H.lateAsk(e.getAttribute('data-l'), e.getAttribute('data-on') === '1'); }; });
      });
  }

  function bind(rerender) {
    var q = function (s) { return Array.prototype.slice.call(document.querySelectorAll('#view ' + s)); };
    q('[data-wf]').forEach(function (e) { e.onchange = function () { var k = e.getAttribute('data-wf'); if (e.value) F[k] = e.value; else delete F[k]; rerender(); }; });
    q('[data-wclear]').forEach(function (e) { e.onclick = function () { F = {}; rerender(); }; });
    q('[data-wt]').forEach(function (e) { e.onclick = function () { if (!ADMIN) return; var k = e.getAttribute('data-wt'); if (F.teacher === k) delete F.teacher; else F.teacher = k; rerender(); }; });
    q('[data-wg]').forEach(function (e) { e.onclick = function () { detail(e.getAttribute('data-wg'), rerender); }; });
    q('[data-wdl]').forEach(function (e) { e.onclick = function () { download(e.getAttribute('data-wdl')); }; });
  }

  // ---------- التحميل ----------
  function draw() {
    var gs = view(), rows = rowsOf(gs), st = stats(gs), W = 1700, M = 40, TW = 150, CW = Math.floor((W - 2 * M - TW) / 7), HH = 170, RH0 = 60, FONT = '"Expo Arabic","Cairo",Arial,sans-serif';
    var cells = {}, rh = rows.map(function (r) {
      var mx = 1; DAYS.forEach(function (d) { var c = gs.filter(function (g) { return g.times_set && (g.schedule || []).some(function (z) { return z.d === d && parseInt(z.t, 10) === r[0]; }); }); cells[r[0] + '_' + d] = c; mx = Math.max(mx, c.length); });
      return 18 + mx * 54;
    });
    var tcount = {}; gs.forEach(function (g) { var k = g.teacher_id || 'none'; tcount[k] = (tcount[k] || 0) + 1; });
    var lk = Object.keys(tcount), legRows = Math.ceil(lk.length / 4), LH = lk.length ? 24 + legRows * 44 : 0;
    var H = HH + 50 + RH0 + rh.reduce(function (a, b) { return a + b; }, 0) + 30 + LH + 70;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var c = cv.getContext('2d');
    c.fillStyle = '#F6F5FF'; c.fillRect(0, 0, W, H);
    var gr = c.createLinearGradient(0, 0, W, HH); gr.addColorStop(0, '#4B40F0'); gr.addColorStop(1, '#2A1FB8'); c.fillStyle = gr; c.fillRect(0, 0, W, HH);
    c.direction = 'rtl'; c.textBaseline = 'middle';
    c.textAlign = 'right'; c.fillStyle = '#fff'; c.font = '900 46px ' + FONT; c.fillText(title(), W - M, 66);
    c.font = '700 26px ' + FONT; c.fillStyle = '#DAD8FF'; c.fillText(st.groups + ' فوج  ·  ' + st.members + ' مشارك  ·  ' + st.teachers + ' أستاذ  ·  متوسط الامتلاء ' + st.fill + '%', W - M, 122);
    c.textAlign = 'left'; c.direction = 'ltr'; c.fillStyle = '#FFE600'; c.font = '900 34px ' + FONT; c.fillText('BTL School', M, 66);
    var y = HH + 30, tr = W - M;
    function rr(x, yy, w, h, r) { c.beginPath(); c.moveTo(x + r, yy); c.arcTo(x + w, yy, x + w, yy + h, r); c.arcTo(x + w, yy + h, x, yy + h, r); c.arcTo(x, yy + h, x, yy, r); c.arcTo(x, yy, x + w, yy, r); c.closePath(); }
    c.fillStyle = '#fff'; rr(M, y, W - 2 * M, RH0 + rh.reduce(function (a, b) { return a + b; }, 0), 18); c.fill();
    c.fillStyle = '#EEEDFF'; rr(M, y, W - 2 * M, RH0, 18); c.fill(); c.fillRect(M, y + RH0 - 18, W - 2 * M, 18);
    c.textAlign = 'center'; c.direction = 'rtl'; c.fillStyle = '#2A1FB8'; c.font = '800 26px ' + FONT;
    c.fillText('الوقت', tr - TW / 2, y + RH0 / 2);
    DAYS.forEach(function (d, i) { c.fillText(DN[d], tr - TW - i * CW - CW / 2, y + RH0 / 2); });
    var yy = y + RH0;
    rows.forEach(function (r, ri) {
      c.strokeStyle = '#E4E2FF'; c.lineWidth = 2; c.beginPath(); c.moveTo(M, yy); c.lineTo(W - M, yy); c.stroke();
      c.direction = 'ltr'; c.fillStyle = '#1B1740'; c.font = '800 24px ' + FONT; c.fillText(r[1], tr - TW / 2, yy + rh[ri] / 2);
      DAYS.forEach(function (d, i) {
        var x0 = tr - TW - (i + 1) * CW;
        c.strokeStyle = '#EEEDFF'; c.beginPath(); c.moveTo(x0, yy); c.lineTo(x0, yy + rh[ri]); c.stroke();
        cells[r[0] + '_' + d].forEach(function (g, k) {
          var cx = x0 + 8, cy = yy + 10 + k * 54, cw = CW - 16;
          c.fillStyle = colorOf(g); rr(cx, cy, cw, 46, 12); c.fill();
          c.save(); c.beginPath(); c.arc(cx + 26, cy + 23, 14, 0, 6.2832); c.clip();
          if (g.language === 'FR') { c.fillStyle = '#244AA5'; c.fillRect(cx + 12, cy + 9, 10, 28); c.fillStyle = '#fff'; c.fillRect(cx + 22, cy + 9, 9, 28); c.fillStyle = '#EE2A35'; c.fillRect(cx + 31, cy + 9, 10, 28); }
          else { c.fillStyle = '#243B8F'; c.fillRect(cx + 12, cy + 9, 28, 28); c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath(); c.moveTo(cx + 12, cy + 9); c.lineTo(cx + 40, cy + 37); c.moveTo(cx + 40, cy + 9); c.lineTo(cx + 12, cy + 37); c.stroke(); c.strokeStyle = '#E8283A'; c.lineWidth = 2.4; c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 9; c.beginPath(); c.moveTo(cx + 26, cy + 9); c.lineTo(cx + 26, cy + 37); c.moveTo(cx + 12, cy + 23); c.lineTo(cx + 40, cy + 23); c.stroke(); c.strokeStyle = '#E8283A'; c.lineWidth = 5; c.stroke(); }
          c.restore();
          c.direction = 'ltr'; c.textAlign = 'left'; c.fillStyle = '#fff'; c.font = '800 22px ' + FONT; c.fillText(lvLabel(g), cx + 48, cy + 23);
          c.textAlign = 'right'; c.font = '800 20px ' + FONT; c.fillText(String(g.members), cx + cw - 12, cy + 23); c.textAlign = 'center';
        });
      });
      yy += rh[ri];
    });
    yy += 30;
    lk.forEach(function (k, i) {
      var nm = k === 'none' ? 'بلا أستاذ' : (B.teachers.filter(function (t) { return t.id === k; })[0] || {}).name || k, col = i % 4, row = Math.floor(i / 4), lx = W - M - col * ((W - 2 * M) / 4), ly = yy + 14 + row * 44;
      c.fillStyle = TC[k] || NOCOL; c.beginPath(); c.arc(lx - 12, ly, 11, 0, 6.2832); c.fill();
      c.direction = 'rtl'; c.textAlign = 'right'; c.fillStyle = '#1B1740'; c.font = '700 24px ' + FONT; c.fillText(nm + ' · ' + tcount[k], lx - 32, ly);
    });
    c.direction = 'rtl'; c.textAlign = 'center'; c.fillStyle = '#5B5780'; c.font = '700 22px ' + FONT;
    c.fillText('ص: صغار   ن: نساء   الرقم داخل الخانة: عدد المشاركين   ·   ' + new Date().toISOString().slice(0, 10), W / 2, H - 40);
    return cv;
  }
  function pdf(jpg, w, h) {
    var enc = new TextEncoder(), parts = [], off = [], len = 0, add = function (x) { var b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; }, obj = function (n, body) { off[n] = len; add(n + ' 0 obj\n' + body + '\nendobj\n'); };
    var pw = 842, ph = Math.round(842 * h / w);
    add('%PDF-1.4\n'); obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
    off[4] = len; add('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n'); add(jpg); add('\nendstream\nendobj\n');
    var cs = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q'; obj(5, '<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream');
    var xo = len; add('xref\n0 6\n0000000000 65535 f \n' + [1, 2, 3, 4, 5].map(function (n) { return ('0000000000' + off[n]).slice(-10) + ' 00000 n \n'; }).join('') + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xo + '\n%%EOF');
    return new Blob(parts, { type: 'application/pdf' });
  }
  function save(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  function download(kind) {
    H.busy(true);
    var fl = (document.fonts && document.fonts.load) ? Promise.all([document.fonts.load('800 24px "Expo Arabic"'), document.fonts.load('900 46px "Expo Arabic"')]).catch(function () {}) : Promise.resolve();
    fl.then(function () {
      var cv = draw(), nm = 'BTL-week-' + (Object.keys(F).map(function (k) { return F[k]; }).join('-') || 'all').replace(/[^A-Za-z0-9_-]+/g, '') + '-' + new Date().toISOString().slice(0, 10);
      cv.toBlob(function (bl) {
        if (kind === 'img') { H.busy(false); save(bl, nm + '.jpg'); return; }
        bl.arrayBuffer().then(function (ab) { H.busy(false); save(pdf(new Uint8Array(ab), cv.width, cv.height), nm + '.pdf'); });
      }, 'image/jpeg', .93);
    }).catch(function () { H.busy(false); H.toast('تعذر تجهيز الملف', true); });
  }
  window.BTLWEEK = { init: function (h) { H = h; }, html: html, bind: bind, reset: function () { F = {}; } };
})();
