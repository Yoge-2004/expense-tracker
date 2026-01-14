const API_BASE_URL = "http://localhost:8080/api";

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem("token");

    const headers = {
        "Content-Type": "application/json",
        ...(token && { "Authorization": `Bearer ${token}` })
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "index.html";
        return;
    }

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Something went wrong");
    }

    return response.json();
}
