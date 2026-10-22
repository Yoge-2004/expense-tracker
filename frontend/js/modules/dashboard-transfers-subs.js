var elements = window.elements || window.DashboardDom?.elements || {};
var userId = window.userId || localStorage.getItem("userId");
function uploadFileWithProgress(url, formData, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        const currentToken = localStorage.getItem("token") || (typeof authToken !== "undefined" ? authToken : "") || (typeof token !== "undefined" ? token : "");
        if (currentToken) {
            xhr.setRequestHeader("Authorization", `Bearer ${currentToken}`);
        }
        if (xhr.upload && typeof onProgress === "function") {
            xhr.upload.onprogress = (evt) => {
                if (evt.lengthComputable && evt.total > 0) {
                    const percent = Math.round((evt.loaded / evt.total) * 100);
                    onProgress(percent, evt.loaded, evt.total);
                }
            };
        }
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const json = JSON.parse(xhr.responseText);
                    resolve(json);
                } catch (_) {
                    resolve({ message: xhr.responseText || "Import completed successfully" });
                }
            } else {
                let errMsg = `Upload failed with status ${xhr.status}`;
                try {
                    const errObj = JSON.parse(xhr.responseText);
                    errMsg = errObj.message || errObj.error || errMsg;
                } catch (_) {
                    if (xhr.responseText) errMsg = xhr.responseText;
                }
                reject(new Error(errMsg));
            }
        };
        xhr.onerror = () => reject(new Error("Network failure during file upload. Please check connection."));
        xhr.send(formData);
    });
}

// Fetching with streaming chunks keeps the token safe and displays download progress.
async function downloadAuthenticated(url, fallbackFilename, loadingMessage, fallbackFn = null) {
    TransferDock.show({
        filename: fallbackFilename,
        mode: "export",
        status: loadingMessage || "Preparing document..."
    });
    try {
        const currentToken = localStorage.getItem("token") || (typeof authToken !== "undefined" ? authToken : "") || (typeof token !== "undefined" ? token : "");
        const activeCurr = (typeof getSelectedCurrency === "function" ? getSelectedCurrency() : (localStorage.getItem("userCurrency") || "INR"));
        const sep = url.includes("?") ? "&" : "?";
        const finalUrl = `${url}${sep}currency=${encodeURIComponent(activeCurr)}`;
        
        const reqHeaders = {};
        if (currentToken) {
            reqHeaders["Authorization"] = `Bearer ${currentToken}`;
        }
        if (activeCurr) {
            reqHeaders["X-Currency"] = activeCurr;
        }

        TransferDock.updateProgress(15, "Connecting to reporting engine...", "Compiling ledger records");
        const res = await fetch(finalUrl, { headers: reqHeaders });
        if (!res.ok) {
            if (res.status === 401) {
                throw new Error("Authentication session expired. Please log in again.");
            }
            throw new Error(`Export server responded with status ${res.status}`);
        }
        const disposition = res.headers.get("Content-Disposition") || "";
        const match = disposition.match(/filename="?([^"]+)"?/);
        const filename = match ? match[1] : fallbackFilename;

        let blob;
        const contentLength = res.headers.get("Content-Length");
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        if (res.body && typeof res.body.getReader === "function") {
            const reader = res.body.getReader();
            const chunks = [];
            let received = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                received += value.length;
                if (total > 0) {
                    const pct = Math.round((received / total) * 100);
                    TransferDock.updateProgress(
                        pct,
                        `Downloading ${filename}`,
                        `${Math.round(received / 1024)} KB / ${Math.round(total / 1024)} KB`
                    );
                } else {
                    const kb = Math.round(received / 1024);
                    TransferDock.updateProgress(
                        null,
                        `Downloading ${filename}`,
                        `${kb} KB received`
                    );
                }
            }
            blob = new Blob(chunks, { type: res.headers.get("Content-Type") || "application/octet-stream" });
        } else {
            TransferDock.updateProgress(85, `Downloading ${filename}`, "Receiving payload...");
            blob = await res.blob();
        }
        triggerFileDownload(blob, filename);
        TransferDock.complete(`${filename} downloaded`);
        showToast(`${filename} downloaded successfully.`, "success");
    } catch (err) {
        console.warn("downloadAuthenticated backend call failed, attempting fallback:", err);
        if (typeof fallbackFn === "function") {
            try {
                TransferDock.updateProgress(90, "Using client generator fallback...", "Formatting file");
                fallbackFn();
                TransferDock.complete(`${fallbackFilename} generated`);
                showToast(`${fallbackFilename} generated and downloaded.`, "success");
                return;
            } catch (fbErr) {
                console.error("Client fallback generation failed:", fbErr);
            }
        }
        TransferDock.fail(err.message || "Export failed");
        showToast(err.message || "Export failed", "error");
    }
}

