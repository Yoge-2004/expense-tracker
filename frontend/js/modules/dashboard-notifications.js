/* ==========================================================================
   DASHBOARD NOTIFICATIONS & REAL-TIME DEBIT NOTIFIER MODULE
   ==========================================================================
   Manages browser Push notifications, parses financial SMS / debit messages,
   and instantly triggers desktop/mobile web notifications then-and-there
   when debit transactions are detected.
   ========================================================================== */

(function () {
    "use strict";

    // 0. ABSOLUTE URL RESOLVER FOR ASSETS ACROSS ALL DOMAINS / DEVICES
    function toAbsoluteUrl(path) {
        try {
            if (!path) return "";
            if (path.startsWith("http://") || path.startsWith("https://")) return path;
            const clean = path.startsWith("/") ? path : `/${path}`;
            return new URL(clean, window.location.origin).href;
        } catch (_) {
            return path;
        }
    }

    const NOTIF_ICON_URL = toAbsoluteUrl("/assets/icon-192.png");
    const NOTIF_BADGE_URL = toAbsoluteUrl("/assets/badge-72.png");

    // 1. DEBIT MESSAGE PARSER (Client-side mirror of financial extractor)
    const DEBIT_REGEX = /\b(debited|spent|paid|withdrawn|charged|purchase|txn of|sent|deducted|dr)\b/i;
    const CREDIT_REGEX = /\b(credited|received|refunded|deposited|reversal|cashback|cr)\b/i;
    const AMOUNT_REGEX = /(?:(?:Rs\.?|INR|₹|\$|EUR|€|GBP|£)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:Rs\.?|INR|₹|\$|EUR|€|GBP|£))/i;
    const FALLBACK_AMOUNT_REGEX = /\b(?:amount|amt|for|of)\s*(?:is|:)?\s*(?:Rs\.?|INR|₹|\$)?\s*([\d,]+(?:\.\d{1,2})?)\b/i;
    const MERCHANT_PATTERNS = [
        /(?:at|to|vpa|towards|for)\s+([A-Za-z0-9\s&\'.-]{2,30}?)(?:\s+(?:on|using|via|ref|bal|avbl|avl|dated|through|card|ac|ending|\.|\,)|$)/i,
        /(?:paid to|transferred to)\s+([A-Za-z0-9\s&\'.-]{2,30}?)(?:\s+(?:on|via|ref|bal|\.|\,)|$)/i,
        /(?:vpa\s+)([a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+)/i
    ];
    const ACCOUNT_PATTERNS = [
        /(?:ending(?:\s+with|\s+in)?|ending)\s*(?:xx*|[*]+)?([0-9]{3,4})\b/i,
        /(?:a\/c|acct|account|card|no\.)\s*(?:xx*|[*]+|ending(?:\s+with|\s+in)?\s*)?([0-9]{3,4})\b/i,
        /\b(?:xx*|[*]+)([0-9]{3,4})\b/i
    ];
    const REF_REGEX = /(?:ref|utr|rrn|txn|id|reference)\s*(?:no\.?|id|:)?\s*([A-Za-z0-9]{6,22})/i;

    function parseFinancialDebitText(text) {
        if (!text || typeof text !== "string") return null;
        const clean = text.trim();

        const isDebit = DEBIT_REGEX.test(clean);
        const isCredit = CREDIT_REGEX.test(clean);
        let direction = "UNKNOWN";

        if (isDebit && !isCredit) direction = "DEBIT";
        else if (isCredit && !isDebit) direction = "CREDIT";
        else if (isDebit && isCredit) {
            direction = clean.search(DEBIT_REGEX) < clean.search(CREDIT_REGEX) ? "DEBIT" : "CREDIT";
        }

        let amount = null;
        const amtMatch = clean.match(AMOUNT_REGEX);
        if (amtMatch) {
            const raw = amtMatch[1] || amtMatch[2];
            if (raw) amount = parseFloat(raw.replace(/,/g, ""));
        } else {
            const fbMatch = clean.match(FALLBACK_AMOUNT_REGEX);
            if (fbMatch && fbMatch[1]) amount = parseFloat(fbMatch[1].replace(/,/g, ""));
        }

        if (!amount || isNaN(amount) || amount <= 0) return null;

        let currency = "INR";
        if (/(\$|USD)/i.test(clean)) currency = "USD";
        else if (/(€|EUR)/i.test(clean)) currency = "EUR";
        else if (/(£|GBP)/i.test(clean)) currency = "GBP";

        let merchant = null;
        for (const pattern of MERCHANT_PATTERNS) {
            const m = clean.match(pattern);
            if (m && m[1]) {
                let candidate = m[1].trim().replace(/^(the|a|an)\s+/i, "");
                if (candidate.length > 1 && !/^(your|my|account|bank|branch)$/i.test(candidate)) {
                    merchant = candidate;
                    break;
                }
            }
        }

        let accountTail = null;
        for (const p of ACCOUNT_PATTERNS) {
            const accMatch = clean.match(p);
            if (accMatch && accMatch[1]) {
                accountTail = accMatch[1];
                break;
            }
        }

        let refNum = null;
        const rMatch = clean.match(REF_REGEX);
        if (rMatch && rMatch[1]) refNum = rMatch[1];

        return {
            rawText: clean,
            direction,
            amount,
            currency,
            merchant,
            accountTail,
            referenceNumber: refNum,
            timestamp: Date.now()
        };
    }

    // 1b. CUSTOM NOTIFICATION CHIME AUDIO SYSTEM
    const NOTIF_SOUND_STORAGE_KEY = "expense_tracker_notification_sound_enabled";

    function isNotificationSoundEnabled() {
        return localStorage.getItem(NOTIF_SOUND_STORAGE_KEY) !== "false";
    }

    function setNotificationSoundEnabled(enabled) {
        localStorage.setItem(NOTIF_SOUND_STORAGE_KEY, enabled ? "true" : "false");
    }

    let audioContext = null;
    function playSynthesizedChime() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (!audioContext) audioContext = new AudioCtx();
            if (audioContext.state === "suspended") {
                audioContext.resume();
            }
            const now = audioContext.currentTime;
            // 3-note ascending crystal chime: D5 (587.33), A5 (880), D6 (1174.66)
            const chords = [587.33, 880.00, 1174.66];
            chords.forEach((freq, idx) => {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, now + idx * 0.08);
                gain.gain.setValueAtTime(0.001, now + idx * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.08 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.55);
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.start(now + idx * 0.08);
                osc.stop(now + idx * 0.08 + 0.6);
            });
        } catch (err) { console.debug("[AudioSynth] WebAudio fallback:", err.message); }
    }

    function playCustomNotificationSound() {
        if (!isNotificationSoundEnabled()) return;
        try {
            const candidatePaths = [
                toAbsoluteUrl("/assets/custom_chime.wav"),
                "assets/custom_chime.wav",
                "/assets/custom_chime.wav"
            ];
            const audio = new Audio();
            let played = false;
            const tryPlay = (idx) => {
                if (idx >= candidatePaths.length) {
                    playSynthesizedChime();
                    return;
                }
                audio.src = candidatePaths[idx];
                audio.volume = 0.65;
                const p = audio.play();
                if (p && typeof p.then === "function") {
                    p.then(() => {
                        played = true;
                    }).catch(() => {
                        if (!played) tryPlay(idx + 1);
                    });
                }
            };
            tryPlay(0);
        } catch (_) {
            playSynthesizedChime();
        }
    }

    // 2. SERVICE WORKER & WEB NOTIFICATION PERMISSION
    let swRegistration = null;

    async function registerServiceWorker() {
        if (!("serviceWorker" in navigator)) return null;
        if (window.location.protocol === "file:") return null;
        if (swRegistration) return swRegistration;

        // Try existing registration first
        try {
            const existing = await navigator.serviceWorker.getRegistration();
            if (existing && existing.active) {
                swRegistration = existing;
                return existing;
            }
        } catch (err) { console.debug("[AudioCache] Candidate audio fallback:", err.message); }

        // Resolve candidates based on whether we are loaded in a /frontend/ subpath or at root
        const isFrontendSubdir = window.location.pathname.includes("/frontend/");
        const candidatePaths = isFrontendSubdir
            ? ["sw.js", "/frontend/sw.js", "/sw.js"]
            : ["/sw.js", "sw.js"];

        for (const candidate of candidatePaths) {
            try {
                const headCheck = await fetch(candidate, { method: "HEAD", cache: "no-store" }).catch(() => null);
                if (headCheck && headCheck.status === 404) {
                    continue;
                }

                const reg = await navigator.serviceWorker.register(candidate);
                swRegistration = reg;
                navigator.serviceWorker.addEventListener("message", (event) => {
                    if (event.data && event.data.type === "DEBIT_NOTIFICATION_CLICKED") {
                        handleNotificationAction(event.data.data);
                    }
                });
                return reg;
            } catch (e) {
                // Proceed to next candidate path
            }
        }
        return null;
    }

    async function requestNotificationPermission() {
        if (!("Notification" in window)) {
            console.warn("[DashboardNotifications] Notifications not supported in this browser.");
            return false;
        }
        if (Notification.permission === "granted") return true;
        if (Notification.permission !== "denied") {
            const status = await Notification.requestPermission();
            return status === "granted";
        }
        return false;
    }

    // 3. INSTANT DEBIT NOTIFICATION DISPATCHER
    async function notifyInstantDebit(parsed) {
        if (!parsed || parsed.direction !== "DEBIT") return false;
        playCustomNotificationSound();

        const formattedAmt = formatNotificationCurrency(parsed.amount, parsed.currency);
        const title = `Instant Debit Alert: ${formattedAmt}`;
        const merchantPart = parsed.merchant ? ` at ${parsed.merchant}` : "";
        const accPart = parsed.accountTail ? ` (Card/A/c xx${parsed.accountTail})` : "";
        const body = `Spent ${formattedAmt}${merchantPart}${accPart}. Tap to record or categorize now.`;

        if ("Notification" in window && Notification.permission === "granted") {
            try {
                if (swRegistration && "showNotification" in swRegistration) {
                    await swRegistration.showNotification(title, {
                        body,
                        icon: NOTIF_ICON_URL,
                        badge: NOTIF_BADGE_URL,
                        vibrate: [150, 50, 150],
                        data: {
                            url: "/dashboard.html",
                            amount: parsed.amount,
                            merchant: parsed.merchant,
                            currency: parsed.currency
                        }
                    });
                    return true;
                } else {
                    const notif = new Notification(title, {
                        body,
                        icon: NOTIF_ICON_URL,
                        badge: NOTIF_BADGE_URL
                    });
                    notif.onclick = () => {
                        window.focus();
                        handleNotificationAction(parsed);
                        notif.close();
                    };
                    return true;
                }
            } catch (err) {
                console.warn("[DashboardNotifications] Notification trigger error:", err);
            }
        }

        // Fallback: in-app toast notification if desktop/mobile notifications not granted
        if (typeof window.showToast === "function") {
            window.showToast(body, "info");
        }
        return false;
    }

    // 4. ACTION HANDLER WHEN NOTIFICATION IS CLICKED
    function handleNotificationAction(data) {
        if (!data) return;
        const addBtn = document.getElementById("openModalBtn") || document.getElementById("openAddExpenseModalBtn");
        if (addBtn) {
            addBtn.click();
            setTimeout(() => {
                const amountInput = document.getElementById("amount");
                const descInput = document.getElementById("desc") || document.getElementById("description");
                if (amountInput && data.amount) {
                    amountInput.value = data.amount;
                    amountInput.dispatchEvent(new Event("input", { bubbles: true }));
                }
                if (descInput && (data.merchant || data.description)) {
                    descInput.value = data.merchant || data.description;
                    descInput.dispatchEvent(new Event("input", { bubbles: true }));
                }
            }, 300);
        }
    }

    // 5. INCOMING MESSAGE INGESTION API
    async function ingestFinancialMessage(text) {
        const parsed = parseFinancialDebitText(text);
        if (parsed && parsed.direction === "DEBIT") {
            await notifyInstantDebit(parsed);
            return parsed;
        }
        return null;
    }

    // 5b. INTERACTIVE BANK SMS PASTE HELPER FOR WEBSITE
    async function promptPasteBankSMS() {
        let pastedText = "";
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                pastedText = await navigator.clipboard.readText();
            }
        } catch (err) { console.debug("[Clipboard] ReadText fallback:", err.message); }

        let parsed = pastedText ? parseFinancialDebitText(pastedText) : null;

        if (!parsed || !parsed.amount) {
            const userInput = window.prompt("Paste your bank SMS alert or debit message text here:");
            if (!userInput) return;
            parsed = parseFinancialDebitText(userInput);
        }

        if (parsed && parsed.amount) {
            handleNotificationAction(parsed);
            if (typeof window.showToast === "function") {
                window.showToast(`Parsed ${formatNotificationCurrency(parsed.amount, parsed.currency)} from SMS!`, "success");
            }
        } else {
            if (typeof window.showToast === "function") {
                window.showToast("Could not detect a financial amount in the provided text.", "warning");
            }
        }
    }

    // 6. PROACTIVE NOTIFICATION PERMISSION BANNER FOR ALL DEVICES
    const NOTIF_BANNER_SNOOZE_KEY = "expense_notif_banner_snoozed_until";

    function setupNotificationBanner() {
        const banner = document.getElementById("notificationPermissionBanner");
        if (!banner) return;

        // If Notification API is not supported in this browser
        if (!("Notification" in window)) {
            banner.setAttribute("hidden", "true");
            banner.style.display = "none";
            return;
        }

        // If user already granted or denied permission, do not display banner
        if (Notification.permission !== "default") {
            banner.setAttribute("hidden", "true");
            banner.style.display = "none";
            return;
        }

        // Check if snoozed
        try {
            const snoozedUntil = parseInt(localStorage.getItem(NOTIF_BANNER_SNOOZE_KEY) || "0", 10);
            if (Date.now() < snoozedUntil) {
                banner.setAttribute("hidden", "true");
                banner.style.display = "none";
                return;
            }
        } catch (err) { console.debug("[Notifications] Fallback:", err.message); }

        banner.removeAttribute("hidden");
        banner.style.display = "flex";

        const allowBtn = document.getElementById("notifBannerAllowBtn");
        const dismissBtn = document.getElementById("notifBannerDismissBtn");

        if (allowBtn) {
            allowBtn.onclick = async () => {
                const granted = await requestNotificationPermission();
                banner.setAttribute("hidden", "true");
                banner.style.display = "none";
                if (granted) {
                    playCustomNotificationSound();
                    if (typeof window.showToast === "function") {
                        window.showToast("Notifications enabled! You'll receive real-time debit and balance alerts.", "success");
                    }
                } else {
                    if (typeof window.showToast === "function") {
                        window.showToast("Notification permission was not granted.", "warning");
                    }
                }
            };
        }

        if (dismissBtn) {
            dismissBtn.onclick = () => {
                banner.setAttribute("hidden", "true");
                banner.style.display = "none";
                try {
                    // Snooze for 7 days
                    localStorage.setItem(NOTIF_BANNER_SNOOZE_KEY, String(Date.now() + 7 * 86400000));
                } catch (err) { console.debug("[Banner] Snooze storage fallback:", err.message); }
            };
        }
    }

    // 7. UI TOGGLE IN PROFILE / MODAL SETTINGS
    function setupNotificationToggle() {
        const toggleBtn = document.getElementById("enableInstantDebitAlertsBtn");
        if (toggleBtn) {
            toggleBtn.addEventListener("click", async () => {
                const granted = await requestNotificationPermission();
                if (granted) {
                    if (typeof window.showToast === "function") {
                        window.showToast("Instant debit notifications enabled!", "success");
                    }
                } else {
                    if (typeof window.showToast === "function") {
                        window.showToast("Notification permissions were not granted.", "warning");
                    }
                }
            });
        }
    }

    // 8. INITIALIZE
    function init() {
        registerServiceWorker();
        setupNotificationBanner();
        setupNotificationToggle();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    function formatNotificationCurrency(amount, cur) {
        if (window.DashboardUtils && typeof window.DashboardUtils.formatCurrency === "function") {
            return window.DashboardUtils.formatCurrency(Number(amount));
        }
        const sym = cur || (typeof getCurrencySymbol === "function" ? getCurrencySymbol() : "₹");
        const isAlpha = /^[A-Z]{3}$/.test(sym);
        const formatted = Number(amount || 0).toLocaleString();
        return isAlpha ? `${sym} ${formatted}` : `${sym}${formatted}`;
    }

    async function notifySalaryCredit(amount, currency = '₹', source = 'Salary') {
        playCustomNotificationSound();
        const formattedAmt = formatNotificationCurrency(amount, currency);
        const title = `${source} Credited: ${formattedAmt}`;
        const body = 'Your earnings have landed. Allocate to savings goals, SIPs, and fixed commitments before spending begins!';
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                if (swRegistration && 'showNotification' in swRegistration) {
                    await swRegistration.showNotification(title, {
                        body,
                        icon: NOTIF_ICON_URL,
                        badge: NOTIF_BADGE_URL,
                        tag: 'salary-inflow'
                    });
                } else {
                    new Notification(title, { body, icon: NOTIF_ICON_URL, badge: NOTIF_BADGE_URL });
                }
            } catch (e) {
                console.warn('[DashboardNotifications] Error:', e);
            }
        }
    }

    /**
     * Confirms a debit (expense) or credit (income) the user has just recorded, with its amount.
     * Only shown when notification permission is already granted (it never prompts) and only for
     * new entries; the caller does not use it for edits.
     */
    async function notifyTransactionRecorded({ kind, amount, label, detail }) {
        playCustomNotificationSound();
        if (!("Notification" in window) || Notification.permission !== "granted") return;
        const isDebit = kind === "DEBIT";
        const formatted = window.DashboardUtils && typeof window.DashboardUtils.formatCurrency === "function"
            ? window.DashboardUtils.formatCurrency(Number(amount))
            : formatNotificationCurrency(amount);
        const title = `${isDebit ? "Debit" : "Credit"} recorded: ${formatted}`;
        const body = [label, detail].filter((part) => part && String(part).trim()).join(" · ")
            || (isDebit ? "Expense saved." : "Income saved.");
        const tag = `transaction-${Date.now()}`;
        try {
            if (swRegistration && "showNotification" in swRegistration) {
                await swRegistration.showNotification(title, {
                    body,
                    icon: NOTIF_ICON_URL,
                    badge: NOTIF_BADGE_URL,
                    tag
                });
            } else {
                new Notification(title, { body, icon: NOTIF_ICON_URL, badge: NOTIF_BADGE_URL, tag });
            }
        } catch (e) {
            console.warn("[DashboardNotifications] Error:", e);
        }
    }

    async function notifyBudgetThresholdAlert(categoryName, percentSpent, remainingAmt, currency = '₹') {
        playCustomNotificationSound();
        const isExceeded = percentSpent >= 100;
        const title = isExceeded
            ? `Budget Exceeded: ${categoryName}`
            : `Budget Warning: ${categoryName} (${Math.round(percentSpent)}%)`;
        const remainingFormatted = formatNotificationCurrency(Math.abs(remainingAmt), currency);
        const body = isExceeded
            ? `You have exceeded your limit for ${categoryName} by ${remainingFormatted}.`
            : `You have used ${Math.round(percentSpent)}% of your ${categoryName} budget. Remaining buffer: ${remainingFormatted}.`;
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                if (swRegistration && 'showNotification' in swRegistration) {
                    await swRegistration.showNotification(title, {
                        body,
                        icon: NOTIF_ICON_URL,
                        badge: NOTIF_BADGE_URL,
                        tag: `budget-${categoryName}`
                    });
                } else {
                    new Notification(title, { body, icon: NOTIF_ICON_URL, badge: NOTIF_BADGE_URL });
                }
            } catch (e) {
                console.warn('[DashboardNotifications] Error:', e);
            }
        }
    }

    window.DashboardNotifications = Object.freeze({
        parseFinancialDebitText,
        requestNotificationPermission,
        notifyInstantDebit,
        notifySalaryCredit,
        notifyTransactionRecorded,
        notifyBudgetThresholdAlert,
        ingestFinancialMessage,
        promptPasteBankSMS,
        setupNotificationBanner,
        handleNotificationAction,
        playCustomNotificationSound,
        isNotificationSoundEnabled,
        setNotificationSoundEnabled
    });

})();
