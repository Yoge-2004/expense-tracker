/* ==========================================================================
   DASHBOARD NOTIFICATIONS & REAL-TIME DEBIT NOTIFIER MODULE
   ==========================================================================
   Manages browser Push notifications, parses financial SMS / debit messages,
   and instantly triggers desktop/mobile web notifications then-and-there
   when debit transactions are detected.
   ========================================================================== */

(function () {
    "use strict";

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
        } catch (_) {}

        // Resolve candidates based on whether we are loaded in a /frontend/ subpath or at root
        const isFrontendSubdir = window.location.pathname.includes("/frontend/");
        const candidatePaths = isFrontendSubdir
            ? ["sw.js", "/frontend/sw.js", "/sw.js"]
            : ["/sw.js", "sw.js"];

        for (const candidate of candidatePaths) {
            try {
                // Verify script availability before register() to prevent browser console 404
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
    // Dispatches notification immediately then-and-there
    async function notifyInstantDebit(parsed) {
        if (!parsed || parsed.direction !== "DEBIT") return false;

        const title = `💸 Instant Debit Alert: ${parsed.currency} ${parsed.amount.toFixed(2)}`;
        const merchantPart = parsed.merchant ? ` at ${parsed.merchant}` : "";
        const accPart = parsed.accountTail ? ` (Card/A/c xx${parsed.accountTail})` : "";
        const body = `Spent ${parsed.currency} ${parsed.amount.toFixed(2)}${merchantPart}${accPart}. Tap to record or categorize now.`;

        // Check if Notification permission is available
        if ("Notification" in window && Notification.permission === "granted") {
            try {
                if (swRegistration && "showNotification" in swRegistration) {
                    await swRegistration.showNotification(title, {
                        body,
                        icon: "/assets/icon-192.png",
                        badge: "/assets/badge-72.png",
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
                        icon: "/assets/icon-192.png",
                        badge: "/assets/badge-72.png"
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
        const addBtn = document.getElementById("openAddExpenseModalBtn");
        if (addBtn) {
            addBtn.click();
            // Pre-fill amount & description
            setTimeout(() => {
                const amountInput = document.getElementById("amount");
                const descInput = document.getElementById("desc");
                if (amountInput && data.amount) {
                    amountInput.value = data.amount;
                    amountInput.dispatchEvent(new Event("input", { bubbles: true }));
                }
                if (descInput && data.merchant) {
                    descInput.value = data.merchant;
                    descInput.dispatchEvent(new Event("input", { bubbles: true }));
                }
            }, 300);
        }
    }

    // 5. INCOMING MESSAGE INGESTION API
    // Call this whenever an SMS or webhook or simulated debit is received
    async function ingestFinancialMessage(text) {
        const parsed = parseFinancialDebitText(text);
        if (parsed && parsed.direction === "DEBIT") {
            await notifyInstantDebit(parsed);
            return parsed;
        }
        return null;
    }

    // 6. UI TOGGLE IN PROFILE / MODAL SETTINGS
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

    // 7. INITIALIZE
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            registerServiceWorker();
            setupNotificationToggle();
        });
    } else {
        registerServiceWorker();
        setupNotificationToggle();
    }

    window.DashboardNotifications = Object.freeze({
        parseFinancialDebitText,
        requestNotificationPermission,
        notifyInstantDebit,
        ingestFinancialMessage,
        handleNotificationAction
    });

})();
