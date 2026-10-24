// オフラインで動くよう、アプリ本体をキャッシュする。ファイルを変えたら VERSION を上げる
const VERSION = 'kararoku-v3';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/app-store.js',
  './js/store.js',
  './js/i18n.js',
  './js/ui.js',
  './js/pickers.js',
  './js/song-form.js',
  './js/detail.js',
  './js/chart.js',
  './js/filters.js',
  './js/views/register.js',
  './js/views/mylists.js',
  './js/views/songs.js',
  './js/views/settings.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// ネットワークを優先し、つながらないときはキャッシュを使う
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // 正常に取得できた自サイトのファイルだけを保存する（エラーページは残さない）
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
