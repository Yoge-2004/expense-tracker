document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn?.disabled) return; // a submission is already in flight

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (submitBtn) submitBtn.disabled = true;
    try {
        const response = await apiRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });

        if (!response?.token || !response?.userId) {
            throw new Error("The sign-in service returned an incomplete response. Please try again.");
        }

        localStorage.setItem("token", response.token);
        localStorage.setItem("userId", response.userId);
        localStorage.setItem("userName", response.name || "User");
        showToast("Signed in successfully!", "success");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 500);
        // Intentionally leave the button disabled here — we're navigating away.

    } catch (error) {
        showToast(error.message, "error");
        if (submitBtn) submitBtn.disabled = false;
    }
});

// Visual Feedback for Google Sign-In button
function setGoogleButtonLoading(loading, message = "Connecting to Google...") {
    const btns = document.querySelectorAll(".btn-oauth, #googleOAuthBtn");
    btns.forEach(btn => {
        if (loading) {
            btn.classList.add("is-loading");
            btn.innerHTML = `
                <div class="spinner-sm" style="display:inline-block; vertical-align:middle; margin-right:8px;"></div>
                <span>${message}</span>
            `;
        } else {
            btn.classList.remove("is-loading");
            btn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                <span>Continue with Google</span>
            `;
        }
    });
}

// Real Google Sign-In (Google Identity Services). The server never sees a
// plain email typed by the user — only a Google-signed ID token, which it
// independently verifies. See GoogleIdTokenVerifier.java on the backend.
function isGoogleSignInConfigured() {
    return typeof GOOGLE_CLIENT_ID === "string" &&
        GOOGLE_CLIENT_ID.length > 0 &&
        !GOOGLE_CLIENT_ID.startsWith("YOUR_");
}

function initGoogleSignIn() {
    if (!isGoogleSignInConfigured() || !window.google?.accounts?.id) return;
    try {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
        });
    } catch (e) {
        // Silently continue if initial load fails
    }
}

async function handleGoogleCredentialResponse(credentialResponse) {
    setGoogleButtonLoading(true, "Verifying Google account...");
    try {
        const response = await apiRequest("/auth/oauth/google", {
            method: "POST",
            body: JSON.stringify({ idToken: credentialResponse.credential })
        });

        if (!response?.token || !response?.userId) {
            throw new Error("Google sign-in failed.");
        }

        localStorage.setItem("token", response.token);
        localStorage.setItem("userId", response.userId);
        localStorage.setItem("userName", response.name || "Google User");
        showToast("Signed in with Google! Redirecting...", "success");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 500);

    } catch (error) {
        setGoogleButtonLoading(false);
        showToast(error.message || "Google sign-in failed.", "error");
    }
}

function openGoogleOAuthPopup() {
    const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const redirectUri = window.location.origin + window.location.pathname;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=id_token&scope=openid%20email%20profile&nonce=${nonce}&prompt=select_account`;

    const width = 500;
    const height = 620;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);

    const popup = window.open(authUrl, "google_oauth_popup", `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no,location=no`);

    if (!popup || popup.closed || typeof popup.closed === "undefined") {
        setGoogleButtonLoading(false);
        showToast("Popup was blocked by your browser. Please allow popups for this site.", "error");
        return;
    }

    // Keep the spinner visible while the popup is open
    const popupTimer = setInterval(() => {
        try {
            if (popup.closed) {
                clearInterval(popupTimer);
                setTimeout(() => {
                    if (!localStorage.getItem("token")) {
                        setGoogleButtonLoading(false);
                    }
                }, 800);
            }
        } catch (e) {
            // Cross-origin access error while on google.com is expected
        }
    }, 500);
}

function checkUrlForGoogleIdToken() {
    const hash = window.location.hash;
    if (hash && hash.includes("id_token=")) {
        const params = new URLSearchParams(hash.substring(1));
        const idToken = params.get("id_token");
        if (idToken) {
            if (window.opener && !window.opener.closed) {
                window.opener.postMessage({ type: "GOOGLE_ID_TOKEN", idToken }, window.location.origin);
                window.close();
            } else {
                window.history.replaceState(null, "", window.location.pathname + window.location.search);
                handleGoogleCredentialResponse({ credential: idToken });
            }
        }
    }
}

window.addEventListener("message", (event) => {
    if (event.origin === window.location.origin && event.data?.type === "GOOGLE_ID_TOKEN") {
        handleGoogleCredentialResponse({ credential: event.data.idToken });
    }
});

function handleGoogleOAuth() {
    setGoogleButtonLoading(true, "Connecting to Google...");
    showToast("Connecting to Google...", "info");

    if (!isGoogleSignInConfigured()) {
        setTimeout(() => {
            setGoogleButtonLoading(false);
            showToast("Google Sign-In isn't configured with a live Client ID in js/config.js. Please sign in with username/email.", "info");
        }, 1200);
        return;
    }

    // Try Google GIS One-Tap first; if not displayed, open Google OAuth account popup
    if (window.google?.accounts?.id) {
        try {
            initGoogleSignIn();
            google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    // Fall back to standard Google OAuth popup
                    openGoogleOAuthPopup();
                }
            });
        } catch (e) {
            openGoogleOAuthPopup();
        }
    } else {
        openGoogleOAuthPopup();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    checkUrlForGoogleIdToken();
    initGoogleSignIn();
});

