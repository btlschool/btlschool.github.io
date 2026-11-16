/**
 * منصة BTL - إشعارات الدفع (Firebase Cloud Messaging HTTP v1).
 * يحتاج خاصية سكربت FCM_SERVICE_ACCOUNT = نص ملف JSON لحساب الخدمة (Firebase > إعدادات المشروع > حسابات الخدمة > إنشاء مفتاح).
 * لا تُحفظ الأسرار في الشيت. الرسائل من نوع data فقط ويعرضها service worker في الواجهة.
 */
function fcmAccount_() {
  var raw = PropertiesService.getScriptProperties().getProperty('FCM_SERVICE_ACCOUNT');
  if (!raw) return null;
  try { var a = JSON.parse(raw); return a && a.private_key && a.client_email && a.project_id ? a : null; } catch (e) { return null; }
}

function b64u_(bytesOrStr) { return Utilities.base64EncodeWebSafe(bytesOrStr).replace(/=+$/, ''); }

function fcmAccessToken_(acc) {
  var cache = CacheService.getScriptCache(), hit = cache.get('fcm_at');
  if (hit) return hit;
  var nowS = Math.floor(Date.now() / 1000), uri = acc.token_uri || 'https://oauth2.googleapis.com/token';
  var head = b64u_(JSON.stringify({ alg: 'RS256', typ: 'JWT' })), claim = b64u_(JSON.stringify({ iss: acc.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: uri, iat: nowS, exp: nowS + 3600 }));
  var sig = b64u_(Utilities.computeRsaSha256Signature(head + '.' + claim, acc.private_key));
  var res = UrlFetchApp.fetch(uri, { method: 'post', payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + claim + '.' + sig }, muteHttpExceptions: true });
  var j = parseJson_(res.getContentText(), {});
  if (!j.access_token) throw new Error('fcm_token_failed:' + String(res.getContentText()).slice(0, 120));
  cache.put('fcm_at', j.access_token, 3000);
  return j.access_token;
}

/** يرسل لجهاز واحد. يعيد 'ok' | 'dead' (رمز غير صالح) | 'error'. */
function fcmSend_(acc, token, data) {
  var res = UrlFetchApp.fetch('https://fcm.googleapis.com/v1/projects/' + acc.project_id + '/messages:send', { method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + fcmAccessToken_(acc) },
    payload: JSON.stringify({ message: { token: token, data: data, webpush: { headers: { Urgency: 'high', TTL: '86400' } } } }), muteHttpExceptions: true });
  var code = res.getResponseCode();
  if (code === 200) return 'ok';
  var body = String(res.getContentText());
  return code === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(body) ? 'dead' : 'error';
}

/** يرسل إشعارا لكل أجهزة المستخدم الفعّالة. يعيد {configured, sent, devices}. لا يرمي أخطاء. */
function pushToUser_(userId, title, body, url) {
  var out = { configured: false, sent: 0, devices: 0 };
  try {
    var acc = fcmAccount_();
    if (!acc) return out;
    out.configured = true;
    var devs = rows_('Devices').filter(function (d) { return String(d.user_id) === String(userId) && String(d.active) === '1' && nz_(d.fcm_token); });
    out.devices = devs.length;
    devs.forEach(function (d) {
      var r = fcmSend_(acc, String(d.fcm_token), { title: String(title), body: String(body), url: String(url || appUrl_()) });
      if (r === 'ok') out.sent++;
      else if (r === 'dead') updateRow_('Devices', d._row, { active: '0' });
    });
  } catch (e) { log_('push_error', String(userId), String(e)); }
  return out;
}

/** device_register: data {fcm_token, platform?, installed?}. يسجّل/يحدّث جهاز المستخدم ويرسل إشعار ترحيب للتأكد. */
function act_deviceRegister_(ctx) {
  var u = ctx.user, tok = String(ctx.data.fcm_token || '');
  if (tok.length < 40 || tok.length > 4096) fail_('bad_token');
  var plat = ['android', 'ios', 'desktop'].indexOf(String(ctx.data.platform)) >= 0 ? String(ctx.data.platform) : 'desktop', inst = ctx.data.installed ? '1' : '0';
  var d = rows_('Devices').filter(function (r) { return String(r.fcm_token) === tok; })[0];
  if (d) updateRow_('Devices', d._row, { user_id: String(u.user_id), platform: plat, installed: inst, notif_permission: 'granted', last_seen: now_(), active: '1' });
  else appendRow_('Devices', { device_id: uid_('dv'), user_id: String(u.user_id), fcm_token: tok, platform: plat, installed: inst, notif_permission: 'granted', first_seen: now_(), last_seen: now_(), active: '1' });
  var ur = findRowFast_('Users', 'user_id', String(u.user_id));
  if (ur) updateRow_('Users', ur._row, { notif_status: 'granted', platform: plat, installed: inst, installed_at: inst === '1' && !nz_(ur.installed_at) ? now_() : String(ur.installed_at || '') });
  var p = pushToUser_(u.user_id, 'تم تفعيل الإشعارات', 'سيصلك هنا كل ما يهمّك في وقته.', appUrl_());
  return { ok: true, configured: p.configured, sent: p.sent };
}

/** push_test: إشعار تجريبي لأجهزتي. */
function act_pushTest_(ctx) {
  var p = pushToUser_(ctx.user.user_id, 'اختبار الإشعارات', 'وصلك هذا الإشعار، فكل شيء يعمل.', appUrl_());
  return { configured: p.configured, devices: p.devices, sent: p.sent };
}
