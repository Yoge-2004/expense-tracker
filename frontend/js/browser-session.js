/* Browser-only session transport. Kept ES3-parseable for the legacy mobile page. */
(function (global) {
    var SESSION_KEY = "token";
    var CSRF_COOKIE = "ET_CSRF";
    var BROWSER_HEADER = "X-Browser-Session";
    var CSRF_HEADER = "X-XSRF-TOKEN";
    var legacyToken = "";
    var migrationPromise = null;
    var migrationComplete = false;
    var migrationRetryAfter = 0;

    function safeGet(storageName, key) {
        try { return global[storageName].getItem(key) || ""; } catch (error) { return ""; }
    }

    function safeRemove(storageName, key) {
        try { global[storageName].removeItem(key); } catch (error) { /* Browser storage can be disabled. */ }
    }

    function resolveApiBase() {
        var configured = global.API_BASE_URL || safeGet("localStorage", "expense_api_url");
        var hostname = global.location.hostname;
        var origin = global.location.origin || global.location.protocol + "//" + global.location.host;
        var localHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
        var staticDevPort = localHost && global.location.port && global.location.port !== "8080";
        if (!configured) {
            configured = staticDevPort ? "http://" + (hostname === "127.0.0.1" ? "127.0.0.1" : "localhost") + ":8080/api"
                : global.location.protocol === "file:" ? "http://localhost:8080/api"
                : origin + "/api";
        }
        var link = document.createElement("a");
        link.href = configured;
        var targetHost = link.hostname || hostname;
        var targetProtocol = link.protocol || global.location.protocol;
        var loopback = targetHost === "localhost" || targetHost === "127.0.0.1" || targetHost === "::1";
        var allowedBackend = targetHost === "yoge-2004-expense-tracker-backend.hf.space";
        var sameOrigin = targetHost === hostname && targetProtocol === global.location.protocol
            && (!link.port || link.port === global.location.port);
        var safeProtocol = targetProtocol === "https:" || (loopback && targetProtocol === "http:");
        if (!safeProtocol || link.username || link.password || link.search || link.hash
                || (!loopback && !allowedBackend && !sameOrigin)) {
            return global.location.protocol === "file:" ? "http://localhost:8080/api" : origin + "/api";
        }
        return link.href.replace(/\/$/, "");
    }

    var apiBaseUrl = resolveApiBase();

    function readCookie(name) {
        var cookies = document.cookie.split(";");
        var prefix = name + "=";
        for (var i = 0; i < cookies.length; i++) {
            var cookie = cookies[i].replace(/^\s+/, "");
            if (cookie.indexOf(prefix) === 0) {
                try { return decodeURIComponent(cookie.substring(prefix.length)); }
                catch (error) { return cookie.substring(prefix.length); }
            }
        }
        return "";
    }

    function storeProfile(profile) {
        if (!profile || !profile.userId) return;
        var values = {
            userId: profile.userId,
            userName: profile.name || profile.username || "User",
            userEmail: profile.email || "",
            userRole: profile.role || "ROLE_USER",
            userUsername: profile.username || "",
            userCurrency: profile.currency || "INR"
        };
        var key;
        try {
            for (key in values) {
                if (Object.prototype.hasOwnProperty.call(values, key)) global.localStorage.setItem(key, String(values[key]));
            }
            if (profile.profilePictureUrl) global.localStorage.setItem("userProfilePicture", profile.profilePictureUrl);
            else global.localStorage.removeItem("userProfilePicture");
        } catch (error) { /* Cookie session remains available when preferences cannot be persisted. */ }
    }

    function clearLegacyTokens() {
        safeRemove("localStorage", SESSION_KEY);
        safeRemove("sessionStorage", SESSION_KEY);
        legacyToken = "";
    }

    function clearProfileCache() {
        var keys = ["userId", "userName", "userEmail", "userRole", "userUsername", "userProfilePicture"];
        var i;
        for (i = 0; i < keys.length; i++) safeRemove("localStorage", keys[i]);
    }

    function migrationRequest() {
        if (migrationPromise) return migrationPromise;
        if (migrationComplete) return global.Promise ? global.Promise.resolve(true) : true;
        if (new Date().getTime() < migrationRetryAfter) return global.Promise ? global.Promise.resolve(false) : false;
        var storedToken = safeGet("localStorage", SESSION_KEY) || safeGet("sessionStorage", SESSION_KEY);
        if (!storedToken) {
            migrationComplete = true;
            return global.Promise ? global.Promise.resolve(true) : true;
        }
        legacyToken = storedToken;

        if (!global.fetch || !global.Promise) {
            if (!global.XMLHttpRequest) {
                migrationRetryAfter = new Date().getTime() + 30000;
                return true;
            }
            var xhr = new global.XMLHttpRequest();
            xhr.open("POST", apiBaseUrl + "/auth/session", true);
            xhr.withCredentials = true;
            xhr.timeout = 5000;
            xhr.setRequestHeader("Authorization", "Bearer " + storedToken);
            xhr.setRequestHeader(BROWSER_HEADER, "1");
            xhr.setRequestHeader("Accept", "application/json");
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { storeProfile(JSON.parse(xhr.responseText)); } catch (error) { /* Keep profile cache. */ }
                    clearLegacyTokens();
                    migrationComplete = true;
                } else if (xhr.status === 401 || xhr.status === 403) {
                    clearLegacyTokens();
                    migrationComplete = true;
                } else migrationRetryAfter = new Date().getTime() + 30000;
            };
            xhr.ontimeout = function () { migrationRetryAfter = new Date().getTime() + 30000; };
            try { xhr.send(null); } catch (error) { migrationRetryAfter = new Date().getTime() + 30000; }
            return true;
        }

        var migrationOptions = {
            method: "POST",
            credentials: "include",
            headers: { "Authorization": "Bearer " + storedToken, "X-Browser-Session": "1", "Accept": "application/json" }
        };
        var migrationController = null;
        var migrationTimer = null;
        if (global.AbortSignal && typeof global.AbortSignal.timeout === "function") {
            migrationOptions.signal = global.AbortSignal.timeout(5000);
        } else if (global.AbortController) {
            migrationController = new global.AbortController();
            migrationOptions.signal = migrationController.signal;
            migrationTimer = global.setTimeout(function () { migrationController.abort(); }, 5000);
        }
        migrationPromise = global.fetch(apiBaseUrl + "/auth/session", migrationOptions).then(function (response) {
            if (response.ok) {
                return response.json().then(function (profile) {
                    storeProfile(profile);
                    clearLegacyTokens();
                    migrationComplete = true;
                    return true;
                });
            }
            if (response.status === 401 || response.status === 403) {
                clearLegacyTokens();
                migrationComplete = true;
            } else migrationRetryAfter = new Date().getTime() + 30000;
            return false;
        }).catch(function () {
            migrationRetryAfter = new Date().getTime() + 30000;
            return false;
        }).then(function (result) {
            if (migrationTimer) global.clearTimeout(migrationTimer);
            migrationPromise = null;
            return result;
        });
        return migrationPromise;
    }

    function isUnsafe(method) {
        method = String(method || "GET").toUpperCase();
        return method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && method !== "TRACE";
    }

    function headersFor(method, requestUrl, headers) {
        headers = headers || {};
        var link = document.createElement("a");
        link.href = requestUrl;
        var path = link.pathname || requestUrl;
        var sameHost = (link.hostname || global.location.hostname) === global.location.hostname
            && (link.protocol || global.location.protocol) === global.location.protocol;
        var verb = String(method || "GET").toUpperCase();
        var isBrowserLogin = verb === "POST" && (/\/auth\/(login|oauth\/google|session)$/.test(path)
            || /\/webauthn\/login\/finish$/.test(path));
        if (isBrowserLogin) headers[BROWSER_HEADER] = "1";
        if (isUnsafe(method) && sameHost) {
            var csrf = readCookie(CSRF_COOKIE);
            if (csrf) headers[CSRF_HEADER] = csrf;
        }
        if (legacyToken && !headers.Authorization) headers.Authorization = "Bearer " + legacyToken;
        return headers;
    }

    function configureXhr(xhr, method, requestUrl) {
        xhr.withCredentials = true;
        var headers = headersFor(method, requestUrl, {});
        var name;
        for (name in headers) {
            if (Object.prototype.hasOwnProperty.call(headers, name)) xhr.setRequestHeader(name, headers[name]);
        }
    }

    function request(input, options) {
        options = options || {};
        var ready = migrationRequest();
        var run = function () {
            var settings = {};
            var key;
            for (key in options) if (Object.prototype.hasOwnProperty.call(options, key)) settings[key] = options[key];
            var headers = {};
            var sourceHeaders = options.headers || {};
            if (global.Headers && sourceHeaders instanceof global.Headers) {
                sourceHeaders.forEach(function (value, name) { headers[name] = value; });
            } else {
                for (key in sourceHeaders) if (Object.prototype.hasOwnProperty.call(sourceHeaders, key)) headers[key] = sourceHeaders[key];
            }
            var target = typeof input === "string" ? input : input.url;
            settings.headers = headersFor(settings.method || "GET", target, headers);
            settings.credentials = "include";
            return global.fetch(input, settings);
        };
        return global.Promise ? global.Promise.resolve(ready).then(run) : run();
    }

    function restore() {
        return request(apiBaseUrl + "/auth/session", { method: "GET", headers: { Accept: "application/json" } })
            .then(function (response) {
                if (!response.ok) return null;
                return response.json().then(function (profile) { storeProfile(profile); return profile; });
            });
    }

    function logout() {
        if (typeof global.clearApiCache === "function") global.clearApiCache();
        if (!global.fetch && global.XMLHttpRequest) {
            var xhr = new global.XMLHttpRequest();
            xhr.open("POST", apiBaseUrl + "/auth/logout", true);
            configureXhr(xhr, "POST", apiBaseUrl + "/auth/logout");
            try { xhr.send(null); } catch (error) { /* Local identity is still cleared below. */ }
            clearLegacyTokens();
            clearProfileCache();
            try { global.localStorage.setItem("expense_session_logout", String(new Date().getTime())); } catch (storageError) { /* Optional cross-tab notification. */ }
            return true;
        }
        return request(apiBaseUrl + "/auth/logout", { method: "POST" }).then(function () {
            clearLegacyTokens();
            clearProfileCache();
            try { global.localStorage.setItem("expense_session_logout", String(new Date().getTime())); } catch (error) { /* Optional cross-tab notification. */ }
        }, function (error) {
            clearLegacyTokens();
            try { global.localStorage.setItem("expense_session_logout", String(new Date().getTime())); } catch (storageError) { /* Optional cross-tab notification. */ }
            throw error;
        });
    }

    global.BrowserSession = {
        apiBaseUrl: apiBaseUrl,
        prepare: migrationRequest,
        request: request,
        restore: restore,
        logout: logout,
        storeProfile: storeProfile,
        clearLegacyTokens: clearLegacyTokens,
        headersFor: headersFor,
        configureXhr: configureXhr
    };

    migrationRequest();
})(window);
