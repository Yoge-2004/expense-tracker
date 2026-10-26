/**
 * @file loans-manager.js
 * @description Frontend Client Module for Peer Loans, Friend Adjustments, and Casual Debt Tracking.
 * Keeps casual friend borrowings, bill splits, and repayments separate from personal budgets
 * and living expenses, providing dedicated metrics, filter tabs, 1-click settlements,
 * previous expense bill-split linkage, and customizable collection/repayment reminders.
 * Designed with 100% vector SVG icons, smooth skeleton loading, and automatic "Loan" category migration.
 */

(function (global) {
    "use strict";

    let loansList = [];
    let currentMetrics = null;
    let activeFilter = "ALL";
    let isLoading = false;
    const remindedThisSession = new Set();

    function getUserId() {
        const id = localStorage.getItem("userId") || sessionStorage.getItem("userId");
        if (id) return id;
        const userStr = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (!userStr) return null;
        try {
            const u = JSON.parse(userStr);
            return u.id || null;
        } catch {
            return null;
        }
    }

    function getApiBase() {
        if (typeof window !== "undefined" && window.API_BASE_URL) {
            return window.API_BASE_URL;
        }
        return (["localhost", "127.0.0.1", ""].includes(window.location.hostname) || window.location.protocol === "file:")
            ? "http://localhost:8080/api"
            : "https://yoge-2004-expense-tracker-backend.hf.space/api";
    }

    function getAuthHeaders() {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = "Bearer " + token;
        return headers;
    }

    function getCurrencySymbol() {
        if (typeof window.getCurrencySymbol === "function") {
            return window.getCurrencySymbol();
        }
        const savedCur = localStorage.getItem("userCurrency") || sessionStorage.getItem("userCurrency");
        if (savedCur) {
            const cur = savedCur.toUpperCase();
            if (cur === "USD") return "$";
            if (cur === "EUR") return "€";
            if (cur === "GBP") return "£";
            if (cur === "JPY") return "¥";
            return "₹";
        }
        const userStr = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (userStr) {
            try {
                const u = JSON.parse(userStr);
                const cur = (u.currency || "INR").toUpperCase();
                if (cur === "USD") return "$";
                if (cur === "EUR") return "€";
                if (cur === "GBP") return "£";
                if (cur === "JPY") return "¥";
                return "₹";
            } catch (err) { console.debug("[Loans] Curr fallback:", err.message); }
        }
        return "₹";
    }

    function formatAmount(num) {
        const n = Number(num);
        const safe = isNaN(n) ? 0 : n;
        return safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function getLoanCategoryExpenses() {
        const expenses = (typeof window !== "undefined" && Array.isArray(window.allExpenses)) ? window.allExpenses : [];
        return expenses.filter(e => {
            const cat = (e.categoryName || "").toLowerCase();
            const desc = (e.description || "").toLowerCase();
            return cat.includes("loan") || cat.includes("borrow") || desc.includes("loan to") || desc.includes("loan from");
        });
    }

    function renderSkeleton() {
        document.querySelectorAll(".loans-metrics-grid .loan-metric-card").forEach(card => {
            card.classList.add("is-loading");
        });
        const lentVal = document.getElementById("loansTotalLent");
        if (lentVal) lentVal.innerHTML = "<span class=\"skeleton skeleton-value\" style=\"width:95px; height:24px; display:inline-block; margin-bottom:0;\"></span>";
        const borrowedVal = document.getElementById("loansTotalBorrowed");
        if (borrowedVal) borrowedVal.innerHTML = "<span class=\"skeleton skeleton-value\" style=\"width:95px; height:24px; display:inline-block; margin-bottom:0;\"></span>";
        const netVal = document.getElementById("loansNetBalance");
        if (netVal) netVal.innerHTML = "<span class=\"skeleton skeleton-value\" style=\"width:95px; height:24px; display:inline-block; margin-bottom:0;\"></span>";
        const pendingCountEl = document.getElementById("loansPendingCount");
        const settledCountEl = document.getElementById("loansSettledCount");
        if (pendingCountEl && pendingCountEl.parentElement) {
            pendingCountEl.parentElement.innerHTML = "<span id=\"loansPendingCount\"><span class=\"skeleton skeleton-value\" style=\"width:36px; height:22px; display:inline-block; margin-bottom:0;\"></span></span> <span style=\"font-size:12px; font-weight:600; color:var(--text-muted);\">open / </span><span id=\"loansSettledCount\"><span class=\"skeleton skeleton-value\" style=\"width:36px; height:22px; display:inline-block; margin-bottom:0;\"></span></span> <span style=\"font-size:12px; font-weight:600; color:#10B981;\">done</span>";
        }
        const lentPendingSubEl = document.getElementById("loansLentPendingCount");
        if (lentPendingSubEl) lentPendingSubEl.innerHTML = "<span class=\"skeleton skeleton-text short\" style=\"width:28px; height:12px; display:inline-block; margin-bottom:0;\"></span>";
        const borrowedPendingSubEl = document.getElementById("loansBorrowedPendingCount");
        if (borrowedPendingSubEl) borrowedPendingSubEl.innerHTML = "<span class=\"skeleton skeleton-text short\" style=\"width:28px; height:12px; display:inline-block; margin-bottom:0;\"></span>";
        const netStatusEl = document.getElementById("loansNetStatus");
        if (netStatusEl) netStatusEl.innerHTML = "<span class=\"skeleton skeleton-text short\" style=\"width:65px; height:12px; display:inline-block; margin-bottom:0;\"></span>";

        const container = document.getElementById("loansListContainer");
        if (!container) return;
        container.innerHTML = `
            <div class="loans-skeleton-loader" style="padding:16px; border:1px solid var(--border); border-radius:14px; background:rgba(255,255,255,0.02); display:flex; flex-direction:column; gap:10px;">
                <div class="skeleton" style="width:35%; height:20px; border-radius:6px;"></div>
                <div class="skeleton" style="width:100%; height:52px; border-radius:10px;"></div>
                <div class="skeleton" style="width:100%; height:52px; border-radius:10px;"></div>
            </div>
        `;
    }

    function renderOfflineState() {
        document.querySelectorAll(".loans-metrics-grid .loan-metric-card").forEach(card => {
            card.classList.remove("is-loading");
        });
        const lentEl = document.getElementById("loansTotalLent");
        if (lentEl) lentEl.textContent = "--";
        const borrowedEl = document.getElementById("loansTotalBorrowed");
        if (borrowedEl) borrowedEl.textContent = "--";
        const netEl = document.getElementById("loansNetBalance");
        if (netEl) {
            netEl.textContent = "--";
            netEl.style.color = "var(--text-muted)";
        }
        const netStatusEl = document.getElementById("loansNetStatus");
        if (netStatusEl) netStatusEl.textContent = "Offline";
        const pendingCountEl = document.getElementById("loansPendingCount");
        if (pendingCountEl) pendingCountEl.textContent = "--";
        const settledCountEl = document.getElementById("loansSettledCount");
        if (settledCountEl) settledCountEl.textContent = "--";
        const lentPendingSubEl = document.getElementById("loansLentPendingCount");
        if (lentPendingSubEl) lentPendingSubEl.textContent = "--";
        const borrowedPendingSubEl = document.getElementById("loansBorrowedPendingCount");
        if (borrowedPendingSubEl) borrowedPendingSubEl.textContent = "--";

        const container = document.getElementById("loansListContainer");
        if (container && (!loansList || loansList.length === 0)) {
            container.innerHTML = `
                <div class="empty-state-compact connection-error" style="text-align:center; padding:32px 16px; color:var(--text-muted); border:1px dashed var(--border); border-radius:14px; background:rgba(255,255,255,0.02); width:100%; box-sizing:border-box;">
                    <div style="margin-bottom:6px;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                    <p style="font-size:14px; font-weight:600; margin:0 0 6px; color:var(--text-main);">Server Connection Failed</p>
                    <span style="font-size:12.5px; display:block; margin-bottom:12px;">Could not reach the server to load your peer loan adjustments.</span>
                    <button type="button" class="btn-primary btn-small" onclick="window.LoansManager ? window.LoansManager.fetchLoans() : location.reload()" style="display:inline-flex; align-items:center; gap:6px; margin:0 auto; background:#8B5CF6; border-color:#8B5CF6; color:#fff;">
                        <span>Retry Connection</span>
                    </button>
                </div>`;
        }
    }

    async function fetchLoans() {
        const userId = getUserId();
        if (!userId) return;

        if (loansList.length === 0) {
            renderSkeleton();
        }
        isLoading = true;

        try {
            const fetchFn = (typeof window !== "undefined" && typeof window.apiRequest === "function")
                ? (endpoint) => window.apiRequest(endpoint)
                : (endpoint) => fetch(`${getApiBase()}${endpoint}`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : Promise.reject(r));

            const [loansRes, metricsRes] = await Promise.all([
                fetchFn(`/loans/user/${userId}`),
                fetchFn(`/loans/metrics/user/${userId}`)
            ]);

            loansList = Array.isArray(loansRes) ? loansRes : [];
            currentMetrics = metricsRes || null;

            renderMetrics();
            renderLoanCategoryNotice();
            renderList();
            checkAndTriggerDueReminders();
        } catch (err) {
            console.warn("[LoansManager] Failed to fetch loans:", err);
            renderOfflineState();
        } finally {
            isLoading = false;
        }
    }

    function renderLoanCategoryNotice() {
        let noticeBox = document.getElementById("loanCategoryNotice");
        const loanExpenses = getLoanCategoryExpenses();

        if (loanExpenses.length === 0) {
            if (noticeBox) noticeBox.style.display = "none";
            return;
        }

        const sym = getCurrencySymbol();
        const loansSection = document.getElementById("loansSection");
        if (!loansSection) return;

        if (!noticeBox) {
            noticeBox = document.createElement("div");
            noticeBox.id = "loanCategoryNotice";
            noticeBox.className = "loan-category-notice-card";
            noticeBox.style.cssText = "margin-bottom:14px; padding:12px 16px; border-radius:12px; background:rgba(212,175,55,0.08); border:1px solid rgba(212,175,55,0.35); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;";
            const listWrapper = document.getElementById("loansListContainer");
            if (listWrapper && listWrapper.parentNode) {
                listWrapper.parentNode.insertBefore(noticeBox, listWrapper);
            }
        }

        noticeBox.style.display = "flex";
        noticeBox.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:8px; background:rgba(212,175,55,0.18); color:#D4AF37;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>
                </span>
                <div>
                    <strong style="font-size:12.5px; color:var(--text-main);">Found ${loanExpenses.length} transaction(s) categorized under "Loan"</strong>
                    <div style="font-size:11.5px; color:var(--text-muted); margin-top:1px;">Convert them into dedicated Peer Loans to keep your living expenses accurate.</div>
                </div>
            </div>
            <button type="button" class="btn-small" onclick="window.LoansManager.convertFirstLoanCategoryExpense()" style="padding:5px 12px; font-size:11.5px; font-weight:700; border-radius:7px; background:#D4AF37; color:#10120E; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
                <span>Track as Peer Loan</span>
            </button>
        `;
    }

    function checkAndTriggerDueReminders() {
        if (!Array.isArray(loansList)) return;
        const sym = getCurrencySymbol();
        const todayStr = new Date().toISOString().slice(0, 10);
        const dayOfWeek = new Date().getDay();
        const dayOfMonth = new Date().getDate();

        loansList.forEach(loan => {
            if (loan.isSettled || !loan.reminderEnabled) return;
            const reminderKey = `loan_remind_${loan.id}_${todayStr}`;
            if (remindedThisSession.has(reminderKey)) return;

            let isDueToday = false;
            const freq = (loan.reminderFrequency || "DAILY").toUpperCase();

            if (freq === "DAILY") {
                isDueToday = true;
            } else if (freq === "WEEKLY") {
                const targetDay = loan.reminderDate ? new Date(loan.reminderDate).getDay() : 1;
                if (dayOfWeek === targetDay) isDueToday = true;
            } else if (freq === "MONTHLY") {
                const targetDom = loan.reminderDate ? new Date(loan.reminderDate).getDate() : 1;
                if (dayOfMonth === targetDom) isDueToday = true;
            } else if (freq === "ONCE") {
                if (loan.reminderDate === todayStr) isDueToday = true;
            }

            if (isDueToday) {
                remindedThisSession.add(reminderKey);
                const isLent = loan.type === "LENT";
                const actionWord = isLent ? "Collect" : "Pay back";
                const directionWord = isLent ? "from" : "to";
                const message = `Reminder to ${actionWord} ${sym}${formatAmount(loan.amount)} ${directionWord} ${loan.counterparty} (scheduled @ ${loan.reminderTime || '10:00'})`;

                if (typeof window.showToast === "function") {
                    setTimeout(() => window.showToast(message, "info"), 800);
                }
            }
        });
    }

    function renderMetrics() {
        const isOffline = document.body.classList.contains("server-offline");
        const lentEl = document.getElementById("loansTotalLent");
        const borrowedEl = document.getElementById("loansTotalBorrowed");
        const netEl = document.getElementById("loansNetBalance");
        const netStatusEl = document.getElementById("loansNetStatus");
        const pendingCountEl = document.getElementById("loansPendingCount");
        const settledCountEl = document.getElementById("loansSettledCount");
        const lentPendingSubEl = document.getElementById("loansLentPendingCount");
        const borrowedPendingSubEl = document.getElementById("loansBorrowedPendingCount");

        if (isOffline || (!currentMetrics && (!loansList || loansList.length === 0))) {
            if (lentEl) lentEl.textContent = "--";
            if (borrowedEl) borrowedEl.textContent = "--";
            if (netEl) {
                netEl.textContent = "--";
                netEl.style.color = "var(--text-muted)";
            }
            if (netStatusEl) netStatusEl.textContent = isOffline ? "Offline" : "--";
            if (pendingCountEl) pendingCountEl.textContent = "--";
            if (settledCountEl) settledCountEl.textContent = "--";
            if (lentPendingSubEl) lentPendingSubEl.textContent = "--";
            if (borrowedPendingSubEl) borrowedPendingSubEl.textContent = "--";
            return;
        }

        document.querySelectorAll(".loans-metrics-grid .loan-metric-card").forEach(c => c.classList.remove("is-loading"));
        const sym = getCurrencySymbol();
        const m = currentMetrics || {
            totalLent: 0,
            totalBorrowed: 0,
            lentPending: 0,
            borrowedPending: 0,
            netBalance: 0,
            totalCount: 0,
            pendingCount: 0,
            settledCount: 0
        };

        if (lentEl) lentEl.textContent = `${sym}${formatAmount(m.lentPending)}`;
        if (borrowedEl) borrowedEl.textContent = `${sym}${formatAmount(m.borrowedPending)}`;

        if (netEl) {
            const net = Number(m.netBalance) || 0;
            if (net > 0) {
                netEl.textContent = `+${sym}${formatAmount(net)}`;
                netEl.style.color = "#10B981";
                if (netStatusEl) {
                    netStatusEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px; color:#10B981;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg> Friends owe you net ${sym}${formatAmount(net)}</span>`;
                }
            } else if (net < 0) {
                netEl.textContent = `-${sym}${formatAmount(Math.abs(net))}`;
                netEl.style.color = "#EF4444";
                if (netStatusEl) {
                    netStatusEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px; color:#EF4444;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 7l-9.2 9.2M7 7v10h10"/></svg> You owe lenders net ${sym}${formatAmount(Math.abs(net))}</span>`;
                }
            } else {
                netEl.textContent = `${sym}0.00`;
                netEl.style.color = "var(--text-main)";
                if (netStatusEl) {
                    netStatusEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px; color:var(--text-muted);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 8l9-5 9 5M6 14l-3-6h6l-3 6a3 3 0 0 1-6 0v0zM18 14l-3-6h6l-3 6a3 3 0 0 1-6 0v0z"/></svg> All peer balances settled</span>`;
                }
            }
        }

        if (pendingCountEl) pendingCountEl.textContent = String(m.pendingCount || 0);
        if (settledCountEl) settledCountEl.textContent = String(m.settledCount || 0);

        if (lentPendingSubEl) {
            const openLent = loansList.filter(l => l.type === "LENT" && !l.isSettled).length;
            lentPendingSubEl.textContent = String(openLent);
        }
        if (borrowedPendingSubEl) {
            const openBorrowed = loansList.filter(l => l.type === "BORROWED" && !l.isSettled).length;
            borrowedPendingSubEl.textContent = String(openBorrowed);
        }

        // Update tab count badges
        const countAll = loansList.length;
        const countLent = loansList.filter(l => l.type === "LENT").length;
        const countBorrowed = loansList.filter(l => l.type === "BORROWED").length;
        const countPending = loansList.filter(l => !l.isSettled).length;
        const countSettled = loansList.filter(l => l.isSettled).length;

        const tabAll = document.getElementById("tabCountAll");
        const tabLent = document.getElementById("tabCountLent");
        const tabBorrowed = document.getElementById("tabCountBorrowed");
        const tabPending = document.getElementById("tabCountPending");
        const tabSettled = document.getElementById("tabCountSettled");

        if (tabAll) tabAll.textContent = String(countAll);
        if (tabLent) tabLent.textContent = String(countLent);
        if (tabBorrowed) tabBorrowed.textContent = String(countBorrowed);
        if (tabPending) tabPending.textContent = String(countPending);
        if (tabSettled) tabSettled.textContent = String(countSettled);
    }

    function renderList() {
        const container = document.getElementById("loansListContainer");
        if (!container) return;

        let filtered = loansList;
        if (activeFilter === "LENT") {
            filtered = loansList.filter(l => l.type === "LENT");
        } else if (activeFilter === "BORROWED") {
            filtered = loansList.filter(l => l.type === "BORROWED");
        } else if (activeFilter === "PENDING") {
            filtered = loansList.filter(l => !l.isSettled);
        } else if (activeFilter === "SETTLED") {
            filtered = loansList.filter(l => l.isSettled);
        }

        if (filtered.length === 0) {
            const loanExpenses = getLoanCategoryExpenses();
            const loanConvertCta = loanExpenses.length > 0
                ? `<button type="button" class="btn-secondary btn-small" onclick="window.LoansManager.convertFirstLoanCategoryExpense()" style="display:inline-flex; align-items:center; gap:6px; border-color:rgba(212,175,55,0.4); color:#D4AF37;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
                    <span>Convert "${escapeHtml(loanExpenses[0].description || 'Loan')}" (${getCurrencySymbol()}${formatAmount(loanExpenses[0].amount)})</span>
                   </button>`
                : "";

            container.innerHTML = `
                <div class="empty-state-luxury" style="text-align:center; padding:36px 20px; color:var(--text-muted); border:1px dashed var(--border); border-radius:14px; background:rgba(255,255,255,0.02); transition:all 0.3s ease;">
                    <div style="display:inline-flex; align-items:center; justify-content:center; width:52px; height:52px; border-radius:14px; background:rgba(212,175,55,0.12); color:#D4AF37; margin-bottom:12px;">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    </div>
                    <p style="font-size:15px; font-weight:700; margin:0 0 6px; color:var(--text-main);">No peer loans recorded in this view</p>
                    <span style="font-size:12.5px; display:block; max-width:440px; margin:0 auto 16px; line-height:1.5; color:var(--text-muted);">
                        Track casual bill splits, borrowed cash, or peer loans without distorting your personal living expense budget.
                    </span>
                    <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
                        <button type="button" class="btn-primary btn-small" onclick="document.getElementById('addLoanBtn')?.click()" style="display:inline-flex; align-items:center; gap:6px; background:#8B5CF6; border-color:#8B5CF6; color:#fff; box-shadow:0 4px 14px rgba(139,92,246,0.35);">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            <span>Add New Adjustment</span>
                        </button>
                        ${loanConvertCta}
                    </div>
                </div>
            `;
            return;
        }

        const sym = getCurrencySymbol();

        let html = `
            <div class="loans-table-container" style="overflow-x:auto; border:1px solid var(--border); border-radius:12px; background:rgba(255,255,255,0.01);">
                <table class="data-table loans-table" style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
                    <thead>
                        <tr style="background:rgba(255,255,255,0.03); border-bottom:1px solid var(--border);">
                            <th style="padding:12px 14px; font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted);">Date & Reminders</th>
                            <th style="padding:12px 14px; font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted);">Person / Friend</th>
                            <th style="padding:12px 14px; font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted);">Direction</th>
                            <th style="padding:12px 14px; font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted);">Notes & Linked Expense</th>
                            <th style="padding:12px 14px; font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); text-align:right;">Amount</th>
                            <th style="padding:12px 14px; font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); text-align:center;">Status</th>
                            <th style="padding:12px 14px; font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); text-align:right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        for (const item of filtered) {
            const isLent = item.type === "LENT";
            const amtColor = isLent ? "#10B981" : "#EF4444";
            const amtSign = isLent ? "+" : "-";
            const dirLabel = isLent ? "Lent (Receivable)" : "Borrowed (Payable)";
            const dirBg = isLent ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)";
            const dirColor = isLent ? "#10B981" : "#EF4444";
            const dirIcon = isLent
                ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>`
                : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 7l-9.2 9.2M7 7v10h10"/></svg>`;

            const statusBadge = item.isSettled
                ? `<span style="display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:700; background:rgba(16,185,129,0.15); color:#10B981; border:1px solid rgba(16,185,129,0.3);"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Settled</span>`
                : `<span style="display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:700; background:rgba(245,158,11,0.15); color:#F59E0B; border:1px solid rgba(245,158,11,0.3);"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Pending</span>`;

            const settleActionText = item.isSettled ? "Reopen" : "Mark Settled";
            const settleBtnColor = item.isSettled ? "var(--text-muted)" : "#10B981";

            const dueDateTag = item.dueDate
                ? `<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Due: ${item.dueDate}</div>`
                : "";

            const reminderTag = item.reminderEnabled && !item.isSettled
                ? `<div style="font-size:10.5px; color:#8B5CF6; font-weight:600; margin-top:4px; display:inline-flex; align-items:center; gap:4px; background:rgba(139,92,246,0.08); padding:2px 6px; border-radius:4px; border:1px solid rgba(139,92,246,0.2);">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                    <span>${escapeHtml(item.reminderFrequency || 'DAILY')} @ ${escapeHtml(item.reminderTime || '10:00')}</span>
                   </div>`
                : "";

            const linkedExpenseTag = (item.expenseId || item.expenseDescription)
                ? `<div style="margin-top:4px; font-size:11px; color:#8B5CF6; display:inline-flex; align-items:center; gap:4px; background:rgba(139,92,246,0.1); padding:2px 7px; border-radius:4px; border:1px solid rgba(139,92,246,0.25);">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    <span>Split from: <strong>${escapeHtml(item.expenseDescription || ('Expense #' + item.expenseId))}</strong> (${sym}${formatAmount(item.expenseAmount || 0)})</span>
                   </div>`
                : "";

            html += `
                <tr style="border-bottom:1px solid var(--border); transition:background 0.15s ease;">
                    <td style="padding:12px 14px; white-space:nowrap; color:var(--text-muted);">
                        <div>${item.adjustmentDate}</div>
                        ${dueDateTag}
                        ${reminderTag}
                    </td>
                    <td style="padding:12px 14px; font-weight:700; color:var(--text-main);">
                        ${escapeHtml(item.counterparty)}
                    </td>
                    <td style="padding:12px 14px; white-space:nowrap;">
                        <span style="display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:700; background:${dirBg}; color:${dirColor};">
                            ${dirIcon}
                            ${dirLabel}
                        </span>
                    </td>
                    <td style="padding:12px 14px; color:var(--text-muted); max-width:260px;">
                        <div>${item.notes ? escapeHtml(item.notes) : "<span style='opacity:0.4;'>—</span>"}</div>
                        ${linkedExpenseTag}
                    </td>
                    <td style="padding:12px 14px; text-align:right; font-weight:800; font-size:14px; color:${amtColor}; white-space:nowrap;">
                        <span class="stealth-sensitive">${amtSign}${sym}${formatAmount(item.amount)}</span>
                    </td>
                    <td style="padding:12px 14px; text-align:center; white-space:nowrap;">
                        ${statusBadge}
                    </td>
                    <td style="padding:12px 14px; text-align:right; white-space:nowrap;">
                        <button type="button" class="btn-text-icon" onclick="window.LoansManager.toggleSettle(${item.id})" style="padding:4px 8px; font-size:11.5px; font-weight:600; color:${settleBtnColor}; border:1px solid var(--border); border-radius:6px; margin-right:6px;" title="${item.isSettled ? 'Mark pending again' : 'Mark fully repaid'}">
                            ${settleActionText}
                        </button>
                        <button type="button" class="btn-text-icon btn-text-icon--danger" onclick="window.LoansManager.deleteLoan(${item.id})" style="padding:4px 8px; font-size:11.5px; border-radius:6px; color:#EF4444;" title="Delete this record">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </td>
                </tr>
            `;
        }

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    }

    function escapeHtml(str) {
        if (!str) return "";
        return str.replace(/[&<>"']/g, m => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[m]));
    }

    function populateExpenseDropdown(selectedId = null) {
        const select = document.getElementById("loanExpenseId");
        if (!select) return;

        const sym = getCurrencySymbol();
        const currentVal = selectedId != null ? String(selectedId) : select.value;
        const allExpenses = (typeof window !== "undefined" && Array.isArray(window.allExpenses)) ? window.allExpenses : [];

        // Partition into "Loan" category vs general
        const loanCatExpenses = [];
        const otherExpenses = [];

        allExpenses.forEach(exp => {
            const cat = (exp.categoryName || "").toLowerCase();
            const desc = (exp.description || "").toLowerCase();
            if (cat.includes("loan") || cat.includes("borrow") || desc.includes("loan to") || desc.includes("loan from")) {
                loanCatExpenses.push(exp);
            } else {
                otherExpenses.push(exp);
            }
        });

        let html = '<option value="">-- None / Standalone Adjustment --</option>';

        if (loanCatExpenses.length > 0) {
            html += '<optgroup label="Expenses Tagged as \'Loan\' Category">';
            loanCatExpenses.forEach(exp => {
                const isSel = currentVal && String(exp.id) === String(currentVal) ? 'selected' : '';
                html += `<option value="${exp.id}" ${isSel}>${exp.expenseDate} · ${escapeHtml(exp.description || 'Loan')} (${sym}${formatAmount(exp.amount)})</option>`;
            });
            html += '</optgroup>';
        }

        if (otherExpenses.length > 0) {
            html += '<optgroup label="Recent Transactions">';
            otherExpenses.slice(0, 40).forEach(exp => {
                const isSel = currentVal && String(exp.id) === String(currentVal) ? 'selected' : '';
                html += `<option value="${exp.id}" ${isSel}>${exp.expenseDate} · ${escapeHtml(exp.description || 'Expense')} (${sym}${formatAmount(exp.amount)})</option>`;
            });
            html += '</optgroup>';
        }

        select.innerHTML = html;
    }

    async function toggleSettle(id) {
        const userId = getUserId();
        if (!userId) return;

        try {
            const res = await fetch(`${getApiBase()}/loans/${id}/settle/user/${userId}`, {
                method: "PUT",
                headers: getAuthHeaders()
            });

            if (res.ok) {
                const updated = await res.json();
                const idx = loansList.findIndex(l => l.id === id);
                if (idx !== -1) loansList[idx] = updated;

                if (typeof showToast === "function") {
                    showToast(updated.isSettled ? "Marked as settled!" : "Reopened adjustment status.", "success");
                }
                await fetchLoans();
            } else {
                throw new Error("Failed to toggle settlement status");
            }
        } catch (err) {
            console.error("[LoansManager] Settle error:", err);
            if (typeof showToast === "function") showToast("Error updating settlement status.", "error");
        }
    }

    async function deleteLoan(id) {
        if (!confirm("Are you sure you want to delete this loan / adjustment record?")) return;

        const userId = getUserId();
        if (!userId) return;

        try {
            const res = await fetch(`${getApiBase()}/loans/${id}/user/${userId}`, {
                method: "DELETE",
                headers: getAuthHeaders()
            });

            if (res.ok) {
                loansList = loansList.filter(l => l.id !== id);
                if (typeof showToast === "function") showToast("Record deleted successfully.", "success");
                await fetchLoans();
            } else {
                throw new Error("Failed to delete record");
            }
        } catch (err) {
            console.error("[LoansManager] Delete error:", err);
            if (typeof showToast === "function") showToast(err.message || "Error deleting record.", "error");
        }
    }

    function setupEventListeners() {
        const addBtn = document.getElementById("addLoanBtn");
        const modal = document.getElementById("loanModal");
        const closeBtn = document.getElementById("closeLoanModalBtn");
        const cancelBtn = document.getElementById("cancelLoanModalBtn");
        const form = document.getElementById("loanAdjustmentForm");

        const typeLentBtn = document.getElementById("loanTypeLentBtn");
        const typeBorrowedBtn = document.getElementById("loanTypeBorrowedBtn");
        const typeInput = document.getElementById("loanType");

        const expenseSelect = document.getElementById("loanExpenseId");
        const reminderCheckbox = document.getElementById("loanReminderEnabled");
        const reminderOptions = document.getElementById("loanReminderOptions");
        const reminderFreqSelect = document.getElementById("loanReminderFrequency");
        const reminderDateGroup = document.getElementById("loanReminderDateGroup");

        function openModal() {
            if (!modal) return;
            form?.reset();
            populateExpenseDropdown();

            const dateInput = document.getElementById("loanDate");
            if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

            if (reminderOptions) reminderOptions.style.display = "none";
            if (reminderDateGroup) reminderDateGroup.style.display = "none";

            selectType("LENT");
            if (typeof window.openModal === "function") {
                window.openModal(modal);
            } else {
                modal.removeAttribute("hidden");
                modal.classList.add("active");
                document.body.classList.add("modal-open");
            }
        }

        function closeModal() {
            if (!modal) return;
            if (typeof window.closeModal === "function") {
                window.closeModal(modal);
            } else {
                modal.classList.remove("active");
                if (!document.querySelector(".modal-overlay.active")) {
                    document.body.classList.remove("modal-open");
                }
            }
        }

        function selectType(t) {
            if (typeInput) typeInput.value = t;
            if (t === "LENT") {
                typeLentBtn?.classList.add("active");
                typeBorrowedBtn?.classList.remove("active");
            } else {
                typeBorrowedBtn?.classList.add("active");
                typeLentBtn?.classList.remove("active");
            }
        }

        addBtn?.addEventListener("click", openModal);
        closeBtn?.addEventListener("click", closeModal);
        cancelBtn?.addEventListener("click", closeModal);
        modal?.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });

        typeLentBtn?.addEventListener("click", () => selectType("LENT"));
        typeBorrowedBtn?.addEventListener("click", () => selectType("BORROWED"));

        // Connect previous expense auto-fill
        expenseSelect?.addEventListener("change", (e) => {
            const val = e.target.value;
            if (!val) return;
            const expId = parseInt(val, 10);
            const expenses = (typeof window !== "undefined" && Array.isArray(window.allExpenses)) ? window.allExpenses : [];
            const found = expenses.find(x => x.id === expId);
            if (found) {
                const amtInput = document.getElementById("loanAmount");
                const notesInput = document.getElementById("loanNotes");
                const dateInput = document.getElementById("loanDate");
                const counterInput = document.getElementById("loanCounterparty");

                if (amtInput && (!amtInput.value || parseFloat(amtInput.value) <= 0)) {
                    amtInput.value = found.amount;
                }
                if (notesInput && (!notesInput.value || notesInput.value.startsWith("Split:"))) {
                    notesInput.value = `Split: ${found.description || 'Expense'}`;
                }
                if (dateInput && found.expenseDate) {
                    dateInput.value = found.expenseDate;
                }
                if (counterInput && !counterInput.value) {
                    counterInput.value = found.description || "Friend";
                }
            }
        });

        // Reminder toggle handlers
        reminderCheckbox?.addEventListener("change", (e) => {
            if (reminderOptions) {
                reminderOptions.style.display = e.target.checked ? "block" : "none";
            }
        });

        reminderFreqSelect?.addEventListener("change", (e) => {
            if (reminderDateGroup) {
                reminderDateGroup.style.display = e.target.value === "ONCE" ? "block" : "none";
            }
        });

        // Tab filters
        document.querySelectorAll(".loan-tab-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".loan-tab-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                activeFilter = btn.dataset.filter || "ALL";
                renderList();
            });
        });

        // Form submit
        form?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const userId = getUserId();
            if (!userId) {
                if (typeof showToast === "function") showToast("Please log in first.", "error");
                return;
            }

            const counterparty = document.getElementById("loanCounterparty")?.value?.trim();
            const type = typeInput?.value || "LENT";
            const amount = parseFloat(document.getElementById("loanAmount")?.value);
            const adjustmentDate = document.getElementById("loanDate")?.value;
            const dueDate = document.getElementById("loanDueDate")?.value || null;
            const notes = document.getElementById("loanNotes")?.value?.trim() || null;
            const isSettled = document.getElementById("loanIsSettled")?.checked || false;

            const expenseIdVal = document.getElementById("loanExpenseId")?.value;
            const expenseId = expenseIdVal ? parseInt(expenseIdVal, 10) : null;

            const reminderEnabled = document.getElementById("loanReminderEnabled")?.checked || false;
            const reminderFrequency = reminderEnabled ? (document.getElementById("loanReminderFrequency")?.value || "DAILY") : null;
            const reminderTime = reminderEnabled ? (document.getElementById("loanReminderTime")?.value || "10:00") : null;
            const reminderDate = reminderEnabled ? (document.getElementById("loanReminderDate")?.value || null) : null;

            if (!counterparty || isNaN(amount) || amount <= 0 || !adjustmentDate) {
                if (typeof showToast === "function") showToast("Please enter all required fields.", "error");
                return;
            }

            const payload = {
                counterparty,
                type,
                amount,
                adjustmentDate,
                dueDate,
                notes,
                isSettled,
                expenseId,
                reminderEnabled,
                reminderFrequency,
                reminderTime,
                reminderDate
            };

            try {
                const res = await fetch(`${getApiBase()}/loans/user/${userId}`, {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    closeModal();
                    if (typeof showToast === "function") {
                        showToast(`Recorded ${type === "LENT" ? "lent adjustment" : "loan borrowed"} successfully!`, "success");
                    }
                    await fetchLoans();
                } else {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.message || "Failed to save loan adjustment");
                }
            } catch (err) {
                console.error("[LoansManager] Save error:", err);
                if (typeof showToast === "function") showToast(err.message || "Error saving record.", "error");
            }
        });
    }

    function openWithExpense(expenseId, desc, amount, date) {
        if (window.event) window.event.__handled = true;
        const modal = document.getElementById("loanModal");
        const form = document.getElementById("loanAdjustmentForm");
        if (!modal) return;

        form?.reset();
        populateExpenseDropdown(expenseId);

        const typeInput = document.getElementById("loanType");
        if (typeInput) typeInput.value = "LENT";
        document.getElementById("loanTypeLentBtn")?.classList.add("active");
        document.getElementById("loanTypeBorrowedBtn")?.classList.remove("active");

        const amtInput = document.getElementById("loanAmount");
        if (amtInput && amount) amtInput.value = amount;

        const dateInput = document.getElementById("loanDate");
        if (dateInput) dateInput.value = date || new Date().toISOString().slice(0, 10);

        const notesInput = document.getElementById("loanNotes");
        if (notesInput && desc) notesInput.value = `Split for: ${desc}`;

        const counterInput = document.getElementById("loanCounterparty");
        if (counterInput && !counterInput.value) counterInput.value = desc || "Friend";

        const reminderOptions = document.getElementById("loanReminderOptions");
        if (reminderOptions) reminderOptions.style.display = "none";

        if (typeof window.openModal === "function") {
            window.openModal(modal);
        } else {
            modal.removeAttribute("hidden");
            modal.classList.add("active");
            document.body.classList.add("modal-open");
        }

        setTimeout(() => {
            document.getElementById("loanCounterparty")?.focus();
        }, 150);
    }

    function convertFirstLoanCategoryExpense() {
        const loanExpenses = getLoanCategoryExpenses();
        if (loanExpenses.length === 0) {
            if (typeof showToast === "function") showToast("No expenses tagged with category 'Loan' found.", "info");
            return;
        }
        const first = loanExpenses[0];
        openWithExpense(first.id, first.description || "Loan Expense", first.amount, first.expenseDate);
    }

    function init() {
        setupEventListeners();
        fetchLoans();

        // Refresh whenever currency or ledger updates
        window.addEventListener("currencyChanged", () => {
            renderMetrics();
            renderList();
        });
    }

    if (typeof document !== "undefined" && document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    global.LoansManager = {
        fetchLoans,
        toggleSettle,
        deleteLoan,
        renderMetrics,
        renderSkeleton,
        renderOfflineState,
        renderList,
        populateExpenseDropdown,
        openWithExpense,
        convertFirstLoanCategoryExpense
    };

})(typeof window !== "undefined" ? window : globalThis);