document.getElementById("exportExcelBtn")?.addEventListener("click", () => {
    downloadAuthenticated(
        `${API_BASE_URL}/expenses/user/${userId}/export/excel`,
        "expenses.xlsx",
        "Generating Expenses Excel Workbook...",
        () => exportExpensesClientSideExcel()
    );
});

document.getElementById("exportReportExcelBtn")?.addEventListener("click", () => {
    downloadAuthenticated(
        `${API_BASE_URL}/reports/user/${userId}/export/excel`,
        "executive_financial_statement.xlsx",
        "Generating Complete Executive Financial Workbook (Excel)..."
    );
});

document.getElementById("exportCsvBtn")?.addEventListener("click", () => {
    downloadAuthenticated(`${API_BASE_URL}/expenses/user/${userId}/export/csv`, "expenses.csv", "Exporting CSV...");
});

document.getElementById("exportJsonBtn")?.addEventListener("click", () => {
    downloadAuthenticated(`${API_BASE_URL}/expenses/user/${userId}/export/json`, "expenses.json", "Exporting JSON...");
});

document.getElementById("exportPdfBtn")?.addEventListener("click", () => {
    downloadAuthenticated(`${API_BASE_URL}/expenses/user/${userId}/export/pdf`, "expenses.pdf", "Generating PDF report...");
});

const importBtn = document.getElementById("importBtn");
const importFileInput = document.getElementById("importFileInput");

importBtn?.addEventListener("click", () => importFileInput?.click());

importFileInput?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const fname = file.name.toLowerCase();
    let endpoint = `/expenses/user/${userId}/import/csv`;
    if (fname.endsWith(".json")) {
        endpoint = `/expenses/user/${userId}/import/json`;
    } else if (fname.endsWith(".xlsx") || fname.endsWith(".xls")) {
        endpoint = `/expenses/user/${userId}/import/excel`;
    }

    try {
        TransferDock.show({
            filename: fname,
            mode: "import",
            status: "Uploading spreadsheet payload..."
        });
        const data = await uploadFileWithProgress(`${API_BASE_URL}${endpoint}`, formData, (pct, loaded, total) => {
            const loadedKb = Math.round(loaded / 1024);
            const totalKb = Math.round(total / 1024);
            TransferDock.updateProgress(
                pct,
                `Uploading ${fname}`,
                `${pct}% · ${loadedKb} / ${totalKb} KB`
            );
        });
        TransferDock.updateProgress(98, "Parsing and committing rows...", "Database sync");
        if (data.failedRows > 0) {
            TransferDock.complete(`Imported ${data.imported || 0} (${data.failedRows} skipped)`);
            showToast(`${data.imported} imported, ${data.failedRows} row(s) skipped — see console for details.`, data.imported > 0 ? "info" : "error");
            console.warn("Import row errors:", data.errors);
        } else {
            TransferDock.complete(`Imported ${data.imported || 0} records`);
            showToast(data.message || "Expenses imported successfully!", "success");
        }
        if (typeof window.clearApiCache === "function") window.clearApiCache();
        try { localStorage.removeItem(getCacheKey()); } catch (_) {}
        await loadDashboard(true);
    } catch (err) {
        TransferDock.fail(err.message || "Import failed");
        showToast(err.message, "error");
    } finally {
        importFileInput.value = "";
    }
});

// --- 7. SUBSCRIPTION MANAGER (View, Edit, Delete) ---

// Open Modal
elements.manageSubsBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    toggleProfileMenu(false);
    openModal(elements.subsModal);
    loadSubscriptions();
});

// Also handle the "Manage Subscriptions →" link in the metrics card
document.getElementById("manageSubsLink")?.addEventListener("click", async (e) => {
    e.preventDefault();
    openModal(elements.subsModal);
    loadSubscriptions();
});

// Close Modal
elements.closeSubsBtn?.addEventListener("click", () => {
    closeModal(elements.subsModal);
});
elements.subsModal?.addEventListener("click", (e) => {
    if (e.target === elements.subsModal) closeModal(elements.subsModal);
});

let currentSubsModalTab = 'expenses';
let cachedSubsExpenses = [];
let cachedSubsIncomes = [];
let isSubsOffline = false;

