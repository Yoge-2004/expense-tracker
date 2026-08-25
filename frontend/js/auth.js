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
    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredentialResponse
    });

    // Render Google's real button, at full natural size, directly on top of
    // our custom-styled button (see the wrapper in index.html: both are
    // position:absolute within the same relative container, matching size).
    // Google's button is implemented via an internal iframe, so previously
    // trying to (a) render it into a 1x1px clipped box and (b) guess its
    // internal DOM structure to forward a synthetic .click() to it was
    // fragile on both counts — Google's SDK may not render/function
    // correctly with no real space, and the guessed selector may simply
    // never match, silently falling through to the unreliable prompt() API.
    // Stacking the real button on top means the user's actual click lands
    // on Google's genuine element directly; no guessing, no synthetic click.
    const realBtnContainer = document.getElementById("googleRealButton");
    if (realBtnContainer) {
        const width = Math.min(Math.round(realBtnContainer.getBoundingClientRect().width) || 300, 400);
        google.accounts.id.renderButton(realBtnContainer, { type: "standard", width, height: 44 });
    }
}

async function handleGoogleCredentialResponse(credentialResponse) {
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
        showToast("Signed in with Google!", "success");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 500);

    } catch (error) {
        showToast(error.message || "Google sign-in failed.", "error");
    }
}

function handleGoogleOAuth() {
    // Under normal circumstances this never actually runs — the real Google
    // button is stacked directly on top of this one and intercepts the
    // click first (see initGoogleSignIn). This only fires as a last-resort
    // fallback if that overlay somehow failed to render (e.g. Google's
    // script hasn't loaded yet, or the client ID isn't configured), so the
    // button still does *something* informative instead of nothing.
    if (!isGoogleSignInConfigured()) {
        showToast("Google Sign-In isn't set up yet — add a real Client ID in js/config.js.", "error");
        return;
    }
    if (!window.google?.accounts?.id) {
        showToast("Google Sign-In is still loading — please try again in a moment.", "error");
        return;
    }
    google.accounts.id.prompt();
}

document.addEventListener("DOMContentLoaded", initGoogleSignIn);
