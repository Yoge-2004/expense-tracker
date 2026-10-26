/* ==========================================================================
   SERVICE WORKER FOR EXPENSE TRACKER PRO
   Enables Web Push notifications, immediate offline caching, and background
   debit transaction alerts.
   ========================================================================== */

const CACHE_NAME = "expense-tracker-cache-v1";
const ASSETS_TO_CACHE = [
    "/",
    "/index.html",
    "/dashboard.html",
    "/css/style.css",
    "/css/motion-extended.css",
    "/css/dashboard-powerbi.css",
    "/css/ai-intelligence.css",
    "/js/api.js",
    "/js/modules/dashboard-ml.js",
    "/js/modules/dashboard-notifications.js",
    "/favicon.ico",
    "/assets/icon-192.png",
    "/assets/badge-72.png",
    "/assets/custom_chime.wav"
];

// Helper to guarantee fully-qualified absolute URLs for notification icons and badges
function toAbsoluteUrl(path) {
    try {
        if (!path) return "";
        if (path.startsWith("http://") || path.startsWith("https://")) return path;
        return new URL(path, self.location.origin).href;
    } catch (_) {
        return path;
    }
}

// Install event - Pre-cache core shell
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
        })
    );
    self.skipWaiting();
});

// Activate event - Cleanup obsolete caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - Serve cached static assets with network fallback; bypass API/mutations
self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") return;

    const url = new URL(request.url);

    // Bypass API calls, websockets, and browser extensions
    if (url.pathname.startsWith("/api/") || !url.protocol.startsWith("http")) {
        return;
    }

    // Navigation requests (HTML pages): Network-First with cache fallback
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => { return cache.put(request, responseClone); }).catch(() => {});
                }
                return networkResponse;
            }).catch(() => caches.match(request).then((cached) => cached || caches.match("/dashboard.html")))
        );
        return;
    }

    // Static assets (CSS, JS, images, fonts): Cache-First with network fallback & stale-while-revalidate
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => { return cache.put(request, networkResponse); }).catch(() => {});
                    }
                }).catch(() => {});
                return cachedResponse;
            }
            return fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => { return cache.put(request, responseClone); }).catch(() => {});
                }
                return networkResponse;
            });
        })
    );
});

// Push event - Trigger instant system notification
self.addEventListener("push", (event) => {
    const defaultIcon = toAbsoluteUrl("/assets/icon-192.png");
    const defaultBadge = toAbsoluteUrl("/assets/badge-72.png");

    let data = {
        title: "💸 Immediate Debit Alert",
        body: "A new debit transaction has occurred.",
        icon: defaultIcon,
        badge: defaultBadge,
        url: "/dashboard.html",
        data: {}
    };

    if (event.data) {
        try {
            const json = event.data.json();
            data = Object.assign(data, json);
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: toAbsoluteUrl(data.icon) || defaultIcon,
        badge: toAbsoluteUrl(data.badge) || defaultBadge,
        vibrate: [100, 50, 100],
        data: {
            url: data.url || "/dashboard.html",
            ...data.data
        },
        actions: [
            { action: "open_record", title: "Record / Categorize" },
            { action: "dismiss", title: "Dismiss" }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification Click event
self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    if (event.action === "dismiss") {
        return;
    }

    const targetUrl = (event.notification.data && event.notification.data.url) || "/dashboard.html";

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes("dashboard.html") && "focus" in client) {
                    client.postMessage({
                        type: "DEBIT_NOTIFICATION_CLICKED",
                        data: event.notification.data
                    });
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
