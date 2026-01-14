document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;

    try {
        await apiRequest("/auth/register", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });

        alert("Registration successful! Please login.");
        window.location.href = "index.html";

    } catch (error) {
        alert(error.message);
    }
});