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

    /**
     * Parses notification timestamps safely into client-local Date objects.
     * If an ISO string without timezone or 'Z' is received, normalizes by appending 'Z'
     * so JavaScript parses as UTC and displays in the user's local timezone.
     */
    function parseNotificationDate(value) {
        if (!value) return new Date(NaN);
        if (value instanceof Date) return value;
        if (typeof value === "number") return new Date(value);
        const str = String(value).trim();
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str) && !/[Zz]|[+-]\d{2}(?::?\d{2})?$/.test(str)) {
            return new Date(str + "Z");
        }
        return new Date(str);
    }

    function formatNotificationTime(value) {
        const then = parseNotificationDate(value);
        if (Number.isNaN(then.getTime())) return "";
        const now = Date.now();
        const diffMs = now - then.getTime();
        const minutes = Math.round(diffMs / 60000);
        const timeStr = then.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        if (minutes < 1) return `just now · ${timeStr}`;
        if (minutes < 60) return `${minutes}m ago · ${timeStr}`;
        const hours = Math.round(minutes / 60);
        if (hours < 24) return `${hours}h ago · ${timeStr}`;
        const days = Math.round(hours / 24);
        if (days === 1) return `yesterday · ${timeStr}`;
        return `${then.toLocaleDateString(undefined, { day: "numeric", month: "short" })} · ${timeStr}`;
    }

    function formatNotificationTooltip(value) {
        const then = parseNotificationDate(value);
        if (Number.isNaN(then.getTime())) return "";
        return then.toLocaleString(undefined, {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
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

            // Background trough with clear actions underneath
            const swipeBg = el("div", "inbox-item-swipe-bg");
            const leftAction = el("div", "inbox-swipe-action inbox-swipe-action--left");
            leftAction.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg><span>Clear</span>';
            const rightAction = el("div", "inbox-swipe-action inbox-swipe-action--right");
            rightAction.innerHTML = '<span>Clear</span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
            swipeBg.append(leftAction, rightAction);
            row.append(swipeBg);

            // Sliding foreground container
            const foreground = el("div", "inbox-item-foreground");

            const timeSpan = el("span", "inbox-item-time", formatNotificationTime(item.createdAt));
            const tooltip = formatNotificationTooltip(item.createdAt);
            if (tooltip) {
                timeSpan.setAttribute("title", tooltip);
            }

            const button = el("button", "inbox-item-button");
            button.type = "button";
            button.append(
                el("span", "inbox-item-title", item.title),
                el("span", "inbox-item-body", item.body),
                timeSpan
            );
            button.addEventListener("click", () => openItem(item));
            foreground.append(button);

            // Desktop & non-touch delete button
            const deleteBtn = el("button", "inbox-item-delete");
            deleteBtn.type = "button";
            deleteBtn.setAttribute("aria-label", "Delete notification");
            deleteBtn.setAttribute("title", "Delete notification");
            deleteBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                e.preventDefault();
                dismissNotification(row, foreground, item, 60);
            });
            foreground.append(deleteBtn);
            row.append(foreground);

            function dismissNotification(rowEl, fgEl, notifItem, swipeDelta) {
                navigator.vibrate?.(15);
                const flyOutX = swipeDelta > 0 ? 360 : -360;
                fgEl.style.transition = "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease";
                fgEl.style.transform = `translateX(${flyOutX}px)`;
                fgEl.style.opacity = "0";

                setTimeout(() => {
                    rowEl.style.transition = "max-height 0.24s cubic-bezier(0.16, 1, 0.3, 1), margin 0.2s ease, padding 0.2s ease, opacity 0.2s ease";
                    rowEl.style.maxHeight = "0px";
                    rowEl.style.marginBottom = "0px";
                    rowEl.style.paddingTop = "0px";
                    rowEl.style.paddingBottom = "0px";
                    rowEl.style.opacity = "0";
                    rowEl.style.overflow = "hidden";

                    if (!notifItem.read) {
                        const curBadge = parseInt(badge.textContent, 10) || 1;
                        setBadge(Math.max(0, curBadge - 1));
                    }

                    setTimeout(async () => {
                        rowEl.remove();
                        if (list.querySelectorAll(".inbox-item").length === 0) {
                            list.replaceChildren(el("li", "inbox-empty", "You're all caught up."));
                        }
                        try {
                            await apiRequest(`${base}/${notifItem.id}`, { method: "DELETE" });
                        } catch (err) { console.warn("[Inbox] Failed to delete notification:", err.message); }
                    }, 240);
                }, 160);
            }

            // Touch gesture support: swipe left/right to clear notification
            let touchStartX = 0;
            let touchStartY = 0;
            let currentX = 0;
            let isSwiping = false;
            let hasVibrated = false;

            foreground.addEventListener("touchstart", (e) => {
                if (e.touches.length !== 1) return;
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                currentX = 0;
                isSwiping = false;
                hasVibrated = false;
                foreground.style.transition = "none";
            }, { passive: true });

            foreground.addEventListener("touchmove", (e) => {
                if (e.touches.length !== 1) return;
                const diffX = e.touches[0].clientX - touchStartX;
                const diffY = e.touches[0].clientY - touchStartY;
                if (!isSwiping) {
                    if (Math.abs(diffY) > 8 && Math.abs(diffY) >= Math.abs(diffX)) {
                        return; // User is scrolling vertically
                    }
                    if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY) * 1.25) {
                        isSwiping = true;
                    }
                }
                if (isSwiping) {
                    currentX = diffX;
                    const clampedX = Math.max(-140, Math.min(140, currentX));
                    foreground.style.transform = `translateX(${clampedX}px)`;

                    if (currentX > 0) {
                        const progress = Math.min(1, currentX / 65);
                        leftAction.style.opacity = String(0.4 + progress * 0.6);
                        leftAction.style.transform = `scale(${0.9 + progress * 0.2})`;
                        rightAction.style.opacity = "0.2";
                    } else {
                        const progress = Math.min(1, Math.abs(currentX) / 65);
                        rightAction.style.opacity = String(0.4 + progress * 0.6);
                        rightAction.style.transform = `scale(${0.9 + progress * 0.2})`;
                        leftAction.style.opacity = "0.2";
                    }

                    if (Math.abs(currentX) > 65 && !hasVibrated) {
                        navigator.vibrate?.(15);
                        hasVibrated = true;
                    } else if (Math.abs(currentX) <= 65) {
                        hasVibrated = false;
                    }
                }
            }, { passive: true });

            foreground.addEventListener("touchend", () => {
                if (!isSwiping) return;
                if (Math.abs(currentX) > 65) {
                    dismissNotification(row, foreground, item, currentX);
                } else {
                    foreground.style.transition = "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)";
                    foreground.style.transform = "translateX(0px)";
                    leftAction.style.opacity = "";
                    leftAction.style.transform = "";
                    rightAction.style.opacity = "";
                    rightAction.style.transform = "";
                }
            }, { passive: true });

            list.append(row);
        });
    }

    let prevUnreadCount = null;
    async function load() {
        try {
            const inbox = await apiRequest(`${base}?limit=30`);
            const currentUnread = inbox?.unreadCount || 0;
            if (prevUnreadCount !== null && currentUnread > prevUnreadCount) {
                window.DashboardNotifications?.playCustomNotificationSound?.();
            }
            prevUnreadCount = currentUnread;
            setBadge(currentUnread);
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

            // Client-side Custom Chime Sound toggle
            const soundLabel = el("label", "inbox-toggle");
            const soundInput = document.createElement("input");
            soundInput.type = "checkbox";
            soundInput.id = "inboxSoundToggle";
            const isSoundOn = window.DashboardNotifications?.isNotificationSoundEnabled
                ? window.DashboardNotifications.isNotificationSoundEnabled()
                : localStorage.getItem("expense_tracker_notification_sound_enabled") !== "false";
            soundInput.checked = isSoundOn;
            soundInput.addEventListener("change", () => {
                if (window.DashboardNotifications?.setNotificationSoundEnabled) {
                    window.DashboardNotifications.setNotificationSoundEnabled(soundInput.checked);
                } else {
                    localStorage.setItem("expense_tracker_notification_sound_enabled", soundInput.checked ? "true" : "false");
                }
                if (soundInput.checked) {
                    window.DashboardNotifications?.playCustomNotificationSound?.();
                }
            });
            const soundText = el("span", "inbox-toggle-text");
            soundText.append(
                el("span", "inbox-toggle-label", "Notification Sound"),
                el("span", "inbox-toggle-hint", "Play custom chime for notifications and alerts")
            );
            soundLabel.append(soundInput, soundText);
            prefsBox.append(soundLabel);
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
        const disabledTypes = [...prefsBox.querySelectorAll("input:not(:checked)")].map((input) => input.dataset.type).filter(Boolean);
        try {
            await apiRequest(`${base}/preferences`, { method: "PUT", body: JSON.stringify({ disabledTypes }) });
        } catch (error) {
            showToast(error.message || "Could not save notification settings.", "error");
            loadPreferences();
        }
    }

    function toggle(forceOpen) {
        const open = typeof forceOpen === "boolean" ? forceOpen : panel.hidden;
        if (open) {
            // Mutual exclusion: close profile menu if open
            if (typeof window.toggleProfileMenu === "function") {
                window.toggleProfileMenu(false);
            } else {
                const pm = document.getElementById("profileMenu");
                pm?.classList.remove("active");
                const pt = document.getElementById("profileTrigger");
                pt?.setAttribute("aria-expanded", "false");
                pt?.classList.remove("active");
                if (pt) pt.style.zIndex = "";
            }
        }
        panel.hidden = !open;
        bell.setAttribute("aria-expanded", String(open));
        bell.classList.toggle("inbox-bell--open", open);
        const inboxContainer = document.getElementById("inbox");
        if (inboxContainer) {
            inboxContainer.style.zIndex = open ? "1500" : "";
        }
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
    document.getElementById("closeInboxBtn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggle(false);
    });
    document.getElementById("inboxMarkAll")?.addEventListener("click", async () => {
        await markRead([]);
        load();
    });
    document.getElementById("inboxClearAll")?.addEventListener("click", async () => {
        try {
            await apiRequest(base, { method: "DELETE" });
            load();
        } catch (error) {
            showToast(error.message || "Could not clear notifications.", "error");
        }
    });
    document.getElementById("inboxTest")?.addEventListener("click", async () => {
        try {
            window.DashboardNotifications?.playCustomNotificationSound?.();
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

    window.DashboardInbox = {
        close: () => toggle(false),
        open: () => toggle(true),
        toggle,
        load,
        setBadge
    };

    load();
    setInterval(() => { if (document.visibilityState === "visible") load(); }, POLL_MS);
})();
