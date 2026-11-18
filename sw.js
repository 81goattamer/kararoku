// オフラインで動くよう、アプリ本体をキャッシュする。版は version.js の APP_VERSION を使う
importScripts('./version.js');
const VERSION = `kararoku-${self.APP_VERSION}`;
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './version.js',
  './css/style.css',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/update.js',
  './js/app-store.js',
  './js/images.js',
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
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    // ブラウザのキャッシュに古いファイルが残っていても、サーバーに確かめて新しいものを使う
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        // 正常に取得できた自サイトのファイルだけを保存する（エラーページと更新確認用の ?t= は残さない）
        if (res.ok && res.type === 'basic' && !url.search) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
