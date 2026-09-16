/* Service Worker — بضاعة الأمانة (IFT)
   الهدف: تشغيل واجهة التطبيق (App Shell) بدون إنترنت.
   ملاحظة: الاتصال الفعلي بقاعدة البيانات (Firebase Realtime Database) يتم عبر
   WebSocket من مكتبة Firebase نفسها ولا يمر عبر هذا الـ Service Worker إطلاقًا،
   ولذلك مزامنة البيانات نفسها تُدار داخل صفحة التطبيق (IndexedDB Outbox) وليس هنا.
*/
const CACHE_NAME = 'ift-amana-shell-v2'; // رفعنا رقم النسخة عشان أي متصفح فيه نسخة قديمة مخزّنة ياخد التحديث فورًا
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((e) => console.error('SW install cache error', e))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// استراتيجية: "الكاش أولاً مع تحديث في الخلفية" (Stale-While-Revalidate)
// بيضمن فتح فوري للتطبيق حتى بدون إنترنت، مع تحديث النسخة المخزّنة كل مرة يكون فيها اتصال.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // العمليات غير GET بتتعالج مباشرة عبر Firebase SDK (WebSocket) — لا نتدخل فيها

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached); // مفيش إنترنت — نرجع آخر نسخة محفوظة لو موجودة

      return cached || networkFetch;
    })
  );
});
