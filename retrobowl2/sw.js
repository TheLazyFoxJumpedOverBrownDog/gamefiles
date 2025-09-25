const CACHE_NAME = 'hypackel-v1.0.2';
const STATIC_CACHE = 'hypackel-static-v1.0.2';
const IMAGE_CACHE = 'hypackel-images-v1.0.2';
const API_CACHE = 'hypackel-api-v1.0.2';

// Cache strategies
const CACHE_STRATEGIES = {
  // Cache first for static assets
  CACHE_FIRST: 'cache-first',
  // Network first for API calls
  NETWORK_FIRST: 'network-first',
  // Stale while revalidate for images
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/library.html',
  '/offline.html',
  '/assets/css/style.css',
  '/assets/css/navbar.css',
  '/assets/css/home.css',
  '/assets/css/gms.css',
  '/assets/css/recentplays.css',
  '/assets/js/script.js',
  '/assets/js/gms.js',
  '/assets/js/navbar-scroll.js',
  '/assets/js/mobile-nav.js',
  '/assets/js/colorExtractor.js',
  '/assets/js/word-of-day.js',
  '/assets/js/tabs.js',
  '/navbar.html',
  '/index.json',
  '/app.png',
  '/favicon.ico',
  '/assets/img/icons/favicon-48x48.png',
  '/assets/img/icons/favicon.svg',
  '/assets/img/icons/apple-touch-icon.png',
  '/assets/img/icons/site.webmanifest'
];

// External CDN resources to cache (only same-origin or CORS-enabled)
const EXTERNAL_ASSETS = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
  'https://unpkg.com/aos@next/dist/aos.css',
  'https://unpkg.com/aos@next/dist/aos.js'
  // Removed FontAwesome and Google Fonts due to CORS issues
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then(cache => {
        console.log('Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      }),
      // Cache external assets
      caches.open(STATIC_CACHE).then(cache => {
        console.log('Caching external assets...');
        return cache.addAll(EXTERNAL_ASSETS);
      })
    ]).then(() => {
      console.log('Service Worker installed successfully');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && 
              cacheName !== IMAGE_CACHE && 
              cacheName !== API_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  console.log('Service Worker handling request:', request.url, 'Type:', request.destination);

  // Handle different types of requests
  if (isImageRequest(request)) {
    event.respondWith(handleImageRequest(request));
  } else if (isAPIRequest(request)) {
    event.respondWith(handleAPIRequest(request));
  } else if (isStaticAsset(request)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isHTMLRequest(request)) {
    event.respondWith(handleHTMLRequest(request));
  } else {
    event.respondWith(handleOtherRequest(request));
  }
});

// Check if request is for an image
function isImageRequest(request) {
  const url = new URL(request.url);
  return request.destination === 'image' || 
         /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(url.pathname) ||
         url.pathname.includes('/assets/gmsimgs/') ||
         url.pathname.includes('/files/') && url.pathname.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)$/i);
}

// Check if request is for API/JSON
function isAPIRequest(request) {
  const url = new URL(request.url);
  return url.pathname === '/index.json' || 
         url.pathname.includes('.json') ||
         url.pathname.includes('/api/');
}

// Check if request is for static assets
function isStaticAsset(request) {
  const url = new URL(request.url);
  return request.destination === 'style' ||
         request.destination === 'script' ||
         request.destination === 'font' ||
         /\.(css|js|woff|woff2|ttf|eot)$/i.test(url.pathname) ||
         url.pathname.includes('/assets/css/') ||
         url.pathname.includes('/assets/js/') ||
         url.hostname === 'cdn.jsdelivr.net' ||
         url.hostname === 'pro.fontawesome.com' ||
         url.hostname === 'unpkg.com' ||
         url.hostname === 'fonts.googleapis.com' ||
         url.hostname === 'fonts.gstatic.com';
}

// Check if request is for HTML
function isHTMLRequest(request) {
  return request.destination === 'document' ||
         request.headers.get('accept')?.includes('text/html');
}

