/**
 * Server-verified WebAuthn/passkey authentication for Expense Tracker.
 * No JWT or password is stored as a biometric credential. The browser's
 * authenticator holds the private key and the server verifies every assertion.
 */

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