async function loadSubscriptions() {
    if (elements.subsList) {
        elements.subsList.innerHTML = '<p class="text-muted u-inl-dfbb5f7">Loading active recurring commitments & inflows...</p>';
    }

    try {
        const activeExpenses = allExpenses || [];
        const activeIncomes = allIncomes || [];

        let subsFailed = false;
        let incsFailed = false;
        let savsFailed = false;

        const isFileOrOffline = window.location.protocol === "file:" || !navigator.onLine || window.location.search.includes("test_mock_auth") || !userId;
        const [subs, incs, savs] = await Promise.all([
            (activeExpenses && activeExpenses.length > 0)
                ? Promise.resolve(activeExpenses.filter(e => !!(e.isRecurring || e.recurring)))
                : (isFileOrOffline ? Promise.resolve([]) : apiRequest(`/expenses/recurring/user/${userId}`).catch(err => {
                    console.warn("Failed to load recurring expenses:", err);
                    subsFailed = true;
                    return null;
                })),
            (activeIncomes && activeIncomes.length > 0)
                ? Promise.resolve(activeIncomes)
                : (isFileOrOffline ? Promise.resolve([]) : apiRequest(`/incomes/user/${userId}`).catch(err => {
                    console.warn("Failed to load incomes for recurring modal:", err);
                    incsFailed = true;
                    return null;
                })),
            (allSavingsGoals && allSavingsGoals.length > 0)
                ? Promise.resolve(allSavingsGoals)
                : (isFileOrOffline ? Promise.resolve([]) : apiRequest(`/savings/goals/user/${userId}`).catch(err => {
                    console.warn("Failed to load savings goals for recurring modal:", err);
                    savsFailed = true;
                    return null;
                }))
        ]);

        isSubsOffline = (subsFailed && incsFailed && savsFailed) || (subs === null && incs === null && savs === null);

        if (isSubsOffline) {
            const summaryEl = document.getElementById("subsCashflowSummary");
            if (summaryEl) {
                summaryEl.innerHTML = `
                    <div class="u-inl-230f454">
                        <div class="u-inl-b1b7d76">Recurring Inflows</div>
                        <div class="u-inl-687c003">Offline</div>
                    </div>
                    <div class="u-inl-230f454">
                        <div class="u-inl-b1b7d76">Recurring Subscriptions</div>
                        <div class="u-inl-687c003">Offline</div>
                    </div>
                    <div class="u-inl-230f454">
                        <div class="u-inl-b1b7d76">Chits & Recurring Savings</div>
                        <div class="u-inl-687c003">Offline</div>
                    </div>
                    <div class="u-inl-230f454">
                        <div class="u-inl-b1b7d76">Net Autonomy Flow</div>
                        <div class="u-inl-687c003">Offline</div>
                    </div>
                `;
            }
            renderSubsModalContent();
            return;
        }

        cachedSubsExpenses = Array.isArray(subs) ? subs : [];
        cachedSubsIncomes = (Array.isArray(incs) ? incs : []).filter(i => !!(i.isRecurring || i.recurring));
        cachedSubsSavings = (Array.isArray(savs) ? savs : []).filter(s => !!(s.isRecurring || (s.recurringAmount != null && Number(s.recurringAmount) > 0)));

        const monthlyOutflow = cachedSubsExpenses.reduce((acc, sub) => {
            const amt = Number(sub.amount || 0);
            const freq = (sub.frequency || "MONTHLY").toUpperCase();
            if (freq === "WEEKLY") return acc + (amt * 52 / 12);
            if (freq === "DAILY") return acc + (amt * 365 / 12);
            return acc + amt;
        }, 0);

        const monthlyInflow = cachedSubsIncomes.reduce((acc, inc) => {
            const amt = Number(inc.amount || 0);
            const freq = (inc.frequency || "MONTHLY").toUpperCase();
            if (freq === "WEEKLY") return acc + (amt * 52 / 12);
            if (freq === "DAILY") return acc + (amt * 365 / 12);
            return acc + amt;
        }, 0);

        const monthlySavings = cachedSubsSavings.reduce((acc, sav) => {
            const amt = Number(sav.recurringAmount || 0);
            const freq = (sav.frequency || "MONTHLY").toUpperCase();
            if (freq === "WEEKLY") return acc + (amt * 52 / 12);
            if (freq === "DAILY") return acc + (amt * 365 / 12);
            if (freq === "BI_WEEKLY" || freq === "BIWEEKLY") return acc + (amt * 26 / 12);
            if (freq === "YEARLY") return acc + (amt / 12);
            if (freq === "CUSTOM" && sav.intervalDays && sav.intervalDays > 0) return acc + (amt * 30 / sav.intervalDays);
            return acc + amt;
        }, 0);

        const netRecurring = monthlyInflow - (monthlyOutflow + monthlySavings);

        const summaryEl = document.getElementById("subsCashflowSummary");
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="u-inl-230f454">
                    <div class="u-inl-b1b7d76">Recurring Inflows</div>
                    <div class="u-inl-0584dc1">+${formatCurrency(monthlyInflow)}<span class="u-inl-8ef8fb1">/mo</span></div>
                </div>
                <div class="u-inl-230f454">
                    <div class="u-inl-b1b7d76">Recurring Subscriptions</div>
                    <div class="u-inl-993f394">-${formatCurrency(monthlyOutflow)}<span class="u-inl-8ef8fb1">/mo</span></div>
                </div>
                <div class="u-inl-230f454">
                    <div class="u-inl-b1b7d76">Chits & Recurring Savings</div>
                    <div class="u-inl-feefb85">${formatCurrency(monthlySavings)}<span class="u-inl-8ef8fb1">/mo</span></div>
                </div>
                <div class="u-inl-230f454">
                    <div class="u-inl-b1b7d76">Net Autonomy Flow</div>
                    <div style="font-size:14.5px; font-weight:700; color:${netRecurring >= 0 ? '#10B981' : 'var(--danger)'}; margin-top:2px; font-family:var(--font-mono); font-variant-numeric:tabular-nums;">${netRecurring >= 0 ? '+' : ''}${formatCurrency(netRecurring)}<span class="u-inl-8ef8fb1">/mo</span></div>
                </div>
            `;
        }

        renderSubsModalContent();

    } catch (error) {
        isSubsOffline = true;
        const summaryEl = document.getElementById("subsCashflowSummary");
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="u-inl-230f454">
                    <div class="u-inl-b1b7d76">Recurring Inflows</div>
                    <div class="u-inl-687c003">Offline</div>
                </div>
                <div class="u-inl-230f454">
                    <div class="u-inl-b1b7d76">Recurring Subscriptions</div>
                    <div class="u-inl-687c003">Offline</div>
                </div>
                <div class="u-inl-230f454">
                    <div class="u-inl-b1b7d76">Chits & Recurring Savings</div>
                    <div class="u-inl-687c003">Offline</div>
                </div>
                <div class="u-inl-230f454">
                    <div class="u-inl-b1b7d76">Net Autonomy Flow</div>
                    <div class="u-inl-687c003">Offline</div>
                </div>
            `;
        }
        renderSubsModalContent();
    }
}