// Handle image requests with stale-while-revalidate
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cachedResponse = await cache.match(request);

  // Return cached version immediately if available
  if (cachedResponse) {
    // Update cache in background
    fetch(request).then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
    }).catch(() => {
      // Ignore network errors for background updates
    });
    
    return cachedResponse;
  }

  // If not cached, fetch from network
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('Image fetch failed:', error);
    // Return a placeholder image or fallback
    return new Response('', { status: 404 });
  }
}

// Handle API requests with network-first
async function handleAPIRequest(request) {
  const cache = await caches.open(API_CACHE);
  
  try {
    // Try network first
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Fall back to cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Handle static assets with cache-first
async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('Static asset fetch failed:', error);
    throw error;
  }
}

// Handle HTML requests with network-first
async function handleHTMLRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  
  try {
    // Try network first for HTML
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('Network request failed, checking network status:', request.url);
    
    // Test if we're actually offline by trying a simple request
    let isOffline = false;
    try {
      await fetch('/favicon.ico', { method: 'HEAD', cache: 'no-cache' });
      console.log('Network is available, serving cached version');
    } catch (networkError) {
      console.log('Network is offline, will serve offline page');
      isOffline = true;
    }
    
    // If we're offline, serve offline page
    if (isOffline) {
      const offlineResponse = await cache.match('/offline.html');
      if (offlineResponse) {
        console.log('Serving offline page');
        return offlineResponse;
      }
    }
    
    // Fall back to cache if online but request failed
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('Serving cached version:', request.url);
      return cachedResponse;
    }
    
    // If no cached version and we're offline, create a simple offline response
    if (isOffline) {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>You're Offline</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px; 
              background: #1c1c1c; 
              color: white; 
            }
          </style>
        </head>
        <body>
          <h1>You're Offline</h1>
          <p>Please check your internet connection and try again.</p>
          <button onclick="window.location.href='/'">Try Again</button>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    throw error;
  }
}

// Handle other requests
async function handleOtherRequest(request) {
  try {
    return await fetch(request);
  } catch (error) {
    console.log('Request failed:', error);
    
    // If it's an HTML request, check if we're offline
    if (request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
      // Test if we're actually offline
      let isOffline = false;
      try {
        await fetch('/favicon.ico', { method: 'HEAD', cache: 'no-cache' });
        console.log('Network is available for other request');
      } catch (networkError) {
        console.log('Network is offline for other request');
        isOffline = true;
      }
      
      if (isOffline) {
        const cache = await caches.open(STATIC_CACHE);
        const offlineResponse = await cache.match('/offline.html');
        if (offlineResponse) {
          console.log('Serving offline page for:', request.url);
          return offlineResponse;
        }
      }
    }
    
    throw error;
  }
}

// Background sync for updating caches
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(updateCaches());
  }
});

// Update caches in background
async function updateCaches() {
  console.log('Background cache update started...');
  
  try {
    // Update static assets
    const staticCache = await caches.open(STATIC_CACHE);
    for (const url of STATIC_ASSETS) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await staticCache.put(url, response);
        }
      } catch (error) {
        console.log('Failed to update static asset:', url, error);
      }
    }

    // Update external assets
    for (const url of EXTERNAL_ASSETS) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await staticCache.put(url, response);
        }
      } catch (error) {
        console.log('Failed to update external asset:', url, error);
      }
    }

    console.log('Background cache update completed');
  } catch (error) {
    console.log('Background cache update failed:', error);
  }
}

// Message handling for cache management
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(clearAllCaches());
  }
  
  if (event.data && event.data.type === 'PRELOAD_IMAGES') {
    event.waitUntil(preloadImages(event.data.urls));
  }
});

// Clear all caches
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
  console.log('All caches cleared');
}

// Preload images
async function preloadImages(urls) {
  const cache = await caches.open(IMAGE_CACHE);
  const promises = urls.map(async url => {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
      }
    } catch (error) {
      console.log('Failed to preload image:', url, error);
    }
  });
  
  await Promise.all(promises);
  console.log('Image preloading completed');
}
