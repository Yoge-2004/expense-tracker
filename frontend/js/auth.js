document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn?.disabled) return; // a submission is already in flight

    const email = document.getElementById("email").value;
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