let cachedSubsSavings = [];
function switchSubsModalTab(tab) {
    currentSubsModalTab = tab;
    const expBtn = document.getElementById("subsTabExpensesBtn");
    const incBtn = document.getElementById("subsTabIncomesBtn");
    const savBtn = document.getElementById("subsTabSavingsBtn");
    if (expBtn) expBtn.classList.toggle("active", tab === 'expenses');
    if (incBtn) {
        incBtn.classList.toggle("active", tab === 'incomes');
        if (tab === 'incomes') incBtn.classList.add("emerald");
        else incBtn.classList.remove("emerald");
    }
    if (savBtn) savBtn.classList.toggle("active", tab === 'savings');
    renderSubsModalContent();
}
window.switchSubsModalTab = switchSubsModalTab;
document.getElementById("subsTabExpensesBtn")?.addEventListener("click", () => switchSubsModalTab("expenses"));
document.getElementById("subsTabIncomesBtn")?.addEventListener("click", () => switchSubsModalTab("incomes"));
document.getElementById("subsTabSavingsBtn")?.addEventListener("click", () => switchSubsModalTab("savings"));

function renderSubsModalContent() {
    if (!elements.subsList) return;

    if (isSubsOffline) {
        elements.subsList.innerHTML = `
            <div class="empty-state connection-error u-inl-c0f9ec1">
                <div class="empty-state-icon u-inl-b1aba35">⚠️</div>
                <div class="empty-state-title u-inl-1e985a6">Server Connection Failed</div>
                <div class="empty-state-sub u-inl-b7c2ff7">
                    Could not reach the server to load your subscriptions and recurring cash flow.
                </div>
                <button type="button" class="btn-primary btn-sm u-inl-611b0bb" onclick="loadSubscriptions()">
                    Retry Connection
                </button>
            </div>`;
        return;
    }

    if (currentSubsModalTab === 'expenses') {
        if (!cachedSubsExpenses || cachedSubsExpenses.length === 0) {
            elements.subsList.innerHTML = `
                <div class="empty-state-compact u-inl-e9107a3">
                    <p class="u-inl-67e1f85">No active subscription expenses found</p>
                    <span class="u-inl-6b9c179">Mark expenses as <strong>Recurring</strong> to monitor renewals, software SaaS, and recurring bills.</span>
                </div>`;
            return;
        }

        elements.subsList.innerHTML = cachedSubsExpenses.map(sub => {
            const freqLabel = formatFrequency(sub);
            const freqColor = 'var(--text-muted)';
            return `
            <div class="sub-row u-inl-2b26421" onmouseenter="this.style.background='var(--input-bg)'" onmouseleave="this.style.background='var(--card-bg)'">
                <div class="u-inl-bbf7159">
                    <div class="u-inl-04b71f5">${escapeHtml(sub.description)}</div>
                    <div class="u-inl-9c38d4f">
                        <span>Next: <span class="u-inl-fa163ce">${formatDate(sub.nextDueDate)}</span></span>
                        <span class="u-inl-73148a9">•</span>
                        <span class="u-inl-a461f72">${formatCurrency(sub.amount)}</span>
                        <span class="u-inl-73148a9">•</span>
                        <span style="background:rgba(var(--ink-rgb),0.06); color:${freqColor}; border:1px solid var(--border); font-size:10px; font-weight:700; padding:2px 8px; border-radius:999px; letter-spacing:0.04em; text-transform:uppercase;">${freqLabel}</span>
                        <span class="u-inl-bbb3047">${escapeHtml(sub.categoryName || 'General')}</span>
                    </div>
                </div>
                <div class="u-inl-57dc66d">
                    <button onclick="openEditSubscription(${sub.id}, '${jsAttrEscape(sub.description)}', '${sub.amount}', '${sub.nextDueDate}', '${sub.frequency || 'MONTHLY'}', ${sub.intervalDays || 1}, ${sub.categoryId || 'null'})" class="btn-edit u-inl-5f43050" title="Edit Subscription">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button onclick="cancelSubscription(${sub.id}, event)" class="btn-delete u-inl-5f43050" title="Cancel Subscription">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>`;
        }).join("");

    } else if (currentSubsModalTab === 'savings') {
        if (!cachedSubsSavings || cachedSubsSavings.length === 0) {
            elements.subsList.innerHTML = `
                <div class="empty-state-compact u-inl-e9107a3">
                    <p class="u-inl-67e1f85">No recurring chit funds or savings plans</p>
                    <span class="u-inl-6b9c179">Create a savings goal and check <strong>Recurring Contribution (Chit Fund / RD / SIP)</strong> to schedule automated contributions.</span>
                </div>`;
            return;
        }

        elements.subsList.innerHTML = cachedSubsSavings.map(goal => {
            const current = Number(goal.currentAmount || 0);
            const target = Number(goal.targetAmount || 0);
            const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
            return `
            <div class="sub-row u-inl-2b26421" onmouseenter="this.style.background='var(--input-bg)'" onmouseleave="this.style.background='var(--card-bg)'">
                <div class="u-inl-aba4cfe">
                    <div class="u-inl-c4309a2">
                        🪙
                    </div>
                    <div class="u-inl-bbf7159">
                        <div class="u-inl-04b71f5">
                            ${escapeHtml(goal.name || "Chit / Savings Goal")}
                        </div>
                        <div class="u-inl-b37a470">
                            <span>Installment: <span class="u-inl-cb4d3b7">${formatCurrency(goal.recurringAmount || 0)}</span></span>
                            <span class="u-inl-73148a9">•</span>
                            <span class="u-inl-7220e77">
                                🔁 ${escapeHtml(formatGoalFrequency(goal.frequency, goal.intervalDays))}
                            </span>
                            ${goal.nextDueDate ? `<span class="u-inl-73148a9">•</span><span>Next: <strong class="u-inl-2129d3e">${formatDate(goal.nextDueDate)}</strong></span>` : ''}
                        </div>
                        <div class="u-inl-958a6bb">
                            Accumulated ${formatCurrency(current)} of ${formatCurrency(target)} (${pct}%)
                        </div>
                    </div>
                </div>
                <div class="u-inl-57dc66d">
                    <button onclick="closeModal(elements.subsModal); document.getElementById('depositGoalId').value = '${goal.id}'; const dt = document.getElementById('savingsDepositTitle'); if(dt) dt.textContent='Contribute to ${jsAttrEscape(goal.name)}'; openModal(document.getElementById('savingsDepositModal'));" class="btn-primary btn-small u-inl-f504ae6" title="Contribute Installment">
                        + Deposit
                    </button>
                </div>
            </div>`;
        }).join("");

    } else {
        // 'incomes' tab
        if (!cachedSubsIncomes || cachedSubsIncomes.length === 0) {
            elements.subsList.innerHTML = `
                <div class="empty-state-compact u-inl-e9107a3">
                    <p class="u-inl-67e1f85">No recurring income streams found</p>
                    <span class="u-inl-6b9c179">Mark salary, client retainers, or rental payments as <strong>Recurring</strong> in the Cash Inflow section to view them here.</span>
                </div>`;
            return;
        }

        elements.subsList.innerHTML = cachedSubsIncomes.map(inc => {
            const freqLabel = formatIncomeFrequency(inc.frequency, inc.intervalDays);
            return `
            <div class="sub-row u-inl-2b26421" onmouseenter="this.style.background='var(--input-bg)'" onmouseleave="this.style.background='var(--card-bg)'">
                <div class="u-inl-aba4cfe">
                    <div class="u-inl-ff985cd">
                        ${getIncomeSourceEmoji(inc.source)}
                    </div>
                    <div class="u-inl-bbf7159">
                        <div class="u-inl-04b71f5">
                            ${escapeHtml(inc.source || "Income")}
                            ${inc.description ? `<span class="u-inl-8c6fc54">— ${escapeHtml(inc.description)}</span>` : ''}
                        </div>
                        <div class="u-inl-9c38d4f">
                            <span>Logged: <span class="u-inl-6153008">${inc.incomeDate || '—'}</span></span>
                            <span class="u-inl-73148a9">•</span>
                            <span class="u-inl-da756c9">+${formatCurrency(inc.amount)}</span>
                            <span class="u-inl-73148a9">•</span>
                            <span class="u-inl-3fd16cd">
                                ⟳ ${freqLabel}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="u-inl-57dc66d">
                    <button onclick="editIncomeFromSubsModal(${inc.id})" class="btn-edit u-inl-5f43050" title="Edit Recurring Income">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button onclick="deleteIncomeFromSubsModal(${inc.id})" class="btn-delete u-inl-5f43050" title="Delete Income">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>`;
        }).join("");
    }
}

