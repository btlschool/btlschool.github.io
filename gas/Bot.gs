/**
 * بوت تلغرام @BTLSchoolBot - نسخة اختبار التحقق من الهاتف.
 * الأسرار في Script Properties فقط: BOT_TOKEN (من BotFather) و WEBHOOK_SECRET (يُولَّد تلقائيا).
 */

function tgToken_() {
  var t = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
  if (!t) fail_('bot_token_missing');
  return t;
}

function tg_(method, payload) {
  var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + tgToken_() + '/' + method, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(payload || {}), muteHttpExceptions: true
  });
  return JSON.parse(r.getContentText());
}

/** شغّلها مرة واحدة بعد نشر تطبيق الويب: تولّد السر وتربط البوت بالرابط. */
function setupWebhook() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('WEBHOOK_SECRET');
  if (!secret) { secret = Utilities.getUuid().replace(/-/g, ''); props.setProperty('WEBHOOK_SECRET', secret); }
  var url = ScriptApp.getService().getUrl() + '?k=' + secret;
  var res = tg_('setWebhook', { url: url, allowed_updates: ['message'], drop_pending_updates: true });
  Logger.log(JSON.stringify(res));
  return res;
}

function webhookInfo() { Logger.log(JSON.stringify(tg_('getWebhookInfo'))); }

function handleTelegram_(e) {
  var ok = ContentService.createTextOutput('ok');
  var secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  if (!secret || e.parameter.k !== secret) return ok;
  var up;
  try { up = JSON.parse(e.postData.contents); } catch (err) { return ok; }
  var m = up.message;
  if (!m || !m.chat || m.chat.type !== 'private') return ok;
  try {
    if (m.contact) { tgOnContact_(m); }
    else if (m.text && m.text.indexOf('/start') === 0) { tgOnStart_(m); }
    else { tgAskContact_(m.chat.id); }
  } catch (err) { log_('tg_error', String(m.from && m.from.id), String(err && err.stack || err)); }
  return ok;
}

function tgAskContact_(chatId) {
  tg_('sendMessage', {
    chat_id: chatId,
    text: 'مرحبا بك في مدرسة BTL.\nلتأكيد رقم هاتفك اضغط الزر في الأسفل.',
    reply_markup: { keyboard: [[{ text: 'مشاركة رقم هاتفي', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true }
  });
}

function tgOnStart_(m) {
  var parts = String(m.text).split(' ');
  CacheService.getScriptCache().put('tgstart_' + m.from.id, parts[1] || '', 3600);
  tgAskContact_(m.chat.id);
}

function tgOnContact_(m) {
  var c = m.contact;
  if (!c.user_id || c.user_id !== m.from.id) {
    tg_('sendMessage', { chat_id: m.chat.id, text: 'يجب مشاركة رقمك أنت بالزر، لا رقم شخص آخر.' });
    return;
  }
  var raw = String(c.phone_number || '');
  var phone = normPhone_(/^\d/.test(raw) ? '+' + raw : raw);
  if (!phone) {
    tg_('sendMessage', { chat_id: m.chat.id, text: 'هذا الرقم ليس رقما جزائريا. تواصل معنا عبر واتساب: ' + getSetting_('whatsapp', '') });
    return;
  }
  var token = CacheService.getScriptCache().get('tgstart_' + m.from.id) || '';
  audit_('telegram', 'phone_verified', phone, 'tg_id=' + m.from.id + ' start=' + token);
  tg_('sendMessage', {
    chat_id: m.chat.id,
    text: 'تم تأكيد رقمك: ' + phone + '\nيمكنك العودة إلى منصة BTL.',
    reply_markup: { remove_keyboard: true }
  });
}
