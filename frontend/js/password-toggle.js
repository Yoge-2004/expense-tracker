document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.passwordToggle);
        if (!input) return; // guard against missing target referenced by data-password-toggle
        const isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";
        button.classList.toggle("is-visible", isHidden);
        button.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
        button.title = isHidden ? "Hide password" : "Show password";
    });
});
