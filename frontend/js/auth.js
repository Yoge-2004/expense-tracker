document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

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

    } catch (error) {
        showToast(error.message, "error");
    }
});

async function handleGoogleOAuth() {
    try {
        // Simulate/Integrate OAuth credential login flow
        const mockOAuthToken = "google_oauth_" + Date.now();
        const userEmail = prompt("Enter your Google Account email for Single Sign-On:", "google.user@example.com");
        if (!userEmail) return;

        const response = await apiRequest("/auth/oauth/google", {
            method: "POST",
            body: JSON.stringify({
                idToken: mockOAuthToken,
                email: userEmail,
                name: userEmail.split("@")[0]
            })
        });

        if (!response?.token || !response?.userId) {
            throw new Error("Google OAuth authentication failed.");
        }

        localStorage.setItem("token", response.token);
        localStorage.setItem("userId", response.userId);
        localStorage.setItem("userName", response.name || "Google User");
        showToast("Authenticated via Google OAuth!", "success");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 500);

    } catch (error) {
        showToast(error.message, "error");
    }
}