window.editIncomeFromSubsModal = (incId) => {
    closeModal(elements.subsModal);
    const inc = (allIncomes || []).find(i => String(i.id) === String(incId));
    if (!inc) return;
    const modal = document.getElementById("incomeModal");
    if (!modal) return;
    document.getElementById("incomeId").value = inc.id || "";
    document.getElementById("incomeSource").value = inc.source || "";
    document.getElementById("incomeAmount").value = inc.amount || "";
    document.getElementById("incomeDate").value = inc.incomeDate || new Date().toISOString().split("T")[0];
    document.getElementById("incomeDesc").value = inc.description || "";
    setIncomeClassification(inc.kind, inc.countsTowardMonth, inc.reimbursedCategoryId);

    const isRec = !!(inc.isRecurring || inc.recurring);
    const incRecEl = document.getElementById("incomeIsRecurring");
    if (incRecEl) incRecEl.checked = isRec;

    const freq = inc.frequency || "MONTHLY";
    const interval = inc.intervalDays || 1;
    const incFreqEl = document.getElementById("incomeRecurringFrequency");
    if (incFreqEl) incFreqEl.value = freq;
    const incIntervalEl = document.getElementById("incomeRecurringIntervalDays");
    if (incIntervalEl) incIntervalEl.value = interval;

    const incRecOptions = document.getElementById("incomeRecurringOptions");
    if (incRecOptions) {
        incRecOptions.hidden = !isRec;
        incRecOptions.style.display = isRec ? "flex" : "none";
    }
    const titleEl = document.getElementById("incomeModalTitle");
    if (titleEl) titleEl.textContent = "Edit Income Stream";
    openModal(modal);
};

