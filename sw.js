// Service Worker: يجعل التطبيق يعمل بدون إنترنت بعد أول فتح
// عند تعديل أي ملف: غيّر رقم VERSION حتى يحصل المستخدمون على النسخة الجديدة.
const VERSION = 'hurufi-v1';
const APP_CACHE = VERSION + '-app';
const MEDIA_CACHE = 'hurufi-media'; // الخطوط والتلاوات — لا تُمسح عند التحديث

const APP_FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js', 'js/lesson.js', 'js/content.js', 'js/compare.js', 'js/speech.js', 'js/sounds.js', 'js/storage.js',
  'data/courses.json', 'data/arabic.json', 'data/kurdish.json', 'data/quran.json', 'data/quran-text.json',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== APP_CACHE && k !== MEDIA_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isMedia = url => /\.(mp3|ogg|m4a|wav)$/i.test(url.pathname) || url.hostname.includes('everyayah') || url.hostname.includes('qurancdn');
const isFont = url => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // ملفات التطبيق: من الذاكرة فوراً، مع تحديثها من الشبكة في الخلفية (ليظهر تعديل JSON في الفتحة التالية)
  if (url.origin === self.location.origin && !isMedia(url)) {
    e.respondWith(
      caches.open(APP_CACHE).then(async cache => {
        const cached = await cache.match(req, { ignoreSearch: true }) ||
                       (req.mode === 'navigate' ? await cache.match('index.html') : undefined);
        const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => cached);
        return cached || net;
      })
    );
    return;
  }

  // الخطوط: من الذاكرة أولاً
  if (isFont(url)) {
    e.respondWith(
      caches.open(MEDIA_CACHE).then(async cache => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // الصوت: من الشبكة، وإن لم تتوفر فمن الذاكرة
  if (isMedia(url)) {
    e.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(MEDIA_CACHE);
        return (await cache.match(url.href, { ignoreVary: true })) || Response.error();
      })
    );
  }
});

// التطبيق يطلب حفظ ملفات صوتية (بعد سماعها، أو بزر "حفظ التلاوة")
self.addEventListener('message', e => {
  if (e.data?.type !== 'cache-audio') return;
  e.waitUntil((async () => {
    const cache = await caches.open(MEDIA_CACHE);
    for (const u of e.data.urls || []) {
      try {
        if (await cache.match(u)) continue;
        const res = await fetch(u, { mode: 'no-cors' });
        if (res.ok || res.type === 'opaque') await cache.put(u, res);
      } catch { /* بدون إنترنت — نتجاوز */ }
    }
  })());
});
