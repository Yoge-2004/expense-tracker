// Automatically detect local development or the deployed API.
const API_BASE_URL = ["localhost", "127.0.0.1", ""].includes(window.location.hostname)
    ? "http://localhost:8080/api"
    : "https://yoge-2004-expense-tracker-backend.hf.space/api";

let activeRequests = 0;
let loadingTimer;
let isServerOnline = true;

function ensureFeedbackUi() {
    if (document.getElementById("appToastRegion")) return;
    document.body.insertAdjacentHTML("beforeend", `
        <div id="appLoading" class="app-loading" aria-live="polite" aria-busy="true">
            <span class="spinner" aria-hidden="true"></span><span id="loadingText">Connecting to the server…</span>
        </div>
        <div id="serverStatusBadge" class="server-status-badge online" title="Server Status">
            <span class="status-dot"></span><span id="statusText">Connected</span>
        </div>
        <div id="appToastRegion" class="toast-region" aria-live="polite" aria-atomic="true"></div>`);
}

function updateServerStatus(online, message = "Connected") {
    ensureFeedbackUi();
    const badge = document.getElementById("serverStatusBadge");
    const text = document.getElementById("statusText");
    if (!badge || !text) return;

    if (online) {
        badge.className = "server-status-badge online";
        text.textContent = "Connected";
    } else {
        badge.className = "server-status-badge offline";
        text.textContent = message;
    }
}

function setLoading(isLoading, customText = "Connecting to the server…") {
    ensureFeedbackUi();
    const loader = document.getElementById("appLoading");
    const loadingText = document.getElementById("loadingText");
    if (loadingText) loadingText.textContent = customText;
    clearTimeout(loadingTimer);
    if (isLoading) {
        loadingTimer = setTimeout(() => loader.classList.add("visible"), 200);
    } else {
        loader.classList.remove("visible");
    }
}

function showToast(message, type = "info") {
    ensureFeedbackUi();
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.innerHTML = `<span>${message}</span><button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
    document.getElementById("appToastRegion").appendChild(toast);
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add("leaving");
            toast.addEventListener("transitionend", () => toast.remove(), { once: true });
        }
    }, 5000);
}

const apiCache = new Map();
const CACHE_TTL_MS = 15000;

async function checkHealth() {
    try {
        const res = await fetch(`${API_BASE_URL}/health`);
        if (res.ok) {
            const data = await res.json();
            if (data.status === "UP") {
                updateServerStatus(true, "Connected");
                return true;
            } else {
                updateServerStatus(false, "Database Down");
                return false;
            }
        } else {
            updateServerStatus(false, "Service Unavailable");
            return false;
        }
    } catch (e) {
        updateServerStatus(false, "Server Offline");
        return false;
    }
}

async function apiRequest(endpoint, options = {}) {
    const method = (options.method || "GET").toUpperCase();

    if (method !== "GET") {
        apiCache.clear();
    }

    if (method === "GET") {
        const cached = apiCache.get(endpoint);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            return cached.data;
        }
    }

    const token = localStorage.getItem("token");
    const headers = {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers
    };

    activeRequests += 1;
    setLoading(true);
    let response;
    try {
        response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
        updateServerStatus(true, "Connected");
    } catch (error) {
        updateServerStatus(false, "Server Offline");
        throw new Error("We couldn't reach the server. Please check your connection or server status.");
    } finally {
        activeRequests -= 1;
        if (activeRequests === 0) setLoading(false);
    }

    if (response.status === 503) {
        updateServerStatus(false, "Database Unavailable");
        const text = await response.text();
        let msg = "Database service is unavailable. Please try again later.";
        try {
            const err = JSON.parse(text);
            if (err.message) msg = err.message;
        } catch (e) {}
        showToast(msg, "error");
        throw new Error(msg);
    }

    if (response.status === 401 && !endpoint.includes("/auth/login")) {
        localStorage.clear();
        window.location.href = "index.html";
        throw new Error("Your session has expired. Please sign in again.");
    }

    if (response.status === 204) return null;

    const text = await response.text();
    if (!response.ok) {
        try {
            const error = JSON.parse(text);
            throw new Error(error.message || error.error || "Request failed.");
        } catch (error) {
            if (error.message && !error.message.includes("JSON")) throw error;
            throw new Error("The server is temporarily unavailable. Please try again in a moment.");
        }
    }

    const data = text ? JSON.parse(text) : null;

    if (method === "GET") {
        apiCache.set(endpoint, { data, timestamp: Date.now() });
    }

    return data;
}

// Initial health check on page load
document.addEventListener("DOMContentLoaded", () => {
    checkHealth();
    setInterval(checkHealth, 30000);
});
