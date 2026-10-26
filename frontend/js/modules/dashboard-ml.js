/* ==========================================================================
   DASHBOARD ML & AI INTELLIGENCE MODULE (Full 5-Model Production Suite)
   ==========================================================================
   Provides client-side machine learning integration and interactive UI for
   all 5 ML models:
   1. Category Classification (Dual-Gram TF-IDF Classifier)
   2. Merchant Vector Similarity Matcher
   3. Duplicate Transaction Semantic Similarity Engine
   4. Isolation Forest Outlier / Anomaly Scoring
   5. Time-Series Forward Spending Forecast
   ========================================================================== */

(function () {
    "use strict";

    function escapeHtml(value) {
        if (value == null) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Helper to produce or lookup SVG icon for category
    function getCategorySvg(nameOrId, size = 16) {
        if (window.DashboardUtils && typeof window.DashboardUtils.getCategorySvg === "function") {
            return window.DashboardUtils.getCategorySvg(nameOrId, size);
        }
        if (typeof window.getCategorySvg === "function") {
            return window.getCategorySvg(nameOrId, size);
        }
        const svgAttrs = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; flex-shrink:0;"`;
        return `<svg ${svgAttrs}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`;
    }

    function getCategoryIcon(itemOrName, size = 16) {
        if (!itemOrName) return getCategorySvg("general", size);
        if (typeof itemOrName === "object") {
            if (typeof itemOrName.svg === "function") {
                return itemOrName.svg(size);
            }
            if (typeof itemOrName.svg === "string") {
                return itemOrName.svg;
            }
            return getCategorySvg(itemOrName.name || itemOrName.id, size);
        }
        return getCategorySvg(itemOrName, size);
    }

    // Clean raw merchant text returned by embedding matcher if it contains prompt prefixes
    function cleanMerchantName(raw) {
        if (!raw) return "";
        let str = String(raw).trim();
        str = str.replace(/^(?:parse this banking sms and extract entities|extract financial entities from this message|identify transaction details in this message)\s*/i, "");
        str = str.replace(/\b(?:hdfc|sbi|icici|axis|xx|rs|inr|vpa|upi|ref|ac|a\/c|ybl|okaxis)\b/gi, " ");
        str = str.replace(/\s+/g, " ").trim();
        const words = str.split(" ").filter(w => w.length > 1).slice(0, 3);
        const cleaned = words.join(" ");
        if (!cleaned) return String(raw).slice(0, 24);
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    // 1. CANONICAL TAXONOMY DEFINITIONS
    const CANONICAL_TAXONOMY = [
        {
            id: "food_dining",
            name: "Food & Dining",
            svg: (size = 16) => getCategorySvg("food", size),
            aliases: ["food", "dining", "groceries", "grocery", "restaurant", "restaurants", "cafe", "coffee", "snacks", "lunch", "dinner", "breakfast", "swiggy", "zomato", "eats"]
        },
        {
            id: "transportation",
            name: "Transportation",
            svg: (size = 16) => getCategorySvg("transport", size),
            aliases: ["transport", "transportation", "travel", "fuel", "gas", "petrol", "diesel", "cab", "taxi", "uber", "ola", "metro", "flight", "commute", "bus", "train", "parking", "toll"]
        },
        {
            id: "shopping_retail",
            name: "Shopping & Retail",
            svg: (size = 16) => getCategorySvg("shop", size),
            aliases: ["shopping", "retail", "clothing", "apparel", "electronics", "amazon", "flipkart", "store", "fashion", "shoes", "mall", "supermarket", "purchase"]
        },
        {
            id: "entertainment_recreation",
            name: "Entertainment & Recreation",
            svg: (size = 16) => getCategorySvg("entertain", size),
            aliases: ["entertainment", "recreation", "movies", "cinema", "netflix", "spotify", "prime", "games", "gaming", "outing", "hobby", "concert", "theatre", "disney", "youtube"]
        },
        {
            id: "healthcare_medical",
            name: "Healthcare & Medical",
            svg: (size = 16) => getCategorySvg("health", size),
            aliases: ["health", "healthcare", "medical", "pharmacy", "medicine", "doctor", "hospital", "dental", "clinic", "fitness", "gym", "meds", "apollo", "prescription"]
        },
        {
            id: "utilities_services",
            name: "Utilities & Services",
            svg: (size = 16) => getCategorySvg("utilities", size),
            aliases: ["utilities", "utility", "services", "bills", "electricity", "water", "internet", "wifi", "broadband", "recharge", "phone", "mobile", "gas bill", "rent", "maintenance", "power"]
        },
        {
            id: "financial_services",
            name: "Financial Services",
            svg: (size = 16) => getCategorySvg("finance", size),
            aliases: ["finance", "financial", "investment", "investments", "banking", "bank", "insurance", "taxes", "tax", "loan", "emi", "interest", "brokerage", "crypto", "mutual fund", "sip", "card"]
        },
        {
            id: "income",
            name: "Income",
            svg: (size = 16) => getCategorySvg("income", size),
            aliases: ["income", "salary", "wages", "bonus", "dividend", "interest income", "stipend", "freelance", "payout", "deposit"]
        },
        {
            id: "government_legal",
            name: "Government & Legal",
            svg: (size = 16) => getCategorySvg("government", size),
            aliases: ["government", "legal", "court", "license", "passport", "fine", "penalty", "stamp", "registration", "challan", "fees"]
        },
        {
            id: "charity_donations",
            name: "Charity & Donations",
            svg: (size = 16) => getCategorySvg("charity", size),
            aliases: ["charity", "donation", "donations", "ngo", "aid", "relief", "gift", "giving", "contribution"]
        }
    ];

    const CANONICAL_IDS = new Set(CANONICAL_TAXONOMY.map(t => t.id));

    function resolveToCanonical(categoryName) {
        if (!categoryName) return "food_dining";
        const clean = String(categoryName).toLowerCase().trim();
        if (CANONICAL_IDS.has(clean)) return clean;

        for (const item of CANONICAL_TAXONOMY) {
            if (item.name.toLowerCase() === clean) return item.id;
            for (const alias of item.aliases) {
                if (clean === alias || clean.includes(alias) || alias.includes(clean)) {
                    return item.id;
                }
            }
        }
        return "utilities_services";
    }

    function getTaxonomyItem(canonicalId) {
        if (!canonicalId) {
            return {
                id: "unknown",
                name: "General Expense",
                svg: (size = 16) => getCategorySvg("general", size),
                aliases: []
            };
        }
        const clean = String(canonicalId).toLowerCase().trim();
        const found = CANONICAL_TAXONOMY.find(t => t.id === clean || t.name.toLowerCase() === clean);
        if (found) return found;

        return {
            id: clean,
            name: clean.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
            svg: (size = 16) => getCategorySvg(clean, size),
            aliases: []
        };
    }

    function findMatchingOption(canonicalId, selectEl) {
        if (!selectEl || !selectEl.options) return null;
        const targetItem = getTaxonomyItem(canonicalId);
        const targetAliases = [targetItem.id, targetItem.name.toLowerCase(), ...targetItem.aliases];

        let bestOption = null;
        let bestScore = -1;

        for (let i = 0; i < selectEl.options.length; i++) {
            const opt = selectEl.options[i];
            if (!opt.value || opt.disabled) continue;
            const optText = opt.text.toLowerCase().trim();

            if (optText === targetItem.name.toLowerCase() || optText === targetItem.id) {
                return opt;
            }

            for (const alias of targetAliases) {
                if (optText === alias) {
                    return opt;
                }
                if ((optText.includes(alias) || alias.includes(optText)) && alias.length > bestScore) {
                    bestOption = opt;
                    bestScore = alias.length;
                }
            }
        }

        return bestOption;
    }

    // 2. ACTIVE PREDICTION SESSION STATE
    let activeSession = {
        lastPrediction: null,
        userOverridden: false,
        debounceTimer: null,
        merchantDebounceTimer: null,
        lastClassifiedText: "",
        lastMerchantText: ""
    };

    function resetActiveSession() {
        if (activeSession.debounceTimer) clearTimeout(activeSession.debounceTimer);
        if (activeSession.merchantDebounceTimer) clearTimeout(activeSession.merchantDebounceTimer);
        activeSession.lastPrediction = null;
        activeSession.lastClassifiedText = "";
        activeSession.lastMerchantText = "";
        activeSession.userOverridden = false;

        const box = document.getElementById("aiSuggestionBox");
        if (box) box.style.display = "none";
        const autoNotice = document.getElementById("aiAutoAppliedNotice");
        if (autoNotice) autoNotice.style.display = "none";
        const spinner = document.getElementById("descAiLoading");
        if (spinner) spinner.style.display = "none";
        const dupBox = document.getElementById("duplicateWarningBox");
        if (dupBox) dupBox.style.display = "none";
        const merchantContainer = document.getElementById("mlMerchantSuggestions");
        if (merchantContainer) merchantContainer.style.display = "none";
    }

    // 3. FULL 5-MODEL API CLIENT METHODS
    // Model 1: Category Classification
    async function classifyDescription(text, topN = 3) {
        if (!text || text.trim().length < 2) return null;
        try {
            return await window.apiRequest("/ml/classify", {
                method: "POST",
                body: JSON.stringify({ description: text.trim(), top_n: topN }),
                showLoading: false
            });
        } catch (err) {
            console.warn("[DashboardML] ML classify bypassed:", err.message);
            return null;
        }
    }

    // Model 2: Merchant Vector Similarity Matcher
    async function matchMerchant(query, topK = 5) {
        if (!query || query.trim().length < 2) return null;
        try {
            return await window.apiRequest("/ml/merchants/match", {
                method: "POST",
                body: JSON.stringify({ query: query.trim(), top_k: topK }),
                showLoading: false
            });
        } catch (err) {
            console.warn("[DashboardML] Merchant match bypassed:", err.message);
            return null;
        }
    }

    // Model 3: Duplicate Transaction Vector Similarity
    async function checkDuplicatesWithML(query, candidates, threshold = 0.70, topK = 5) {
        if (!query || !Array.isArray(candidates) || candidates.length === 0) return null;
        try {
            return await window.apiRequest("/ml/duplicates/check", {
                method: "POST",
                body: JSON.stringify({
                    query: query.trim(),
                    candidates: candidates.map(c => String(c).trim()),
                    threshold: threshold,
                    top_k: topK
                }),
                showLoading: false
            });
        } catch (err) {
            console.warn("[DashboardML] ML duplicate check bypassed:", err.message);
            return null;
        }
    }

    // Model 4: Transaction Anomaly Scoring (Isolation Forest / Outlier)
    async function scoreAnomalies(transactions) {
        if (!Array.isArray(transactions) || transactions.length === 0) return null;
        try {
            return await window.apiRequest("/ml/anomalies/score", {
                method: "POST",
                body: JSON.stringify({ transactions: transactions }),
                showLoading: false
            });
        } catch (err) {
            console.warn("[DashboardML] Anomaly score bypassed:", err.message);
            return null;
        }
    }

    // Model 5: Spending Forecast (Forward Time-Series Projection)
    async function forecastSpending(history, horizonDays = 7) {
        if (!Array.isArray(history) || history.length === 0) return null;
        try {
            // ML service requires at least 28 daily entries. Pad synthetic daily entries if user history is short.
            let effectiveHistory = [...history];
            if (effectiveHistory.length < 28) {
                const earliestDate = new Date(effectiveHistory[0]?.date || Date.now());
                const needed = 28 - effectiveHistory.length;
                const padded = [];
                for (let i = needed; i >= 1; i--) {
                    const padDate = new Date(earliestDate.getTime() - i * 86400000).toISOString().split("T")[0];
                    padded.push({ date: padDate, amount: 0.0 });
                }
                effectiveHistory = [...padded, ...effectiveHistory];
            }

            return await window.apiRequest("/ml/forecast/spending", {
                method: "POST",
                body: JSON.stringify({
                    history: effectiveHistory,
                    horizon_days: horizonDays
                }),
                showLoading: false
            });
        } catch (err) {
            console.warn("[DashboardML] Spending forecast bypassed:", err.message);
            return null;
        }
    }

    // Health and status of ML engine
    async function getMlHealth() {
        try {
            return await window.apiRequest("/ml/health", { method: "GET", showLoading: false });
        } catch (err) {
            return { status: "offline", error: err.message };
        }
    }

    // Continuous learning feedback
    async function submitFeedbackRecord(arg1, text, predictedCanonical, chosenCanonical, confidence, modelRevision) {
        let payload = null;
        if (typeof arg1 === "object" && arg1 !== null) {
            payload = {
                transactionId: String(arg1.transactionId || arg1.expenseId || Date.now()),
                text: String(arg1.text || arg1.rawDescription || "").trim(),
                predictedCategory: arg1.predictedCategory || arg1.suggestedCategory,
                correctedCategory: arg1.correctedCategory || arg1.userSelectedCategory,
                confidence: Math.min(1.0, Math.max(0.0, Number(arg1.confidence) || 0.95)),
                modelVersion: arg1.modelVersion || arg1.modelRevision || "production"
            };
        } else {
            payload = {
                transactionId: String(arg1 || Date.now()),
                text: String(text || "").trim(),
                predictedCategory: predictedCanonical,
                correctedCategory: chosenCanonical,
                confidence: Math.min(1.0, Math.max(0.0, Number(confidence) || 0.95)),
                modelVersion: modelRevision || "production"
            };
        }
        if (!payload.text || !payload.predictedCategory || !payload.correctedCategory) return;
        try {
            await window.apiRequest("/ml/feedback", {
                method: "POST",
                body: JSON.stringify(payload),
                showLoading: false
            });
        } catch (err) {
            console.warn("[DashboardML] Continuous learning feedback skipped:", err.message);
        }
    }

    async function ensureAndSelectCategory(canonical, selectEl) {
        if (!selectEl) return null;
        let opt = findMatchingOption(canonical, selectEl);
        if (!opt) {
            const item = getTaxonomyItem(canonical);
            const userId = localStorage.getItem("userId");
            if (userId && window.apiRequest) {
                try {
                    const newCat = await window.apiRequest(`/categories/user/${userId}`, {
                        method: "POST",
                        body: JSON.stringify({ name: item.name }),
                        showLoading: false
                    });
                    if (newCat && newCat.id) {
                        const newOpt = document.createElement("option");
                        newOpt.value = newCat.id;
                        newOpt.textContent = newCat.name;
                        selectEl.appendChild(newOpt);
                        if (window.allCategories && Array.isArray(window.allCategories)) {
                            window.allCategories.push(newCat);
                        }
                        opt = newOpt;
                    }
                } catch (e) {
                    console.warn("[DashboardML] Auto-creation of category bypassed:", e.message);
                }
            }
        }
        if (opt) {
            selectEl.value = opt.value;
            if (window.syncCustomSelect) window.syncCustomSelect(selectEl);
            selectEl.classList.add("category-ai-highlight");
            setTimeout(() => selectEl.classList.remove("category-ai-highlight"), 1600);
        }
        return opt;
    }

    // 4. DUPLICATE TRANSACTION DETECTION (Powered by Model 3 Vector Similarity)
    async function checkDuplicateExpense(desc, amount, date) {
        const dupBox = document.getElementById("duplicateWarningBox");
        const dupText = document.getElementById("dupDetailText");
        if (!dupBox || !dupText) return;

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0 || !desc || desc.trim().length < 3) {
            dupBox.style.display = "none";
            return;
        }

        const cleanDesc = desc.trim();
        const currentExpenseId = document.getElementById("expenseId")?.value;
        const expenses = window.cachedExpenses || (window.DashboardUtils && window.DashboardUtils.getSafeExpenses && window.DashboardUtils.getSafeExpenses()) || [];

        // Find candidate expenses with close amounts (+/- $1.50 or within 10%)
        const candidates = expenses.filter(exp => {
            if (currentExpenseId && String(exp.id) === String(currentExpenseId)) return false;
            const expAmt = parseFloat(exp.amount);
            if (isNaN(expAmt)) return false;
            const diff = Math.abs(expAmt - numAmount);
            return diff <= 1.50 || (diff / Math.max(numAmount, 1)) <= 0.10;
        });

        if (candidates.length === 0) {
            dupBox.style.display = "none";
            return;
        }

        // Call Model 3: Vector Similarity check
        const candidateDescriptions = candidates.map(c => c.description || "").filter(Boolean);
        const res = await checkDuplicatesWithML(cleanDesc, candidateDescriptions, 0.70);

        if (res && res.matches && res.matches.length > 0) {
            const bestMatch = res.matches[0];
            const original = candidates[bestMatch.index] || candidates.find(c => c.description === bestMatch.text);
            const simPct = Math.round((bestMatch.similarity || 0) * 100);
            const formattedAmt = window.DashboardUtils?.formatCurrency && original ? window.DashboardUtils.formatCurrency(original.amount) : (original ? `$${original.amount}` : "");
            const formattedDate = original?.expenseDate ? (window.DashboardUtils?.formatDate ? window.DashboardUtils.formatDate(original.expenseDate) : original.expenseDate) : "";

            dupText.innerHTML = `<span style="color:#F59E0B; font-weight:700;">${simPct}% ML Vector Similarity:</span> "${escapeHtml(bestMatch.text)}" ${formattedAmt ? `(${formattedAmt} on ${formattedDate})` : ""} recorded recently.`;
            dupBox.style.display = "flex";
        } else {
            // Fallback substring check
            const subMatch = candidates.find(exp => {
                const expDesc = (exp.description || "").toLowerCase();
                const dLow = cleanDesc.toLowerCase();
                return expDesc === dLow || (dLow.length > 4 && expDesc.includes(dLow));
            });
            if (subMatch) {
                const formattedAmt = window.DashboardUtils?.formatCurrency ? window.DashboardUtils.formatCurrency(subMatch.amount) : `$${subMatch.amount}`;
                dupText.innerHTML = `Similar transaction detected: "<strong>${escapeHtml(subMatch.description)}</strong>" (${formattedAmt}) recorded recently.`;
                dupBox.style.display = "flex";
            } else {
                dupBox.style.display = "none";
            }
        }
    }

    // 5. RENDER REAL-TIME CLASSIFIER PREDICTION UI
    function renderPredictionUI(prediction) {
        const box = document.getElementById("aiSuggestionBox");
        const predName = document.getElementById("aiPredictedCategoryName");
        const confBadge = document.getElementById("aiConfidenceBadge");
        const pillsList = document.getElementById("aiPillsList");
        const altContainer = document.getElementById("aiAlternativePills");
        const autoNotice = document.getElementById("aiAutoAppliedNotice");
        const categorySelect = document.getElementById("categorySelect");

        if (!box || !prediction) {
            if (box) box.style.display = "none";
            return;
        }

        const canonical = prediction.category;
        const item = getTaxonomyItem(canonical);
        const confPct = Math.round((prediction.confidence || 0) * 100);

        if (predName) {
            predName.innerHTML = `<span style="display:inline-flex; align-items:center; gap:6px;">${getCategoryIcon(item, 16)} <span>${escapeHtml(item.name)}</span></span>`;
        }

        if (confBadge) {
            confBadge.textContent = `${confPct}% match`;
            confBadge.className = "ai-conf-badge " + (confPct >= 80 ? "ai-conf-high" : confPct >= 50 ? "ai-conf-mid" : "");
        }

        let appliedAutomatically = false;
        if (!activeSession.userOverridden && confPct >= 65 && categorySelect) {
            const matchingOption = findMatchingOption(canonical, categorySelect);
            if (matchingOption && categorySelect.value !== matchingOption.value) {
                categorySelect.value = matchingOption.value;
                if (window.syncCustomSelect) window.syncCustomSelect(categorySelect);

                categorySelect.classList.add("category-ai-highlight");
                setTimeout(() => categorySelect.classList.remove("category-ai-highlight"), 1600);
                appliedAutomatically = true;
            }
        }

        if (autoNotice) {
            autoNotice.style.display = appliedAutomatically ? "flex" : "none";
        }

        // Alternative suggestions pills
        if (pillsList && altContainer) {
            const rawTopK = Array.isArray(prediction.topK)
                ? prediction.topK
                : (Array.isArray(prediction.top_k) ? prediction.top_k : []);
            const alternatives = rawTopK.filter(k => k.category !== canonical).slice(0, 3);

            if (alternatives.length > 0) {
                pillsList.innerHTML = alternatives.map(alt => {
                    const altItem = getTaxonomyItem(alt.category);
                    const altConf = Math.round((alt.confidence || 0) * 100);
                    return `<button type="button" class="ai-pill-chip" data-canonical="${escapeHtml(alt.category)}" style="display:inline-flex; align-items:center; gap:5px;">
                        ${getCategoryIcon(altItem, 13)} <span>${escapeHtml(altItem.name)}</span> <span style="opacity:0.75; font-size:10px;">${altConf}%</span>
                    </button>`;
                }).join("");

                pillsList.querySelectorAll(".ai-pill-chip").forEach(btn => {
                    btn.addEventListener("click", async () => {
                        const targetCanonical = btn.getAttribute("data-canonical");
                        if (categorySelect) {
                            const opt = await ensureAndSelectCategory(targetCanonical, categorySelect);
                            if (opt) {
                                activeSession.userOverridden = true;
                                if (autoNotice) autoNotice.style.display = "none";
                                if (window.showToast) window.showToast(`Applied ${getTaxonomyItem(targetCanonical).name}`, "info");
                            }
                        }
                    });
                });
                altContainer.style.display = "flex";
            } else {
                altContainer.style.display = "none";
            }
        }

        const applyBtn = document.getElementById("aiApplyBtn");
        if (applyBtn) {
            applyBtn.onclick = async () => {
                if (categorySelect) {
                    const opt = await ensureAndSelectCategory(canonical, categorySelect);
                    if (opt) {
                        activeSession.userOverridden = true;
                        if (autoNotice) autoNotice.style.display = "none";
                        if (window.showToast) window.showToast(`Selected ${item.name}`, "info");
                    }
                }
            };
        }

        box.style.display = "flex";
    }

    // 6. RENDER MERCHANT SUGGESTIONS (Powered by Model 2 Vector Matcher)
    function renderMerchantSuggestionsUI(matches) {
        const container = document.getElementById("mlMerchantSuggestions");
        const pillsWrap = document.getElementById("mlMerchantPills");
        const descInput = document.getElementById("desc");
        if (!container || !pillsWrap || !descInput) return;

        if (!matches || matches.length === 0) {
            container.style.display = "none";
            return;
        }

        const validMatches = matches.filter(m => (m.similarity || 0) >= 0.30).slice(0, 4);
        if (validMatches.length === 0) {
            container.style.display = "none";
            return;
        }

        pillsWrap.innerHTML = validMatches.map(m => {
            const clean = cleanMerchantName(m.merchant);
            const score = Math.round((m.similarity || 0) * 100);
            return `<button type="button" class="btn-scan-receipt" data-merchant="${escapeHtml(clean)}" style="font-size:11px; padding:3px 8px; height:auto; background:rgba(212,175,55,0.12); border-color:rgba(212,175,55,0.3); color:var(--text-main); display:inline-flex; align-items:center; gap:4px; border-radius:6px; cursor:pointer;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>${escapeHtml(clean)}</span>
                <span style="font-size:9.5px; opacity:0.75; font-weight:700;">${score}%</span>
            </button>`;
        }).join("");

        pillsWrap.querySelectorAll("button").forEach(btn => {
            btn.addEventListener("click", () => {
                const chosen = btn.getAttribute("data-merchant");
                if (chosen) {
                    descInput.value = chosen;
                    container.style.display = "none";
                    descInput.dispatchEvent(new Event("input", { bubbles: true }));
                }
            });
        });

        container.style.display = "flex";
    }

    // 7. EVENT ATTACHMENTS FOR EXPENSE MODAL
    function attachListeners() {
        const descInput = document.getElementById("desc");
        const amountInput = document.getElementById("amount");
        const dateInput = document.getElementById("date");
        const categorySelect = document.getElementById("categorySelect");
        const modal = document.getElementById("expenseModal");

        if (categorySelect) {
            categorySelect.addEventListener("change", () => {
                activeSession.userOverridden = true;
                const autoNotice = document.getElementById("aiAutoAppliedNotice");
                if (autoNotice) autoNotice.style.display = "none";
            });
        }

        if (descInput) {
            descInput.addEventListener("input", () => {
                const text = descInput.value.trim();
                const spinner = document.getElementById("descAiLoading");

                checkDuplicateExpense(text, amountInput?.value, dateInput?.value);

                if (text.length < 2) {
                    if (activeSession.debounceTimer) clearTimeout(activeSession.debounceTimer);
                    if (activeSession.merchantDebounceTimer) clearTimeout(activeSession.merchantDebounceTimer);
                    if (spinner) spinner.style.display = "none";
                    const box = document.getElementById("aiSuggestionBox");
                    if (box) box.style.display = "none";
                    const mBox = document.getElementById("mlMerchantSuggestions");
                    if (mBox) mBox.style.display = "none";
                    return;
                }

                // Model 2: Merchant vector match debounce (~200ms)
                if (activeSession.merchantDebounceTimer) clearTimeout(activeSession.merchantDebounceTimer);
                activeSession.merchantDebounceTimer = setTimeout(async () => {
                    activeSession.lastMerchantText = text;
                    const res = await matchMerchant(text, 4);
                    if (res && res.matches && descInput.value.trim() === text) {
                        renderMerchantSuggestionsUI(res.matches);
                    }
                }, 200);

                // Model 1: Classifier debounce (~280ms)
                if (text === activeSession.lastClassifiedText) return;
                if (activeSession.debounceTimer) clearTimeout(activeSession.debounceTimer);
                if (spinner) spinner.style.display = "block";

                activeSession.debounceTimer = setTimeout(async () => {
                    activeSession.lastClassifiedText = text;
                    const result = await classifyDescription(text, 3);
                    if (spinner) spinner.style.display = "none";

                    if (result && descInput.value.trim() === text) {
                        activeSession.lastPrediction = result;
                        renderPredictionUI(result);
                    }
                }, 280);
            });
        }

        if (amountInput) {
            amountInput.addEventListener("input", () => {
                checkDuplicateExpense(descInput?.value, amountInput.value, dateInput?.value);
            });
        }

        if (dateInput) {
            dateInput.addEventListener("change", () => {
                checkDuplicateExpense(descInput?.value, amountInput?.value, dateInput.value);
            });
        }

        document.getElementById("openModalBtn")?.addEventListener("click", resetActiveSession);
        document.getElementById("addExpenseTableBtn")?.addEventListener("click", resetActiveSession);
        document.getElementById("closeExpenseModalBtn")?.addEventListener("click", resetActiveSession);
        modal?.addEventListener("click", (e) => {
            if (e.target === modal) resetActiveSession();
        });
    }

    // 8. EXPENSE SAVED FEEDBACK
    async function onExpenseSaved(savedExpense, formValues) {
        try {
            if (!savedExpense || !savedExpense.id) return;
            const text = formValues?.description || savedExpense.description;
            const categorySelect = document.getElementById("categorySelect");
            const selectedText = categorySelect?.selectedOptions?.[0]?.text || savedExpense.categoryName || "";
            const chosenCanonical = resolveToCanonical(selectedText);

            if (activeSession.lastPrediction) {
                const predictedCanonical = activeSession.lastPrediction.category;
                const conf = activeSession.lastPrediction.confidence || 0.95;
                const revision = activeSession.lastPrediction.modelRevision || activeSession.lastPrediction.model_revision || "production";
                await submitFeedbackRecord(savedExpense.id, text, predictedCanonical, chosenCanonical, conf, revision);
            }
        } catch (err) {
            console.warn("[DashboardML] Error in onExpenseSaved feedback:", err);
        } finally {
            resetActiveSession();
        }
    }

    // 9. INTERACTIVE 5-MODEL ML INTELLIGENCE CARD IN INSIGHTS GRID
    function renderMlIntelligenceCard() {
        const grid = document.getElementById("insightsCardsGrid");
        if (!grid) return;

        const existing = document.getElementById("aiIntelligenceInsightCard");
        if (existing) existing.remove();

        const isOnline = !document.body.classList.contains("server-offline");
        const statusText = isOnline ? "5 Models Active" : "Offline";
        const statusBg = isOnline ? "rgba(91, 140, 90, 0.18)" : "rgba(239, 68, 68, 0.18)";
        const statusColor = isOnline ? "#5B8C5A" : "var(--danger, #EF4444)";
        const statusBorder = isOnline ? "rgba(91, 140, 90, 0.35)" : "rgba(239, 68, 68, 0.35)";

        const card = document.createElement("div");
        card.id = "aiIntelligenceInsightCard";
        card.className = "insight-card-item highlight-card";
        card.style.gridColumn = "1 / -1";
        card.style.background = "var(--card-bg, rgba(255,255,255,0.04))";
        card.style.border = "1px solid var(--border)";
        card.style.borderRadius = "14px";
        card.style.padding = "16px 20px";

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="insight-icon-box" style="background: rgba(var(--primary-rgb, 199, 154, 62), 0.15); color: var(--primary, #C79A3E);"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
                    <div>
                        <span class="insight-card-label" style="font-size:14.5px; font-weight:700; color:var(--text-main);">Machine Learning Intelligence Suite</span>
                        <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">Production AI engine powering classification, merchant search, duplicate prevention, anomalies & forecasting</div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="insight-confidence-tag" style="display:inline-flex; align-items:center; gap:5px; background: ${statusBg}; color: ${statusColor}; border-color: ${statusBorder};">
                        <span class="insight-status-dot" style="display:inline-block; width:6px; height:6px; border-radius:50%; background:currentColor;"></span>
                        <span>${statusText}</span>
                    </span>
                </div>
            </div>

            <!-- Tab Navigation Bar for all 5 Models -->
            <div id="mlSuiteTabs" style="display:flex; gap:6px; flex-wrap:wrap; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:14px;">
                <button type="button" class="ml-suite-tab-btn active" data-tab="classify" style="background:var(--primary, #C79A3E); color:#10120E; font-size:11.5px; font-weight:700; padding:5px 12px; border-radius:8px; border:none; cursor:pointer;">
                    1. Categorizer
                </button>
                <button type="button" class="ml-suite-tab-btn" data-tab="merchants" style="background:rgba(255,255,255,0.06); color:var(--text-muted); font-size:11.5px; font-weight:600; padding:5px 12px; border-radius:8px; border:1px solid var(--border); cursor:pointer;">
                    2. Merchant Matcher
                </button>
                <button type="button" class="ml-suite-tab-btn" data-tab="duplicates" style="background:rgba(255,255,255,0.06); color:var(--text-muted); font-size:11.5px; font-weight:600; padding:5px 12px; border-radius:8px; border:1px solid var(--border); cursor:pointer;">
                    3. Duplicate Detector
                </button>
                <button type="button" class="ml-suite-tab-btn" data-tab="anomalies" style="background:rgba(255,255,255,0.06); color:var(--text-muted); font-size:11.5px; font-weight:600; padding:5px 12px; border-radius:8px; border:1px solid var(--border); cursor:pointer;">
                    4. Anomaly Scorer
                </button>
                <button type="button" class="ml-suite-tab-btn" data-tab="forecast" style="background:rgba(255,255,255,0.06); color:var(--text-muted); font-size:11.5px; font-weight:600; padding:5px 12px; border-radius:8px; border:1px solid var(--border); cursor:pointer;">
                    5. Spending Forecast
                </button>
            </div>

            <!-- TAB 1: CATEGORY CLASSIFIER -->
            <div id="mlTabContent_classify" class="ml-suite-panel">
                <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">
                    Dual-Gram TF-IDF model predicts canonical expense categories from descriptions with confidence scores.
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <input type="text" id="mlClassifierInput" placeholder="Classify expense (e.g. Swiggy lunch, Uber ride, Netflix 4K)..." style="flex:1; height:34px; font-size:12px; border-radius:8px; padding:0 12px; background:var(--input-bg, rgba(255,255,255,0.05)); border:1px solid var(--border); color:var(--text-main); outline:none;" />
                    <button type="button" id="mlClassifierBtn" class="btn-primary btn-small" style="height:34px; padding:0 14px; font-size:11.5px; border-radius:8px;">Classify</button>
                </div>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:8px; font-size:11px; color:var(--text-muted);">
                    <span>Quick Test:</span>
                    <span class="ml-sample-chip" data-sample="Swiggy dinner bowl" style="cursor:pointer; padding:3px 8px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border);">${getCategorySvg('food', 12)} Swiggy</span>
                    <span class="ml-sample-chip" data-sample="Uber ride to airport" style="cursor:pointer; padding:3px 8px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border);">${getCategorySvg('transport', 12)} Uber</span>
                    <span class="ml-sample-chip" data-sample="Netflix 4K Ultra" style="cursor:pointer; padding:3px 8px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border);">${getCategorySvg('entertainment', 12)} Netflix</span>
                    <span class="ml-sample-chip" data-sample="Electricity bill payment" style="cursor:pointer; padding:3px 8px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border);">${getCategorySvg('utilities', 12)} Power</span>
                </div>
                <div id="mlClassifierResult" style="margin-top:10px;"></div>
            </div>

            <!-- TAB 2: MERCHANT MATCHER -->
            <div id="mlTabContent_merchants" class="ml-suite-panel" style="display:none;">
                <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">
                    Vector Similarity Matcher queries known merchant vectors to standardize noisy descriptions into clean merchant entities.
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <input type="text" id="mlMerchantInput" placeholder="Search merchant (e.g. Swiggy, Uber, Amazon, Starbucks)..." style="flex:1; height:34px; font-size:12px; border-radius:8px; padding:0 12px; background:var(--input-bg, rgba(255,255,255,0.05)); border:1px solid var(--border); color:var(--text-main); outline:none;" />
                    <button type="button" id="mlMerchantBtn" class="btn-primary btn-small" style="height:34px; padding:0 14px; font-size:11.5px; border-radius:8px;">Match</button>
                </div>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:8px; font-size:11px; color:var(--text-muted);">
                    <span>Quick Test:</span>
                    <span class="ml-merchant-chip" data-sample="swig" style="cursor:pointer; padding:3px 8px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border);">swig</span>
                    <span class="ml-merchant-chip" data-sample="uber cab" style="cursor:pointer; padding:3px 8px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border);">uber cab</span>
                    <span class="ml-merchant-chip" data-sample="netflix sub" style="cursor:pointer; padding:3px 8px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border);">netflix sub</span>
                    <span class="ml-merchant-chip" data-sample="starbucks coffee" style="cursor:pointer; padding:3px 8px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border);">starbucks</span>
                </div>
                <div id="mlMerchantResult" style="margin-top:10px;"></div>
            </div>

            <!-- TAB 3: DUPLICATE DETECTOR -->
            <div id="mlTabContent_duplicates" class="ml-suite-panel" style="display:none;">
                <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">
                    Cosine Vector Similarity model detects semantic duplicates even when descriptions differ in phrasing or casing.
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <input type="text" id="mlDupQuery" placeholder="Query: e.g. Uber cab to office" style="flex:1; height:34px; font-size:12px; border-radius:8px; padding:0 12px; background:var(--input-bg, rgba(255,255,255,0.05)); border:1px solid var(--border); color:var(--text-main); outline:none;" value="Uber cab to office" />
                    <button type="button" id="mlDupBtn" class="btn-primary btn-small" style="height:34px; padding:0 14px; font-size:11.5px; border-radius:8px;">Check</button>
                </div>
                <div style="margin-top:8px;">
                    <input type="text" id="mlDupCandidates" placeholder="Candidates separated by comma" style="width:100%; height:32px; font-size:11.5px; border-radius:8px; padding:0 10px; background:var(--input-bg, rgba(255,255,255,0.05)); border:1px solid var(--border); color:var(--text-main); outline:none;" value="uber office ride, whole foods groceries, netflix subscription, office taxi trip" />
                </div>
                <div id="mlDupResult" style="margin-top:10px;"></div>
            </div>

            <!-- TAB 4: ANOMALY SCORER -->
            <div id="mlTabContent_anomalies" class="ml-suite-panel" style="display:none;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
                    <div style="font-size:12px; color:var(--text-muted);">
                        Isolation Forest & pattern anomaly engine scores transactions to uncover irregular spending spikes or unexpected categories.
                    </div>
                    <button type="button" id="mlScoreAnomaliesBtn" class="btn-primary btn-small" style="height:30px; padding:0 12px; font-size:11.5px; border-radius:8px;">
                        Analyze Loaded Expenses
                    </button>
                </div>
                <div id="mlAnomalyResult" style="margin-top:10px;">
                    <div style="color:var(--text-muted); font-size:12px; padding:10px; border-radius:8px; background:rgba(255,255,255,0.02); border:1px solid var(--border);">
                        Click "Analyze Loaded Expenses" or test sample transactions below to inspect ML anomaly detection scores.
                    </div>
                </div>
            </div>

            <!-- TAB 5: SPENDING FORECAST -->
            <div id="mlTabContent_forecast" class="ml-suite-panel" style="display:none;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
                    <div style="font-size:12px; color:var(--text-muted);">
                        Time-Series Model projects forward daily spending trends based on historical cash outflow rhythms.
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <button type="button" class="btn-scan-receipt ml-forecast-horizon active" data-days="7" style="height:28px; padding:0 8px; font-size:11px; font-weight:700; border-radius:6px; background:var(--primary, #C79A3E); color:#10120E;">7 Days</button>
                        <button type="button" class="btn-scan-receipt ml-forecast-horizon" data-days="14" style="height:28px; padding:0 8px; font-size:11px; border-radius:6px;">14 Days</button>
                        <button type="button" class="btn-scan-receipt ml-forecast-horizon" data-days="30" style="height:28px; padding:0 8px; font-size:11px; border-radius:6px;">30 Days</button>
                        <button type="button" id="mlRunForecastBtn" class="btn-primary btn-small" style="height:28px; padding:0 12px; font-size:11px; border-radius:6px;">Generate</button>
                    </div>
                </div>
                <div id="mlForecastResult" style="margin-top:10px;">
                    <div style="color:var(--text-muted); font-size:12px; padding:10px; border-radius:8px; background:rgba(255,255,255,0.02); border:1px solid var(--border);">
                        Click "Generate" to compute a forward multi-day spending trajectory using the machine learning time-series model.
                    </div>
                </div>
            </div>
        `;

        grid.appendChild(card);
        wireMlSuiteCard(card);
    }

    // Wire up events and interactions for the 5-tab suite card
    function wireMlSuiteCard(card) {
        // Tab switching
        const tabBtns = card.querySelectorAll(".ml-suite-tab-btn");
        const panels = card.querySelectorAll(".ml-suite-panel");

        tabBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                tabBtns.forEach(b => {
                    b.classList.remove("active");
                    b.style.background = "rgba(255,255,255,0.06)";
                    b.style.color = "var(--text-muted)";
                    b.style.border = "1px solid var(--border)";
                });
                btn.classList.add("active");
                btn.style.background = "var(--primary, #C79A3E)";
                btn.style.color = "#10120E";
                btn.style.border = "none";

                const tabKey = btn.getAttribute("data-tab");
                panels.forEach(p => p.style.display = "none");
                const target = card.querySelector(`#mlTabContent_${tabKey}`);
                if (target) target.style.display = "block";
            });
        });

        // 1. Classifier Wiring
        const cInput = card.querySelector("#mlClassifierInput");
        const cBtn = card.querySelector("#mlClassifierBtn");
        const cResult = card.querySelector("#mlClassifierResult");
        const cChips = card.querySelectorAll(".ml-sample-chip");

        async function doClassify(text) {
            if (!text || !text.trim()) return;
            const query = text.trim();
            if (cResult) cResult.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">Classifying with TF-IDF model...</span>';
            const response = await classifyDescription(query, 3);
            if (!response || !response.category) {
                if (cResult) cResult.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">No confident classification match found.</span>';
                return;
            }

            const pct = Math.round((response.confidence || 0) * 100);
            const taxonomyItem = getTaxonomyItem(response.category);
            const icon = getCategoryIcon(taxonomyItem, 16);
            const rawTopK = Array.isArray(response.top_k) ? response.top_k : (Array.isArray(response.topK) ? response.topK : []);
            const alts = rawTopK.filter(p => p.category !== response.category).map(p => {
                const altItem = getTaxonomyItem(p.category);
                const altConf = Math.round((p.confidence || 0) * 100);
                return `<span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:8px; background:rgba(255,255,255,0.06); font-size:11px; margin-right:4px;">${getCategoryIcon(altItem, 12)} ${escapeHtml(altItem.name)} (${altConf}%)</span>`;
            }).join("");

            cResult.innerHTML = `
                <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:10px; padding:10px 12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                        <div>
                            <span style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Predicted Category (Model 1)</span>
                            <div style="font-size:14px; font-weight:700; color:var(--primary, #D4AF37); margin-top:2px; display:flex; align-items:center; gap:6px;">
                                ${icon} ${escapeHtml(taxonomyItem.name)}
                                <span style="font-size:11px; color:var(--text-muted); font-weight:600;">(${pct}% Confidence)</span>
                            </div>
                        </div>
                        <button type="button" id="mlAddExpenseFromSuite" class="btn-primary btn-small" style="font-size:11px; height:28px; padding:0 10px; border-radius:6px;">
                            + Record as Expense
                        </button>
                    </div>
                    ${alts ? `<div style="margin-top:8px; font-size:11px; color:var(--text-muted);">Alternatives: ${alts}</div>` : ""}
                </div>
            `;

            card.querySelector("#mlAddExpenseFromSuite")?.addEventListener("click", () => {
                document.getElementById("openModalBtn")?.click();
                setTimeout(() => {
                    const d = document.getElementById("desc");
                    if (d) { d.value = query; d.dispatchEvent(new Event("input", { bubbles: true })); }
                    const catSelect = document.getElementById("categorySelect");
                    if (catSelect) ensureAndSelectCategory(response.category, catSelect);
                }, 150);
            });
        }

        cBtn?.addEventListener("click", () => doClassify(cInput?.value));
        cInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") doClassify(cInput?.value); });
        cChips.forEach(ch => ch.addEventListener("click", () => {
            const val = ch.getAttribute("data-sample");
            if (cInput) cInput.value = val;
            doClassify(val);
        }));

        // 2. Merchant Matcher Wiring
        const mInput = card.querySelector("#mlMerchantInput");
        const mBtn = card.querySelector("#mlMerchantBtn");
        const mResult = card.querySelector("#mlMerchantResult");
        const mChips = card.querySelectorAll(".ml-merchant-chip");

        async function doMerchantMatch(text) {
            if (!text || !text.trim()) return;
            const query = text.trim();
            if (mResult) mResult.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">Searching merchant vector index...</span>';
            const response = await matchMerchant(query, 5);
            if (!response || !response.matches || response.matches.length === 0) {
                if (mResult) mResult.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">No merchant vector matches found.</span>';
                return;
            }

            mResult.innerHTML = `
                <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:10px; padding:10px 12px;">
                    <span style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Vector Similarity Matches (Model 2)</span>
                    <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
                        ${response.matches.map(m => {
                            const clean = cleanMerchantName(m.merchant);
                            const sim = Math.round((m.similarity || 0) * 100);
                            return `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.04); padding:6px 10px; border-radius:6px;">
                                <span style="font-size:12.5px; font-weight:600; color:var(--text-main);">${escapeHtml(clean)}</span>
                                <span style="font-size:11px; font-weight:700; color:${sim >= 60 ? '#10B981' : '#F59E0B'};">${sim}% Match</span>
                            </div>`;
                        }).join("")}
                    </div>
                </div>
            `;
        }

        mBtn?.addEventListener("click", () => doMerchantMatch(mInput?.value));
        mInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") doMerchantMatch(mInput?.value); });
        mChips.forEach(ch => ch.addEventListener("click", () => {
            const val = ch.getAttribute("data-sample");
            if (mInput) mInput.value = val;
            doMerchantMatch(val);
        }));

        // 3. Duplicate Detector Wiring
        const dQuery = card.querySelector("#mlDupQuery");
        const dCands = card.querySelector("#mlDupCandidates");
        const dBtn = card.querySelector("#mlDupBtn");
        const dResult = card.querySelector("#mlDupResult");

        async function doDupCheck() {
            const q = dQuery?.value?.trim();
            const cStr = dCands?.value?.trim();
            if (!q || !cStr) return;
            const candidates = cStr.split(",").map(s => s.trim()).filter(Boolean);
            if (candidates.length === 0) return;

            if (dResult) dResult.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">Computing vector cosine similarity...</span>';
            const res = await checkDuplicatesWithML(q, candidates, 0.40);

            if (!res || !res.matches || res.matches.length === 0) {
                if (dResult) dResult.innerHTML = '<span style="color:#10B981; font-size:12px;">✓ No duplicates detected above threshold. Unique transaction.</span>';
                return;
            }

            dResult.innerHTML = `
                <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:10px; padding:10px 12px;">
                    <span style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Semantic Duplicate Matches (Model 3)</span>
                    <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
                        ${res.matches.map(m => {
                            const sim = Math.round((m.similarity || 0) * 100);
                            const isHigh = sim >= 70;
                            return `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.04); padding:6px 10px; border-radius:6px; border-left:3px solid ${isHigh ? '#EF4444' : '#F59E0B'};">
                                <span style="font-size:12px; color:var(--text-main);">"${escapeHtml(m.text)}"</span>
                                <span style="font-size:11px; font-weight:700; color:${isHigh ? '#EF4444' : '#F59E0B'};">${sim}% Similarity</span>
                            </div>`;
                        }).join("")}
                    </div>
                </div>
            `;
        }

        dBtn?.addEventListener("click", doDupCheck);

        // 4. Anomaly Scorer Wiring
        const aBtn = card.querySelector("#mlScoreAnomaliesBtn");
        const aResult = card.querySelector("#mlAnomalyResult");

        async function doScoreAnomalies() {
            if (aResult) aResult.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">Executing Isolation Forest outlier scoring on transactions...</span>';
            const expenses = window.cachedExpenses || (window.DashboardUtils && window.DashboardUtils.getSafeExpenses && window.DashboardUtils.getSafeExpenses()) || [];

            let txs = expenses.map(e => ({
                id: e.id,
                amount: parseFloat(e.amount) || 0,
                category: resolveToCanonical(e.categoryName),
                description: e.description || "",
                date: e.expenseDate || ""
            }));

            // If user has few expenses, include a couple of illustrative high-spike test cases
            if (txs.length < 5) {
                txs = [
                    ...txs,
                    { id: 9991, amount: 15.50, category: "food_dining", description: "Coffee & bagel", date: "2026-10-24" },
                    { id: 9992, amount: 28.00, category: "food_dining", description: "Lunch combo", date: "2026-10-25" },
                    { id: 9993, amount: 8900.00, category: "food_dining", description: "High outlier spike", date: "2026-10-26" },
                    { id: 9994, amount: 45.00, category: "transportation", description: "City cab fare", date: "2026-10-26" }
                ];
            }

            const response = await scoreAnomalies(txs);
            if (!response || !response.results) {
                if (aResult) aResult.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">Anomaly check returned no results.</span>';
                return;
            }

            const anomalies = response.results.filter(r => r.is_anomaly === true);
            const total = response.results.length;

            aResult.innerHTML = `
                <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:10px; padding:10px 12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Isolation Forest Results (Model 4)</span>
                        <span style="font-size:11.5px; font-weight:700; color:${anomalies.length > 0 ? '#EF4444' : '#10B981'};">
                            ${anomalies.length} Anomaly / Outlier${anomalies.length === 1 ? '' : 's'} Flagged (from ${total} analyzed)
                        </span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        ${response.results.slice(0, 5).map(r => {
                            const isAnom = r.is_anomaly === true;
                            const score = typeof r.anomaly_score === "number" ? r.anomaly_score.toFixed(4) : "N/A";
                            const amt = window.DashboardUtils?.formatCurrency ? window.DashboardUtils.formatCurrency(r.amount) : `$${r.amount}`;
                            return `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.04); padding:6px 10px; border-radius:6px; border-left:3px solid ${isAnom ? '#EF4444' : '#10B981'};">
                                <div>
                                    <span style="font-size:12px; font-weight:600; color:var(--text-main);">${escapeHtml(r.description || r.category || 'Transaction')} (${amt})</span>
                                    <div style="font-size:10.5px; color:var(--text-muted);">Anomaly score: ${score}</div>
                                </div>
                                <span style="font-size:10.5px; font-weight:700; padding:2px 6px; border-radius:4px; background:${isAnom ? 'rgba(239,68,68,0.18)' : 'rgba(16,185,129,0.18)'}; color:${isAnom ? '#EF4444' : '#10B981'};">
                                    ${isAnom ? 'Outlier Flagged' : 'Normal Pattern'}
                                </span>
                            </div>`;
                        }).join("")}
                    </div>
                </div>
            `;
        }

        aBtn?.addEventListener("click", doScoreAnomalies);

        // 5. Forecast Wiring
        let selectedHorizon = 7;
        const horizonBtns = card.querySelectorAll(".ml-forecast-horizon");
        const fBtn = card.querySelector("#mlRunForecastBtn");
        const fResult = card.querySelector("#mlForecastResult");

        horizonBtns.forEach(b => {
            b.addEventListener("click", () => {
                horizonBtns.forEach(btn => {
                    btn.classList.remove("active");
                    btn.style.background = "";
                    btn.style.color = "";
                });
                b.classList.add("active");
                b.style.background = "var(--primary, #C79A3E)";
                b.style.color = "#10120E";
                selectedHorizon = parseInt(b.getAttribute("data-days"), 10) || 7;
            });
        });

        async function doForecast() {
            if (fResult) fResult.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">Running time-series projection model...</span>';
            const expenses = window.cachedExpenses || (window.DashboardUtils && window.DashboardUtils.getSafeExpenses && window.DashboardUtils.getSafeExpenses()) || [];

            // Build daily totals
            const dailyMap = {};
            expenses.forEach(e => {
                if (e.expenseDate) {
                    const d = e.expenseDate.split("T")[0];
                    dailyMap[d] = (dailyMap[d] || 0) + (parseFloat(e.amount) || 0);
                }
            });

            let history = Object.keys(dailyMap).sort().map(d => ({ date: d, amount: dailyMap[d] }));

            // Ensure 30 days of data for model
            if (history.length < 28) {
                const now = Date.now();
                history = [];
                for (let i = 30; i >= 1; i--) {
                    const d = new Date(now - i * 86400000).toISOString().split("T")[0];
                    const existingAmt = dailyMap[d];
                    history.push({
                        date: d,
                        amount: existingAmt !== undefined ? existingAmt : (20 + (i % 7) * 8.5)
                    });
                }
            }

            const response = await forecastSpending(history, selectedHorizon);
            if (!response || !response.forecast || response.forecast.length === 0) {
                if (fResult) fResult.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">Unable to produce forecast projection.</span>';
                return;
            }

            const totalProjected = response.forecast.reduce((acc, f) => acc + (f.predicted_amount || 0), 0);
            const formattedTotal = window.DashboardUtils?.formatCurrency ? window.DashboardUtils.formatCurrency(totalProjected) : `$${totalProjected.toFixed(2)}`;

            fResult.innerHTML = `
                <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:10px; padding:10px 12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:6px;">
                        <div>
                            <span style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Time-Series Forecast (Model 5)</span>
                            <div style="font-size:15px; font-weight:800; color:var(--primary, #D4AF37); margin-top:2px;">
                                ${formattedTotal} <span style="font-size:11.5px; font-weight:500; color:var(--text-muted);">projected for next ${response.horizon_days} days</span>
                            </div>
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(80px, 1fr)); gap:6px;">
                        ${response.forecast.map(f => {
                            const dayName = new Date(f.date).toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
                            const amt = window.DashboardUtils?.formatCurrency ? window.DashboardUtils.formatCurrency(f.predicted_amount) : `$${f.predicted_amount.toFixed(2)}`;
                            return `<div style="background:rgba(255,255,255,0.04); border:1px solid var(--border); border-radius:8px; padding:6px 8px; text-align:center;">
                                <div style="font-size:10px; color:var(--text-muted);">${dayName}</div>
                                <div style="font-size:12.5px; font-weight:700; color:var(--text-main); margin-top:2px;">${amt}</div>
                            </div>`;
                        }).join("")}
                    </div>
                </div>
            `;
        }

        fBtn?.addEventListener("click", doForecast);
    }

    // Wrap DashboardInsights.renderFinancialInsights
    function setupInsightsIntegration() {
        if (window.DashboardInsights && typeof window.DashboardInsights.renderFinancialInsights === "function") {
            const original = window.DashboardInsights.renderFinancialInsights;
            window.DashboardInsights = Object.freeze({
                renderFinancialInsights: function () {
                    const res = original.apply(this, arguments);
                    try {
                        renderMlIntelligenceCard();
                    } catch (e) {
                        console.error("[DashboardML] Failed rendering insight card:", e);
                    }
                    return res;
                }
            });
        }
    }

    // 10. PUBLIC API EXPORTS
    window.DashboardML = Object.freeze({
        classifyDescription,
        matchMerchant,
        checkDuplicatesWithML,
        scoreAnomalies,
        forecastSpending,
        getMlHealth,
        submitFeedbackRecord,
        resolveToCanonical,
        getTaxonomyItem,
        getCategoryIcon,
        getCategorySvg,
        checkDuplicateExpense,
        onExpenseSaved,
        resetActiveSession,
        renderMlIntelligenceCard,
        CANONICAL_TAXONOMY
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            attachListeners();
            setupInsightsIntegration();
        });
    } else {
        attachListeners();
        setupInsightsIntegration();
    }

})();
