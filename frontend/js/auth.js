document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn?.disabled) return;

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
        localStorage.setItem("userEmail", email);
        showToast("Signed in successfully!", "success");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 500);
    } catch (error) {
        showToast(error.message, "error");
        const emailEl = document.getElementById("email");
        const passEl = document.getElementById("password");
        if (emailEl) emailEl.classList.add("is-invalid");
        if (passEl) passEl.classList.add("is-invalid");
        if (submitBtn) submitBtn.disabled = false;
    }
});

["email", "password"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", () => {
        document.getElementById(id)?.classList.remove("is-invalid");
    });
});

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
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84c1.81 3.59 5.52 6.06 9.82 6.06z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                <span>Continue with Google</span>
            `;
        }
    });
}

function isGoogleSignInConfigured() {
    return typeof GOOGLE_CLIENT_ID === "string" &&
        GOOGLE_CLIENT_ID.length > 0 &&
        !GOOGLE_CLIENT_ID.startsWith("YOUR_");
}

let isGoogleInitialized = false;

function initGoogleSignIn() {
    if (isGoogleInitialized || !isGoogleSignInConfigured() || !window.google?.accounts?.id) return;
    try {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
        });
        isGoogleInitialized = true;

        const realButtons = document.querySelectorAll("#googleRealButton, .google-real-btn");
        realButtons.forEach(btnContainer => {
            const parentWidth = btnContainer.parentElement?.getBoundingClientRect().width || 380;
            const width = Math.min(Math.max(Math.round(parentWidth) || 360, 280), 440);
            google.accounts.id.renderButton(btnContainer, {
                type: "standard",
                size: "large",
                width: width,
                height: 48
            });
        });
    } catch (e) {
        console.warn("Google Sign-In initialization:", e);
    }
}

async function handleGoogleCredentialResponse(credentialResponse) {
    setGoogleButtonLoading(true, "Verifying Google account...");
    try {
        const response = await apiRequest("/auth/oauth/google", {
            method: "POST",
            body: JSON.stringify({ idToken: credentialResponse.credential })
        });

        if (!response?.token || !response?.userId) throw new Error("Google sign-in failed.");

        localStorage.setItem("token", response.token);
        localStorage.setItem("userId", response.userId);
        localStorage.setItem("userName", response.name || "Google User");
        localStorage.setItem("userEmail", response.email || credentialResponse.email || "");
        showToast("Signed in with Google! Redirecting...", "success");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 500);
    } catch (error) {
        setGoogleButtonLoading(false);
        showToast(error.message || "Google sign-in failed.", "error");
    }
}

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

    if (!window.google?.accounts?.id) {
        setTimeout(() => {
            setGoogleButtonLoading(false);
            showToast("Google authentication service is still initializing — please try again in a moment.", "info");
        }, 1200);
        return;
    }

    try {
        if (!isGoogleInitialized) initGoogleSignIn();
        google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed()) {
                const reason = notification.getNotDisplayedReason?.() || "origin_or_cookies";
                setTimeout(() => {
                    setGoogleButtonLoading(false);
                    if (reason === "opt_out_or_no_session") {
                        showToast("Please select your Google Account or sign in with the Google button.", "info");
                    } else if (reason === "suppressed_by_user") {
                        showToast("Google prompt was dismissed recently. Please click the Google button to sign in.", "info");
                    } else {
                        showToast("Make sure this site's URL is added to Authorized JavaScript Origins in Google Cloud Console.", "info");
                    }
                }, 1000);
            } else if (notification.isSkippedMoment()) {
                setTimeout(() => { setGoogleButtonLoading(false); }, 1000);
            }
        });
    } catch (e) {
        setGoogleButtonLoading(false);
        showToast("Unable to open Google prompt: " + e.message, "error");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (window.google?.accounts?.id) {
        initGoogleSignIn();
    } else {
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if (window.google?.accounts?.id) {
                initGoogleSignIn();
                clearInterval(interval);
            } else if (attempts > 15) {
                clearInterval(interval);
            }
        }, 250);
    }
});

// WebAuthn login: the authenticator proves possession of the private key and
// the backend verifies the signed assertion before issuing a fresh JWT.
document.addEventListener("DOMContentLoaded", async () => {
    const bioBtn = document.getElementById("biometricLoginBtn");
    if (!bioBtn || !window.WebBiometrics) return;

    try {
        const available = await WebBiometrics.isAvailable();
        if (!available) return;

        bioBtn.style.display = "flex";
        bioBtn.addEventListener("click", async () => {
            bioBtn.disabled = true;
            try {
                const res = await WebBiometrics.authenticate();
                localStorage.setItem("token", res.token);
                localStorage.setItem("userId", res.userId);
                localStorage.setItem("userName", res.name || "User");
                localStorage.setItem("userEmail", res.email || "");
                showToast("Biometric sign-in verified. Welcome back!", "success");
                setTimeout(() => { window.location.href = "dashboard.html"; }, 400);
            } catch (err) {
                showToast(err.message || "Biometric authentication cancelled.", "error");
                bioBtn.disabled = false;
            }
        });
    } catch (e) {
        console.warn("Biometrics check failed:", e);
    }
});
