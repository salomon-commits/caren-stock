const CACHE_NAME = 'caren-stock-shell-v12';
const ENHANCEMENT_URL = './enhancements-inline.js';
const RECEIPT_CONTROLS_URL = './receipt-preview-controls.js';
const APP_SHELL = [
  './',
  './index.html',
  './verify.html',
  './manifest.webmanifest',
  './icon.svg',
  ENHANCEMENT_URL,
  RECEIPT_CONTROLS_URL
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function htmlResponse(text, response) {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.set('content-type', 'text/html; charset=utf-8');
  return new Response(text, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function getCode(url) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(url, copy));
      return await response.text();
    }
  } catch (_) {}

  const cached = await caches.match(url);
  return cached ? await cached.text() : '';
}

async function enhanceHtmlResponse(response) {
  if (!response) return response;
  let text = await response.text();
  const marker = '\nrenderAll();\ninitCloud();';

  if (!text.includes('/* CAREN_ENHANCEMENTS_V2 */')) {
    const enhancement = await getCode(ENHANCEMENT_URL);
    if (enhancement && text.includes(marker)) {
      text = text.replace(marker, '\n' + enhancement + marker);
    }
  }

  if (!text.includes('/* CAREN_RECEIPT_PREVIEW_CONTROLS_V1 */')) {
    const controls = await getCode(RECEIPT_CONTROLS_URL);
    if (controls && text.includes(marker)) {
      text = text.replace(marker, '\n' + controls + marker);
    }
  }

  return htmlResponse(text, response);
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(event.request, { cache: 'no-store' });
        if (networkResponse && networkResponse.ok) {
          const url = new URL(event.request.url);
          if (url.pathname.endsWith('/verify.html')) return networkResponse;

          const enhanced = await enhanceHtmlResponse(networkResponse);
          const copy = enhanced.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return enhanced;
        }
        return networkResponse;
      } catch (_) {
        const url = new URL(event.request.url);
        if (url.pathname.endsWith('/verify.html')) {
          return (await caches.match('./verify.html')) || Response.error();
        }
        const cached = await caches.match('./index.html');
        return cached ? await enhanceHtmlResponse(cached) : Response.error();
      }
    })());
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});