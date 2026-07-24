document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.passwordToggle);
        const isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";
        button.classList.toggle("is-visible", isHidden);
        button.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
        button.title = isHidden ? "Hide password" : "Show password";
    });
});
