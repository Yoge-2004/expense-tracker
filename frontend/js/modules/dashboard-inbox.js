/*
 * Notification inbox: a bell in the top bar with an unread badge and a panel listing the newest
 * notifications, with "mark all read" and per-kind switches. Every piece of server text is inserted
 * with textContent, never as HTML.
 */
(function () {
    "use strict";

    const userId = localStorage.getItem("userId");
    const bell = document.getElementById("inboxBell");
    const panel = document.getElementById("inboxPanel");
    if (!userId || !bell || !panel) return;

    const badge = document.getElementById("inboxBadge");
    const list = document.getElementById("inboxList");
    const prefsBox = document.getElementById("inboxPrefs");
    const POLL_MS = 60000;
    /** Where tapping a notification scrolls to (anything not listed just gets marked read). */
    const SECTIONS = { budgets: "budgetList", goals: "savingsGoalsList" };
    const base = `/notifications/user/${encodeURIComponent(userId)}`;

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function timeAgo(value) {
        const then = new Date(value);
        if (Number.isNaN(then.getTime())) return "";
        const minutes = Math.round((Date.now() - then.getTime()) / 60000);
        if (minutes < 1) return "just now";
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.round(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.round(hours / 24);
        return days === 1 ? "yesterday" : then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    }

    function setBadge(count) {
        badge.hidden = !count;
        badge.textContent = count > 99 ? "99+" : String(count);
        bell.setAttribute("aria-label", count ? `Notifications, ${count} unread` : "Notifications");
    }

    function renderItems(items) {
        list.replaceChildren();
        if (!items.length) {
            list.append(el("li", "inbox-empty", "You're all caught up."));
            return;
        }
        items.forEach((item) => {
            const row = el("li", `inbox-item${item.read ? "" : " inbox-item--unread"}`);
            const button = el("button", "inbox-item-button");
            button.type = "button";
            button.append(el("span", "inbox-item-title", item.title), el("span", "inbox-item-body", item.body),
                el("span", "inbox-item-time", timeAgo(item.createdAt)));
            button.addEventListener("click", () => openItem(item));
            row.append(button);

            // Touch gesture support: swipe left/right to dismiss notification
            let touchStartX = 0;
            let touchStartY = 0;
            let currentX = 0;
            let isSwiping = false;

            row.addEventListener("touchstart", (e) => {
                if (e.touches.length !== 1) return;
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                currentX = 0;
                isSwiping = false;
                row.style.transition = "none";
            }, { passive: true });

            row.addEventListener("touchmove", (e) => {
                if (e.touches.length !== 1) return;
                const diffX = e.touches[0].clientX - touchStartX;
                const diffY = e.touches[0].clientY - touchStartY;
                if (!isSwiping && Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
                    isSwiping = true;
                }
                if (isSwiping) {
                    currentX = diffX;
                    row.style.transform = `translateX(${currentX}px)`;
                    row.style.opacity = String(Math.max(0.15, 1 - Math.abs(currentX) / 220));
                }
            }, { passive: true });

            row.addEventListener("touchend", () => {
                if (!isSwiping) return;
                row.style.transition = "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease, max-height 0.3s ease, margin 0.3s ease, padding 0.3s ease";
                if (Math.abs(currentX) > 75) {
                    navigator.vibrate?.(15);
                    const flyOutX = currentX > 0 ? 350 : -350;
                    row.style.transform = `translateX(${flyOutX}px)`;
                    row.style.opacity = "0";
                    setTimeout(async () => {
                        row.style.maxHeight = "0px";
                        row.style.marginBottom = "0px";
                        row.style.paddingTop = "0px";
                        row.style.paddingBottom = "0px";
                        row.style.overflow = "hidden";
                        try {
                            await apiRequest(`${base}/${item.id}`, { method: "DELETE" });
                        } catch (_) {}
                        setTimeout(() => row.remove(), 250);
                    }, 220);
                } else {
                    row.style.transform = "translateX(0px)";
                    row.style.opacity = "1";
                }
            });

            list.append(row);
        });
    }

    async function load() {
        try {
            const inbox = await apiRequest(`${base}?limit=30`);
            setBadge(inbox?.unreadCount || 0);
            renderItems(inbox?.items || []);
        } catch (_) { /* offline or signed out: keep what is shown */ }
    }

    async function markRead(ids) {
        try {
            await apiRequest(`${base}/read`, { method: "POST", body: JSON.stringify({ ids }) });
        } catch (_) { /* the next refresh shows the truth */ }
    }

    async function openItem(item) {
        if (!item.read) {
            await markRead([item.id]);
            load();
        }
        const target = SECTIONS[item.route] && document.getElementById(SECTIONS[item.route]);
        if (target) {
            toggle(false);
            target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }

    async function loadPreferences() {
        try {
            const prefs = await apiRequest(`${base}/preferences`);
            prefsBox.replaceChildren();
            (prefs || []).forEach((pref) => {
                const label = el("label", "inbox-toggle");
                const input = document.createElement("input");
                input.type = "checkbox";
                input.checked = pref.enabled;
                input.disabled = pref.locked;
                input.dataset.type = pref.type;
                const text = el("span", "inbox-toggle-text");
                text.append(el("span", "inbox-toggle-label", pref.label), el("span", "inbox-toggle-hint", pref.description));
                label.append(input, text);
                prefsBox.append(label);
            });
        } catch (_) { /* leave the section empty */ }
    }

    async function savePreferences() {
        const disabledTypes = [...prefsBox.querySelectorAll("input:not(:checked)")].map((input) => input.dataset.type);
        try {
            await apiRequest(`${base}/preferences`, { method: "PUT", body: JSON.stringify({ disabledTypes }) });
        } catch (error) {
            showToast(error.message || "Could not save notification settings.", "error");
            loadPreferences();
        }
    }

    function toggle(forceOpen) {
        const open = typeof forceOpen === "boolean" ? forceOpen : panel.hidden;
        panel.hidden = !open;
        bell.setAttribute("aria-expanded", String(open));
        if (open) {
            load();
            loadPreferences();
        }
    }

    // Swipe down on inbox panel to dismiss on touch devices
    let panelTouchStartY = 0;
    panel.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1 && panel.scrollTop === 0) {
            panelTouchStartY = e.touches[0].clientY;
        }
    }, { passive: true });

    panel.addEventListener("touchend", (e) => {
        if (panelTouchStartY > 0 && e.changedTouches.length === 1) {
            const diffY = e.changedTouches[0].clientY - panelTouchStartY;
            if (diffY > 80) {
                navigator.vibrate?.(10);
                toggle(false);
            }
        }
        panelTouchStartY = 0;
    });

    bell.addEventListener("click", () => toggle());
    document.getElementById("inboxMarkAll")?.addEventListener("click", async () => {
        await markRead([]);
        load();
    });
    document.getElementById("inboxTest")?.addEventListener("click", async () => {
        try {
            await apiRequest(`${base}/test`, { method: "POST" });
            showToast("Test notification sent.", "success");
            load();
        } catch (error) {
            showToast(error.message || "Could not send a test notification.", "error");
        }
    });
    prefsBox.addEventListener("change", savePreferences);
    document.addEventListener("click", (event) => {
        if (!panel.hidden && !panel.contains(event.target) && !bell.contains(event.target)) toggle(false);
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !panel.hidden) toggle(false);
    });

    load();
    setInterval(() => { if (document.visibilityState === "visible") load(); }, POLL_MS);
})();
