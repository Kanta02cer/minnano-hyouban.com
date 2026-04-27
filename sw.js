/**
 * ================================================================
 *  みんなの評判.com — Service Worker
 *  - 静的アセット: Cache First（超高速な2回目以降の表示）
 *  - 記事ページ:   Network First（常に最新コンテンツ）
 *  - オフライン時: キャッシュにフォールバック
 * ================================================================
 */
'use strict';

const CACHE_NAME    = 'mhcom-v3';
const CACHE_STATIC  = 'mhcom-static-v3';

// 初回インストール時にキャッシュするアセット
const PRECACHE = [
  '/',
  '/style.css',
  '/article-renderer.js',
  '/articles.html',
  '/favicon.png',
  '/manifest.json',
  '/images/urushizawa-face-close.jpg',
  '/images/urushizawa-avatar.jpg'
];

// ── install: 静的アセットをプリキャッシュ ──────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── activate: 古いキャッシュを削除 ────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CACHE_STATIC)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── fetch: リクエスト種別ごとにキャッシュ戦略を切り替え ────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 外部リソース（CDN/GA等）はキャッシュしない
  if (url.origin !== self.location.origin) return;

  // _post/ 記事データ → Network First（常に最新を取得）
  if (url.pathname.startsWith('/_post/') || url.pathname.startsWith('/data/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // HTML（記事ページ・一覧）→ Network First
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // CSS / JS / 画像 → Cache First（静的アセット）
  event.respondWith(cacheFirst(request));
});

// Cache First: キャッシュ → なければネットワーク取得＆キャッシュ更新
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cached || new Response('Offline', { status: 503 });
  }
}

// Network First: ネットワーク → 失敗時はキャッシュにフォールバック
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}
