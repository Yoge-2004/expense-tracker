(function () {
    "use strict";

    const DASHBOARD_CACHE_PREFIXES = ["expenseCache_v2_", "expenseCache_"];
    const API_CACHE_NAMES = new Set(["expense-tracker-data-v1"]);
    const status = document.getElementById("recoveryStatus");
    const button = document.getElementById("exportRecovery");

    function readLocalStorage() {
        const values = {};
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (!key || !DASHBOARD_CACHE_PREFIXES.some(prefix => key.startsWith(prefix))) {
                continue;
            }
            const raw = localStorage.getItem(key);
            try {
                values[key] = { raw, parsed: JSON.parse(raw) };
            } catch (_) {
                values[key] = { raw, parsed: null, parseError: true };
            }
        }
        return values;
    }

    async function readApiCaches() {
        const result = {};
        if (!("caches" in window)) return result;

        for (const cacheName of await caches.keys()) {
            if (!API_CACHE_NAMES.has(cacheName)) continue;
            const cache = await caches.open(cacheName);
            const entries = [];
            for (const request of await cache.keys()) {
                const response = await cache.match(request);
                if (!response) continue;
                entries.push({
                    url: request.url,
                    status: response.status,
                    headers: Object.fromEntries(response.headers.entries()),
                    body: await response.clone().text()
                });
            }
            result[cacheName] = entries;
        }
        return result;
    }

    function download(payload) {
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: "application/json"
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `expense-tracker-recovery-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    button.addEventListener("click", async () => {
        button.disabled = true;
        status.textContent = "Reading this device…";
        try {
            const payload = {
                format: "expense-tracker-recovery-v1",
                exportedAt: new Date().toISOString(),
                origin: location.origin,
                localStorage: readLocalStorage(),
                cacheStorage: await readApiCaches()
            };
            download(payload);
            status.textContent = "Recovery file downloaded. Send it through a private, approved channel.";
        } catch (error) {
            console.error("Recovery export failed", error);
            status.textContent = "Could not read the local cache. Do not clear browser data; contact support.";
        } finally {
            button.disabled = false;
        }
    });
})();
