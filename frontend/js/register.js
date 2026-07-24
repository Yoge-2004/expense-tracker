document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    // ✅ Capture Name
    const name = document.getElementById("reg-name").value;
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;

    try {
        await apiRequest("/auth/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password }) // ✅ Send Name
        });

        showToast("Registration successful! Please sign in.", "success");
        window.location.href = "index.html";

    } catch (error) {
        showToast(error.message, "error");
    }
});
