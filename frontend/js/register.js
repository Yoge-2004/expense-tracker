document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("reg-name").value.trim();
    const username = document.getElementById("reg-username")?.value.trim() || "";
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;

    if (!name || name.length < 2) {
        showToast("Please enter a valid full name (min 2 characters).", "error");
        document.getElementById("reg-name").classList.add("is-invalid");
        return;
    }

    if (username && (username.length < 3 || !/^[a-zA-Z0-9_.-]+$/.test(username))) {
        showToast("Please enter a valid username (min 3 chars, letters/numbers/_.-).", "error");
        document.getElementById("reg-username").classList.add("is-invalid");
        return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast("Please enter a valid email address.", "error");
        document.getElementById("reg-email").classList.add("is-invalid");
        return;
    }

    if (!password || password.length < 8) {
        showToast("Password must be at least 8 characters long.", "error");
        document.getElementById("reg-password").classList.add("is-invalid");
        return;
    }

    const currency = document.getElementById("reg-currency")?.value || "USD";

    try {
        await apiRequest("/auth/register", {
            method: "POST",
            body: JSON.stringify({ name: name || username, email, password })
        });

        localStorage.setItem("userCurrency", currency);
        showToast("Registration successful! Redirecting to sign in...", "success");
        setTimeout(() => {
            window.location.href = "index.html";
        }, 800);

    } catch (error) {
        showToast(error.message, "error");
        if (error.message.toLowerCase().includes("email") || error.message.toLowerCase().includes("user") || error.message.toLowerCase().includes("taken") || error.message.toLowerCase().includes("exist")) {
            if (typeof generateUsernameSuggestions === "function") {
                generateUsernameSuggestions();
            }
        }
    }
});
