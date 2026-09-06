/**
 * Server-verified WebAuthn/passkey authentication for Expense Tracker.
 * No JWT or password is stored as a biometric credential. The browser's
 * authenticator holds the private key and the server verifies every assertion.
 */

// Remove legacy authentication-test query parameters before dashboard.js runs.
// This prevents a test-only URL from altering production authentication state.
if (window.location.search.includes('test_mock_auth')) {
    const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
    window.history.replaceState({}, document.title, cleanUrl);
}

// Remove tokens created by the old, insecure browser-only biometric implementation.
localStorage.removeItem("webauthn_bio_token");
localStorage.removeItem("webauthn_bio_email");
localStorage.removeItem("webauthn_bio_cred_id");

// Keep logout focused on authentication state. Preferences and dashboard caches
// should survive sign-out, while the dashboard's legacy handler is prevented
// from clearing unrelated localStorage entries.
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        ["token", "userId", "userName", "userEmail"].forEach((key) => localStorage.removeItem(key));
        window.location.href = "index.html";
    }, true);
}

const WebBiometrics = {
    async isAvailable() {
        if (!window.PublicKeyCredential || !window.isSecureContext) return false;
        try {
            return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch (_) {
            return false;
        }
    },

    // The button should be discoverable on every compatible device. The browser
    // authenticator, not localStorage, determines whether a passkey exists.
    isEnabled() {
        return !!window.PublicKeyCredential && !!window.isSecureContext;
    },

    _decodeBase64Url(value) {
        const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
        const binary = atob(padded);
        return Uint8Array.from(binary, c => c.charCodeAt(0));
    },

    _encodeBase64Url(value) {
        const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
        let binary = "";
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
        }
        return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    },

    _creationOptions(json) {
        const options = typeof json === "string" ? JSON.parse(json) : structuredClone(json);
        options.challenge = this._decodeBase64Url(options.challenge);
        if (options.user?.id) options.user.id = this._decodeBase64Url(options.user.id);
        if (Array.isArray(options.excludeCredentials)) {
            options.excludeCredentials = options.excludeCredentials.map(item => ({ ...item, id: this._decodeBase64Url(item.id) }));
        }
        return options;
    },

    _requestOptions(json) {
        const options = typeof json === "string" ? JSON.parse(json) : structuredClone(json);
        options.challenge = this._decodeBase64Url(options.challenge);
        if (Array.isArray(options.allowCredentials)) {
            options.allowCredentials = options.allowCredentials.map(item => ({ ...item, id: this._decodeBase64Url(item.id) }));
        }
        return options;
    },

    _serializeCredential(credential) {
        const response = credential.response;
        const payload = {
            id: credential.id,
            rawId: this._encodeBase64Url(credential.rawId),
            type: credential.type,
            response: { clientDataJSON: this._encodeBase64Url(response.clientDataJSON) },
            clientExtensionResults: credential.getClientExtensionResults()
        };

        if ("attestationObject" in response) {
            payload.response.attestationObject = this._encodeBase64Url(response.attestationObject);
            if (typeof response.getTransports === "function") payload.response.transports = response.getTransports();
        } else {
            payload.response.authenticatorData = this._encodeBase64Url(response.authenticatorData);
            payload.response.signature = this._encodeBase64Url(response.signature);
            payload.response.userHandle = response.userHandle ? this._encodeBase64Url(response.userHandle) : null;
        }
        return payload;
    },

    async enroll(_email, _token) {
        if (!(await this.isAvailable())) throw new Error("Biometric sign-in is not supported by this browser or device.");

        const started = await apiRequest("/webauthn/register/options", { method: "POST" });
        if (!started?.transactionId || !started?.publicKey) throw new Error("Could not start biometric setup. Please try again.");

        const credential = await navigator.credentials.create({ publicKey: this._creationOptions(started.publicKey) });
        if (!credential) throw new Error("Biometric setup was cancelled.");

        await apiRequest("/webauthn/register/finish", {
            method: "POST",
            body: JSON.stringify({ transactionId: started.transactionId, credential: this._serializeCredential(credential) })
        });
        localStorage.setItem("webauthn_bio_enabled", "true");
        return true;
    },

    async authenticate() {
        if (!(await this.isAvailable())) throw new Error("Biometric sign-in is not supported by this browser or device.");

        const started = await apiRequest("/webauthn/login/options", { method: "POST", cache: "no-store" });
        if (!started?.transactionId || !started?.publicKey) throw new Error("Could not start biometric sign-in. Please use your password instead.");

        const credential = await navigator.credentials.get({ publicKey: this._requestOptions(started.publicKey) });
        if (!credential) throw new Error("Biometric sign-in was cancelled.");

        const response = await apiRequest("/webauthn/login/finish", {
            method: "POST",
            body: JSON.stringify({ transactionId: started.transactionId, credential: this._serializeCredential(credential) })
        });
        if (!response?.token || !response?.userId) throw new Error("Biometric sign-in could not be verified. Please use your password instead.");
        localStorage.setItem("webauthn_bio_enabled", "true");
        return response;
    },

    async disable() {
        try {
            await apiRequest("/webauthn/credentials", { method: "DELETE" });
        } finally {
            localStorage.removeItem("webauthn_bio_enabled");
        }
    }
};

window.WebBiometrics = WebBiometrics;