window.deleteIncomeFromSubsModal = async (incId) => {
    if (!(await window.appConfirm("Are you sure you want to delete this recurring income stream?"))) return;
    try {
        setLoading(true, "Deleting income...");
        await apiRequest(`/incomes/${incId}/user/${userId}`, { method: "DELETE" });
        showToast("Income record deleted.", "success");
        await loadDashboard(true);
        loadSubscriptions();
    } catch (err) {
        showToast(err.message || "Failed to delete income", "error");
    } finally {
        setLoading(false);
    }
};

const editSubModal = document.getElementById("editSubModal");
const editSubForm = document.getElementById("editSubForm");

window.openEditSubscription = (id, desc, amount, nextDueDate, frequency = 'MONTHLY', intervalDays = 1, categoryId = null) => {
    const editSubCatSelect = document.getElementById("editSubCategory");
    if (editSubCatSelect && allCategories && allCategories.length > 0) {
        editSubCatSelect.innerHTML = allCategories.map(c => `<option value="${c.id}"${categoryId && String(c.id) === String(categoryId) ? ' selected' : ''}>${escapeHtml(c.name)}</option>`).join("");
        if (categoryId) editSubCatSelect.value = categoryId;
        if (window.syncCustomSelect) window.syncCustomSelect(editSubCatSelect);
    }
    document.getElementById("editSubId").value = id;
    document.getElementById("editSubDesc").value = desc.trim();
    document.getElementById("editSubAmount").value = amount;
    document.getElementById("editSubNextDate").value = nextDueDate;
    const freqSelect = document.getElementById("editSubFrequency");
    if (freqSelect) freqSelect.value = frequency;
    const intervalInput = document.getElementById("editSubIntervalDays");
    if (intervalInput) intervalInput.value = intervalDays || 1;
    const intervalWrap = document.getElementById("editSubCustomIntervalWrap") || document.getElementById("editSubIntervalWrap");
    if (intervalWrap) intervalWrap.hidden = frequency !== "CUSTOM";
    openModal(editSubModal);
};

