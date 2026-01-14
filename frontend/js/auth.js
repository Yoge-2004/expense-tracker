document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const response = await apiRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });

        localStorage.setItem("token", response.token);
        localStorage.setItem("userId", response.userId); // Stores User ID for Dashboard
        window.location.href = "dashboard.html";

    } catch (error) {
        alert(error.message);
    }
});