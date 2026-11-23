/* Service Worker: الإشعارات + العمل دون اتصال للصفحات الأساسية */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
importScripts('./config.js');

firebase.initializeApp(self.BTL_CONFIG.firebase);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  var d = payload.data || {};
  self.registration.showNotification(d.title || 'منصة BTL', {
    body: d.body || '',
    icon: 'assets/icons/icon-192.png',
    badge: 'assets/icons/icon-192.png',
    dir: 'rtl', lang: 'ar',
    data: { url: d.url || './' }
  });
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) { list[i].navigate(url); return list[i].focus(); } }
    return clients.openWindow(url);
  }));
});