// Toggle custom interval field inside edit subscription form
document.getElementById("editSubFrequency")?.addEventListener("change", (e) => {
    const wrap = document.getElementById("editSubCustomIntervalWrap") || document.getElementById("editSubIntervalWrap");
    if (wrap) wrap.hidden = e.target.value !== "CUSTOM";
});

document.getElementById("closeEditSubModalBtn")?.addEventListener("click", () => {
    closeModal(editSubModal);
});
editSubModal?.addEventListener("click", (e) => {
    if (e.target === editSubModal) closeModal(editSubModal);
});

editSubForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = editSubForm.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return; // a submission is already in flight

    const id = document.getElementById("editSubId").value;
    const desc = document.getElementById("editSubDesc").value;
    const amount = parseFloat(document.getElementById("editSubAmount").value);
    const nextDueDate = document.getElementById("editSubNextDate").value;
    const frequency = document.getElementById("editSubFrequency")?.value || "MONTHLY";
    const intervalDaysRaw = parseInt(document.getElementById("editSubIntervalDays")?.value || "1");

    if (isNaN(amount) || amount <= 0) return showToast("Amount must be greater than 0", "error");
    if (frequency === "CUSTOM" && (isNaN(intervalDaysRaw) || intervalDaysRaw < 1)) {
        return showToast("Custom interval must be at least 1 day", "error");
    }

    const categoryId = document.getElementById("editSubCategory")?.value;
    const body = { description: desc, amount, nextDueDate, frequency };
    if (categoryId) body.categoryId = parseInt(categoryId);
    if (frequency === "CUSTOM") body.intervalDays = intervalDaysRaw;

    submitBtn.disabled = true;
    try {
        await apiRequest(`/expenses/recurring/${id}`, {
            method: "PUT",
            body: JSON.stringify(body)
        });
        showToast("Subscription updated successfully.", "success");
        closeModal(editSubModal);
        loadSubscriptions();
    } catch (e) {
        showToast(e.message, "error");
    } finally {
        submitBtn.disabled = false;
    }
});

// Cancel Logic
window.cancelSubscription = async (id, event) => {
    if (!(await window.appConfirm("Are you sure you want to cancel this recurring subscription? Future auto-payments will stop."))) return;

    try {
        await apiRequest(`/expenses/recurring/${id}`, { method: "DELETE" });
        showToast("Subscription cancelled.", "success");
        loadSubscriptions();
    } catch (err) {
        showToast(err.message, "error");
        const btn = event?.target?.closest(".btn-delete");
        if (btn) {
            btn.classList.add("shake");
            setTimeout(() => btn.classList.remove("shake"), 400);
        }
    }
};

// --- 8. DELETE ACCOUNT ---

function checkDeleteBtnState() {
    const isTextValid = elements.deleteConfirmInput && elements.deleteConfirmInput.value.trim() === "DELETE";
    const isPassValid = !elements.deletePasswordInput || elements.deletePasswordInput.value.length > 0;
    const isValid = isTextValid && isPassValid;
    elements.confirmDeleteAccountBtn.style.opacity = isValid ? "1" : "0.5";
    elements.confirmDeleteAccountBtn.style.pointerEvents = isValid ? "auto" : "none";
}

// Open the delete account confirmation modal
elements.deleteAccountBtn.addEventListener("click", (e) => {
    e.preventDefault();
    toggleProfileMenu(false);
    if (elements.deletePasswordInput) elements.deletePasswordInput.value = "";
    elements.deleteConfirmInput.value = "";
    elements.confirmDeleteAccountBtn.style.opacity = "0.5";
    elements.confirmDeleteAccountBtn.style.pointerEvents = "none";
    openModal(elements.deleteAccountModal);
    setTimeout(() => {
        if (elements.deletePasswordInput) {
            elements.deletePasswordInput.focus();
        } else {
            elements.deleteConfirmInput.focus();
        }
    }, 150);
});

// Enable the confirm button only when user enters password and types "DELETE"
elements.deleteConfirmInput.addEventListener("input", checkDeleteBtnState);
if (elements.deletePasswordInput) {
    elements.deletePasswordInput.addEventListener("input", checkDeleteBtnState);
}

// Close modal on cancel
elements.cancelDeleteAccountBtn.addEventListener("click", () => {
    closeModal(elements.deleteAccountModal);
    if (elements.deletePasswordInput) elements.deletePasswordInput.value = "";
    elements.deleteConfirmInput.value = "";
});

