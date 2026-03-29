// BuenTrato.AI — Service Worker
// Estrategia: Cache la interfaz (HTML, CSS, imágenes, fonts),
// pero SIEMPRE ir a la red para APIs (Netlify functions, Airtable, Claude)

const CACHE_NAME = 'buentrato-v1';

// Archivos esenciales para cachear (la "shell" de la app)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/informe.html',
  '/disc.html',
  '/ie.html',
  '/autoliderazgo.html',
  '/estilos.html',
  '/plan.html',
  '/experiencia.html',
  '/logo.png',
  '/carita.png',
  '/favicon.png',
  '/favicon-32.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Instalar: pre-cachear archivos esenciales
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activar: limpiar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: decidir si usar cache o red
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // SIEMPRE ir a la red para:
  // - Llamadas a funciones de Netlify (API)
  // - Requests POST
  // - Airtable / Anthropic
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/.netlify/') ||
    url.hostname.includes('airtable.com') ||
    url.hostname.includes('anthropic.com')
  ) {
    return; // No interceptar, dejar que el navegador haga el fetch normal
  }

  // Para Google Fonts: cache-first (no cambian)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Para archivos locales: network-first con fallback a cache
  // Así siempre ven la versión más nueva, pero si no hay red, funciona el cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si el fetch fue exitoso, actualizar el cache
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Sin conexión: servir desde cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Si es una página HTML y no está en cache, mostrar la página principal
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
        });
      })
  );
});