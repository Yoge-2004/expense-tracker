/**
 * Server-verified WebAuthn/passkey authentication for Expense Tracker.
 * The browser/device authenticator owns the private key; the backend verifies
 * every registration and assertion before issuing or accepting credentials.
 */

// Remove tokens created by the old browser-only biometric implementation.
localStorage.removeItem("webauthn_bio_token");
localStorage.removeItem("webauthn_bio_email");
localStorage.removeItem("webauthn_bio_cred_id");

const WebBiometrics = (() => {
    const base64UrlToBytes = (value) => {
        const raw = String(value || "");
        const normalized = raw.replace(/-/g, "+").replace(/_/g, "/")
            .padEnd(Math.ceil(raw.length / 4) * 4, "=");
        const binary = atob(normalized);
        return Uint8Array.from(binary, ch => ch.charCodeAt(0));
    };

    const bytesToBase64Url = (bytes) => {
        const binary = String.fromCharCode(...new Uint8Array(bytes));
        return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    };

    const serializeCredential = (credential) => {
        if (typeof credential?.toJSON === "function") return credential.toJSON();
        const response = credential.response;
        const result = {
            id: credential.id,
            rawId: bytesToBase64Url(credential.rawId),
            type: credential.type,
            response: {}
        };
        if (response instanceof AuthenticatorAttestationResponse) {
            result.response.clientDataJSON = bytesToBase64Url(response.clientDataJSON);
            result.response.attestationObject = bytesToBase64Url(response.attestationObject);
        } else {
            result.response.clientDataJSON = bytesToBase64Url(response.clientDataJSON);
            result.response.authenticatorData = bytesToBase64Url(response.authenticatorData);
            result.response.signature = bytesToBase64Url(response.signature);
            if (response.userHandle) result.response.userHandle = bytesToBase64Url(response.userHandle);
        }
        return result;
    };

    const prepareCreationOptions = (publicKey) => {
        const options = typeof publicKey === "string" ? JSON.parse(publicKey) : publicKey;
        options.challenge = base64UrlToBytes(options.challenge);
        if (options.user?.id) options.user.id = base64UrlToBytes(options.user.id);
        if (Array.isArray(options.excludeCredentials)) {
            options.excludeCredentials = options.excludeCredentials.map(item => ({
                ...item,
                id: base64UrlToBytes(item.id)
            }));
        }
        return options;
    };

    const prepareRequestOptions = (publicKey) => {
        const options = typeof publicKey === "string" ? JSON.parse(publicKey) : publicKey;
        options.challenge = base64UrlToBytes(options.challenge);
        if (Array.isArray(options.allowCredentials)) {
            options.allowCredentials = options.allowCredentials.map(item => ({
                ...item,
                id: base64UrlToBytes(item.id)
            }));
        }
        return options;
    };

    const getDiagnostics = async () => {
        const secureContext = Boolean(window.isSecureContext);
        const webAuthnApi = Boolean(
            window.PublicKeyCredential &&
            navigator.credentials?.create &&
            navigator.credentials?.get
        );

        let platformAuthenticator = null;
        if (window.PublicKeyCredential && typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
            try {
                platformAuthenticator = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            } catch (_) {
                platformAuthenticator = false;
            }
        }

        let reason = "ok";
        if (!secureContext) reason = "secure-context-required";
        else if (!webAuthnApi) reason = "webauthn-api-unavailable";
        else if (platformAuthenticator === false) reason = "platform-authenticator-unavailable";

        return {
            available: secureContext && webAuthnApi && platformAuthenticator !== false,
            secureContext,
            webAuthnApi,
            platformAuthenticator,
            origin: window.location.origin,
            hostname: window.location.hostname,
            reason
        };
    };

    const isAvailable = async () => (await getDiagnostics()).available;

    const enroll = async (_userEmail, _token) => {
        const diagnostics = await getDiagnostics();
        if (!diagnostics.available) {
            if (diagnostics.reason === "secure-context-required") {
                throw new Error("Biometrics require HTTPS or a browser-trusted localhost origin.");
            }
            if (diagnostics.reason === "platform-authenticator-unavailable") {
                throw new Error("No platform biometric authenticator is available on this device.");
            }
            throw new Error("WebAuthn is not available in this browser.");
        }

        const start = await apiRequest("/webauthn/register/options", { method: "POST" });
        if (!start?.transactionId || !start?.publicKey) {
            throw new Error("Unable to start biometric registration. Please try again.");
        }

        let credential;
        try {
            credential = await navigator.credentials.create({
                publicKey: prepareCreationOptions(start.publicKey)
            });
        } catch (error) {
            if (error?.name === "NotAllowedError") throw new Error("Biometric registration was cancelled or timed out.");
            if (error?.name === "InvalidStateError") throw new Error("A biometric credential is already registered on this device.");
            if (error?.name === "SecurityError") throw new Error("This site's origin is not permitted for biometric authentication.");
            throw new Error(error?.message || "The device could not create a biometric credential.");
        }
        if (!credential) throw new Error("The device did not return a biometric credential.");

        return await apiRequest("/webauthn/register/finish", {
            method: "POST",
            body: JSON.stringify({
                transactionId: start.transactionId,
                credential: JSON.stringify(serializeCredential(credential))
            })
        });
    };

    const authenticate = async () => {
        const diagnostics = await getDiagnostics();
        if (!diagnostics.available) {
            if (diagnostics.reason === "secure-context-required") {
                throw new Error("Biometrics require HTTPS or a browser-trusted localhost origin.");
            }
            if (diagnostics.reason === "platform-authenticator-unavailable") {
                throw new Error("No platform biometric authenticator is available on this device.");
            }
            throw new Error("WebAuthn is not available in this browser.");
        }

        const start = await apiRequest("/webauthn/login/options", {
            method: "POST",
            skipAuthRedirect: true
        });
        if (!start?.transactionId || !start?.publicKey) {
            throw new Error("Unable to start biometric sign-in. Please try again.");
        }

        let credential;
        try {
            credential = await navigator.credentials.get({
                publicKey: prepareRequestOptions(start.publicKey)
            });
        } catch (error) {
            if (error?.name === "NotAllowedError") throw new Error("Biometric sign-in was cancelled or timed out.");
            if (error?.name === "SecurityError") throw new Error("This site's origin is not permitted for biometric authentication.");
            throw new Error(error?.message || "The device could not verify your biometric credential.");
        }
        if (!credential) throw new Error("The device did not return a biometric assertion.");

        const finish = await apiRequest("/webauthn/login/finish", {
            method: "POST",
            skipAuthRedirect: true,
            body: JSON.stringify({
                transactionId: start.transactionId,
                credential: JSON.stringify(serializeCredential(credential))
            })
        });
        if (!finish?.token || !finish?.userId) throw new Error("Biometric sign-in returned an incomplete session.");
        return finish;
    };

    return Object.freeze({ getDiagnostics, isAvailable, enroll, authenticate });
})();

window.WebBiometrics = WebBiometrics;

// Keep logout focused on authentication state. Preferences and dashboard
// caches should survive sign-out.
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        ["token", "userId", "userName", "userEmail"].forEach((key) => localStorage.removeItem(key));
        window.location.href = "index.html";
    }, true);
}