// --- EDIT PROFILE NAME ---
const editProfileBtn = document.getElementById("editProfileBtn");
const editProfileModal = document.getElementById("editProfileModal");
const closeEditProfileModalBtn = document.getElementById("closeEditProfileModalBtn");
const cancelEditProfileBtn = document.getElementById("cancelEditProfileBtn");
const editProfileForm = document.getElementById("editProfileForm");
const editProfileNameInput = document.getElementById("editProfileNameInput");

if (editProfileBtn && editProfileModal) {
    editProfileBtn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleProfileMenu(false);
        const currentName = localStorage.getItem("userName") || "";
        if (editProfileNameInput) {
            editProfileNameInput.value = currentName;
        }
        openModal(editProfileModal);
        setTimeout(() => editProfileNameInput?.focus(), 50);
    });

    const closeEditModal = () => closeModal(editProfileModal);
    closeEditProfileModalBtn?.addEventListener("click", closeEditModal);
    cancelEditProfileBtn?.addEventListener("click", closeEditModal);
    editProfileModal.addEventListener("click", (e) => {
        if (e.target === editProfileModal) closeEditModal();
    });

    editProfileForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const newName = editProfileNameInput?.value?.trim();
        if (!newName || newName.length < 2 || newName.length > 50) {
            showToast("Display name must be between 2 and 50 characters.", "warning");
            return;
        }
        const saveBtn = document.getElementById("saveEditProfileBtn");
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = "Saving...";
        }
        try {
            const res = await apiRequest(`/users/${userId}`, {
                method: "PUT",
                body: JSON.stringify({ name: newName })
            });
            const updatedName = (res && res.name) ? res.name : newName;
            localStorage.setItem("userName", updatedName);
            const userWelcomeText = document.getElementById("userWelcomeText");
            if (userWelcomeText) {
                userWelcomeText.textContent = `Welcome back, ${updatedName}`;
            }
            renderDashboardAvatar(updatedName, localStorage.getItem("userProfilePicture"));
            showToast("Profile name updated successfully!", "success");
            closeEditModal();
        } catch (err) {
            showToast(err.message || "Failed to update profile name.", "error");
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = "Save Changes";
            }
        }
    });
}

// Close modal on overlay click
elements.deleteAccountModal.addEventListener("click", (e) => {
    if (e.target === elements.deleteAccountModal) {
        closeModal(elements.deleteAccountModal);
        if (elements.deletePasswordInput) elements.deletePasswordInput.value = "";
        elements.deleteConfirmInput.value = "";
    }
});

// Confirm deletion — calls DELETE /api/users/{userId} with password confirmation
elements.confirmDeleteAccountBtn.addEventListener("click", async () => {
    const password = elements.deletePasswordInput ? elements.deletePasswordInput.value : "";
    if (!password) {
        showToast("Please enter your current password to confirm deletion.", "warning");
        elements.deletePasswordInput?.focus();
        return;
    }
    if (elements.deleteConfirmInput.value.trim() !== "DELETE") return;

    elements.confirmDeleteAccountBtn.classList.add("btn-loading");
    elements.confirmDeleteAccountBtn.style.pointerEvents = "none";

    try {
        await apiRequest(`/users/${userId}`, {
            method: "DELETE",
            body: JSON.stringify({ password: password }),
            skipAuthRedirect: true
        });
        localStorage.clear();
        window.location.href = "index.html";
    } catch (err) {
        showToast(err.message, "error");
        elements.confirmDeleteAccountBtn.classList.remove("btn-loading");
        elements.confirmDeleteAccountBtn.style.opacity = "1";
        elements.confirmDeleteAccountBtn.style.pointerEvents = "auto";
        if (elements.deletePasswordInput) {
            elements.deletePasswordInput.value = "";
            elements.deletePasswordInput.focus();
        }
    }
});

// Start
// Initial loadDashboard() deferred until all dashboard sub-modules register

function formatFrequency(subscription) {
    return subscription.frequency === "CUSTOM"
        ? `Every ${subscription.intervalDays} day${subscription.intervalDays === 1 ? "" : "s"}`
        : (subscription.frequency || "MONTHLY").toLowerCase().replace(/^./, char => char.toUpperCase());
}

// --- RIPPLE EFFECT on primary / submit buttons ---
document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-primary, button[type='submit']");
    if (!btn) return;
    const ripple = document.createElement("span");
    ripple.className = "btn-ripple";
    const rect = btn.getBoundingClientRect();
    ripple.style.left = (e.clientX - rect.left - 4) + "px";
    ripple.style.top  = (e.clientY - rect.top  - 4) + "px";
    btn.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
});


// =========================================================================
// EXECUTIVE CASH FLOW & INFLOW / SAVINGS GOVERNANCE
// =========================================================================
