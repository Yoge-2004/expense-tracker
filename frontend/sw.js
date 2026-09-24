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
    "/css/ai-intelligence.css",
    "/js/api.js",
    "/js/modules/dashboard-ml.js",
    "/js/modules/dashboard-notifications.js",
    "/favicon.ico"
];

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

// Push event - Trigger instant system notification
self.addEventListener("push", (event) => {
    let data = {
        title: "💸 Immediate Debit Alert",
        body: "A new debit transaction has occurred.",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
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
        icon: data.icon || "/favicon.ico",
        badge: data.badge || "/favicon.ico",
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
