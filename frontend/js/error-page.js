document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("retryPageBtn")?.addEventListener("click", () => location.reload());
    document.getElementById("themeToggle")?.addEventListener("click", function () {
        const current = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", current);
        try { localStorage.setItem("theme", current); } catch {}
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", current === "light" ? "#F8F9FA" : "#10120E");
    });
});
