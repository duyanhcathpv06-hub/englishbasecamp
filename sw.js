/* English Base Camp – Service Worker
 * ĐỔI SỐ VERSION mỗi lần đăng bản mới (sửa đề, sửa code) để học sinh nhận bản mới. */
const VERSION = 'ebc-v5';
const CORE = `${VERSION}-core`;
const RUNTIME = `${VERSION}-runtime`;
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

// Không bao giờ cache: dữ liệu động / nộp bài / AI
const BYPASS = [
  'firestore.googleapis.com', 'firebaseio.com', 'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com', 'generativelanguage.googleapis.com',
  'translate.googleapis.com', 'googleapis.com/identitytoolkit'
];
// Tài nguyên tĩnh bên thứ ba được phép cache để học offline
const STATIC_HOSTS = ['cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(PRECACHE)));
  // KHÔNG skipWaiting tự động: chờ người dùng bấm "Cập nhật" để không ngắt bài đang làm
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (BYPASS.some(h => url.hostname.includes(h) || req.url.includes(h))) return;

  // Trang HTML: ưu tiên mạng (để sửa đề lan tới học sinh), rớt mạng thì dùng bản đã lưu
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        const c = await caches.open(CORE);
        c.put('./index.html', res.clone());
        return res;
      } catch (_) {
        return (await caches.match('./index.html')) || (await caches.match('./')) ||
          new Response('Đang offline và chưa có bản lưu.', { status: 503 });
      }
    })());
    return;
  }

  const sameOrigin = url.origin === location.origin;
  if (!sameOrigin && !STATIC_HOSTS.includes(url.hostname)) return;

  // Tài nguyên tĩnh: stale-while-revalidate
  e.respondWith((async () => {
    const cache = await caches.open(sameOrigin ? CORE : RUNTIME);
    const hit = await cache.match(req);
    const net = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return hit || (await net) || new Response('', { status: 504 });
  })());
});
