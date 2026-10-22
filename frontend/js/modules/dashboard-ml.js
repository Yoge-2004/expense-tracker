/* ==========================================================================
   DASHBOARD ML & AI INTELLIGENCE MODULE
   ==========================================================================
   Provides client-side machine learning inference, real-time smart
   auto-categorization, duplicate transaction detection, and continuous
   learning feedback loop integration with the backend.
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

    // 1. CANONICAL TAXONOMY DEFINITIONS (Aligned with trained TF-IDF & backend models)
    const CANONICAL_TAXONOMY = [
        {
            id: "food_dining",
            name: "Food & Dining",
            emoji: "🍔",
            aliases: ["food", "dining", "groceries", "grocery", "restaurant", "restaurants", "cafe", "coffee", "snacks", "lunch", "dinner", "breakfast", "swiggy", "zomato", "eats"]
        },
        {
            id: "transportation",
            name: "Transportation",
            emoji: "🚗",
            aliases: ["transport", "transportation", "travel", "fuel", "gas", "petrol", "diesel", "cab", "taxi", "uber", "ola", "metro", "flight", "commute", "bus", "train", "parking", "toll"]
        },
        {
            id: "shopping_retail",
            name: "Shopping & Retail",
            emoji: "🛍️",
            aliases: ["shopping", "retail", "clothing", "apparel", "electronics", "amazon", "flipkart", "store", "fashion", "shoes", "mall", "supermarket", "purchase"]
        },
        {
            id: "entertainment_recreation",
            name: "Entertainment & Recreation",
            emoji: "🎬",
            aliases: ["entertainment", "recreation", "movies", "cinema", "netflix", "spotify", "prime", "games", "gaming", "outing", "hobby", "concert", "theatre", "disney", "youtube"]
        },
        {
            id: "healthcare_medical",
            name: "Healthcare & Medical",
            emoji: "💊",
            aliases: ["health", "healthcare", "medical", "pharmacy", "medicine", "doctor", "hospital", "dental", "clinic", "fitness", "gym", "meds", "apollo", "prescription"]
        },
        {
            id: "utilities_services",
            name: "Utilities & Services",
            emoji: "💡",
            aliases: ["utilities", "utility", "services", "bills", "electricity", "water", "internet", "wifi", "broadband", "recharge", "phone", "mobile", "gas bill", "rent", "maintenance", "power"]
        },
        {
            id: "financial_services",
            name: "Financial Services",
            emoji: "💳",
            aliases: ["finance", "financial", "investment", "investments", "banking", "bank", "insurance", "taxes", "tax", "loan", "emi", "interest", "brokerage", "crypto", "mutual fund", "sip", "card"]
        },
        {
            id: "income",
            name: "Income",
            emoji: "💰",
            aliases: ["income", "salary", "wages", "bonus", "dividend", "interest income", "stipend", "freelance", "payout", "deposit"]
        },
        {
            id: "government_legal",
            name: "Government & Legal",
            emoji: "⚖️",
            aliases: ["government", "legal", "court", "license", "passport", "fine", "penalty", "stamp", "registration", "challan", "fees"]
        },
        {
            id: "charity_donations",
            name: "Charity & Donations",
            emoji: "🤝",
            aliases: ["charity", "donation", "donations", "ngo", "aid", "relief", "gift", "giving", "contribution"]
        }
    ];

    const CANONICAL_IDS = new Set(CANONICAL_TAXONOMY.map(t => t.id));

    // Resolve any category label or ID to canonical key
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
            return { id: "unknown", name: "General Expense", emoji: "🏷️", aliases: [] };
        }
        const clean = String(canonicalId).toLowerCase().trim();
        return CANONICAL_TAXONOMY.find(t => t.id === clean || t.name.toLowerCase() === clean) || {
            id: clean,
            name: clean.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
            emoji: "🏷️",
            aliases: []
        };
    }

    // Match canonical category with the select element's <option>
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

    // 2. STATE MANAGEMENT FOR ACTIVE PREDICTION SESSION
    let activeSession = {
        lastPrediction: null,
        userOverridden: false,
        debounceTimer: null,
        lastClassifiedText: ""
    };

    function resetActiveSession() {
        if (activeSession.debounceTimer) clearTimeout(activeSession.debounceTimer);
        activeSession.lastPrediction = null;
        activeSession.lastClassifiedText = "";
        activeSession.userOverridden = false;
        const box = document.getElementById("aiSuggestionBox");
        if (box) box.style.display = "none";
        const autoNotice = document.getElementById("aiAutoAppliedNotice");
        if (autoNotice) autoNotice.style.display = "none";
        const spinner = document.getElementById("descAiLoading");
        if (spinner) spinner.style.display = "none";
        const dupBox = document.getElementById("duplicateWarningBox");
        if (dupBox) dupBox.style.display = "none";
    }

    // 3. API CLIENT CALLS
    async function classifyDescription(text, topN = 3) {
        if (!text || text.trim().length < 3) return null;
        try {
            const response = await window.apiRequest("/ml/classify", {
                method: "POST",
                body: JSON.stringify({ description: text.trim(), topN: topN }),
                showLoading: false
            });
            return response;
        } catch (err) {
            console.warn("[DashboardML] ML classify call bypassed:", err.message);
            return null;
        }
    }

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
            console.info(`[DashboardML] Feedback submitted for expense #${payload.transactionId} (${payload.predictedCategory} -> ${payload.correctedCategory})`);
        } catch (err) {
            console.warn("[DashboardML] Continuous learning feedback skipped:", err.message);
        }
    }

    // Helper to ensure an option is selectable in category dropdown, auto-creating user category if missing
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

    // 4. DUPLICATE TRANSACTION DETECTION (Similarity Engine)
    function checkDuplicateExpense(desc, amount, date) {
        const dupBox = document.getElementById("duplicateWarningBox");
        const dupText = document.getElementById("dupDetailText");
        if (!dupBox || !dupText) return;

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0 || !desc || desc.trim().length < 2) {
            dupBox.style.display = "none";
            return;
        }

        const cleanDesc = desc.trim().toLowerCase();
        const currentExpenseId = document.getElementById("expenseId")?.value;
        const expenses = window.cachedExpenses || (window.DashboardUtils && window.DashboardUtils.getSafeExpenses && window.DashboardUtils.getSafeExpenses()) || [];

        const targetDate = date ? new Date(date) : new Date();

        const match = expenses.find(exp => {
            if (currentExpenseId && String(exp.id) === String(currentExpenseId)) return false;
            const expAmt = parseFloat(exp.amount);
            if (isNaN(expAmt) || Math.abs(expAmt - numAmount) >= 0.01) return false;

            const expDate = exp.expenseDate ? new Date(exp.expenseDate) : null;
            if (expDate) {
                const dayDiff = Math.abs((targetDate - expDate) / (1000 * 60 * 60 * 24));
                if (dayDiff > 14) return false; // within 2 weeks
            }

            const expDesc = (exp.description || "").trim().toLowerCase();
            return (
                expDesc === cleanDesc ||
                (cleanDesc.length > 4 && expDesc.includes(cleanDesc)) ||
                (expDesc.length > 4 && cleanDesc.includes(expDesc))
            );
        });

        if (match) {
            const formattedAmt = window.DashboardUtils?.formatCurrency ? window.DashboardUtils.formatCurrency(match.amount) : `$${match.amount}`;
            const formattedDate = window.DashboardUtils?.formatDate ? window.DashboardUtils.formatDate(match.expenseDate) : match.expenseDate;
            dupText.innerHTML = `Identical amount <strong>${formattedAmt}</strong> for "${escapeHtml(match.description)}" was recorded on <strong>${formattedDate}</strong>.`;
            dupBox.style.display = "flex";
        } else {
            dupBox.style.display = "none";
        }
    }

    // 5. UI CONTROLLER FOR REAL-TIME PREDICTION
    function renderPredictionUI(prediction, currentText) {
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
            predName.innerHTML = `${item.emoji} ${escapeHtml(item.name)}`;
        }

        if (confBadge) {
            confBadge.textContent = `${confPct}% match`;
            confBadge.className = "ai-conf-badge " + (confPct >= 80 ? "ai-conf-high" : confPct >= 50 ? "ai-conf-mid" : "");
        }

        // Auto-select category if user hasn't explicitly chosen one yet and confidence is good
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

        // Alternative suggestions pills (supports both topK and top_k)
        if (pillsList && altContainer) {
            const rawTopK = Array.isArray(prediction.topK)
                ? prediction.topK
                : (Array.isArray(prediction.top_k) ? prediction.top_k : []);
            const alternatives = rawTopK.filter(k => k.category !== canonical).slice(0, 3);

            if (alternatives.length > 0) {
                pillsList.innerHTML = alternatives.map(alt => {
                    const altItem = getTaxonomyItem(alt.category);
                    const altConf = Math.round((alt.confidence || 0) * 100);
                    return `<button type="button" class="ai-pill-chip" data-canonical="${escapeHtml(alt.category)}">
                        ${altItem.emoji} ${escapeHtml(altItem.name)} <span class="u-inl-98ed520">${altConf}%</span>
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

        // Manual apply button handler
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

    // 6. EVENT ATTACHMENTS & INITIALIZATION
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

                if (text.length < 3) {
                    if (activeSession.debounceTimer) clearTimeout(activeSession.debounceTimer);
                    if (spinner) spinner.style.display = "none";
                    const box = document.getElementById("aiSuggestionBox");
                    if (box) box.style.display = "none";
                    return;
                }

                if (text === activeSession.lastClassifiedText) return;

                if (activeSession.debounceTimer) clearTimeout(activeSession.debounceTimer);
                if (spinner) spinner.style.display = "block";

                activeSession.debounceTimer = setTimeout(async () => {
                    activeSession.lastClassifiedText = text;
                    const result = await classifyDescription(text, 3);
                    if (spinner) spinner.style.display = "none";

                    if (result && descInput.value.trim() === text) {
                        activeSession.lastPrediction = result;
                        renderPredictionUI(result, text);
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

        // Reset state whenever new expense modal is opened
        document.getElementById("openModalBtn")?.addEventListener("click", resetActiveSession);
        document.getElementById("addExpenseTableBtn")?.addEventListener("click", resetActiveSession);

        // Listen for modal close to clean up
        document.getElementById("closeExpenseModalBtn")?.addEventListener("click", resetActiveSession);
        modal?.addEventListener("click", (e) => {
            if (e.target === modal) resetActiveSession();
        });
    }

    // 7. EXPENSE CREATION FEEDBACK DISPATCHER
    // Called whenever an expense is successfully recorded or updated
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

                // Always submit continuous learning feedback (either confirmation or correction)
                await submitFeedbackRecord(savedExpense.id, text, predictedCanonical, chosenCanonical, conf, revision);
            }
        } catch (err) {
            console.warn("[DashboardML] Error in onExpenseSaved feedback hook:", err);
        } finally {
            resetActiveSession();
        }
    }

    // 8. RENDER ML INTELLIGENCE CARD IN INSIGHTS GRID
    function wireClassifierCard(card) {
        const input = card.querySelector("#mlClassifierInput");
        const btn = card.querySelector("#mlClassifierBtn");
        const resultContainer = card.querySelector("#mlClassifierResult");
        const sampleChips = card.querySelectorAll(".ml-sample-chip");

        async function doClassify(text) {
            if (!text || !text.trim()) return;
            const query = text.trim();
            if (resultContainer) {
                resultContainer.innerHTML = '<span class="u-inl-9ea51a8">Classifying with ML intelligence...</span>';
            }
            try {
                const response = await classifyDescription(query, 3);
                if (!response) {
                    if (resultContainer) {
                        resultContainer.innerHTML = '<span class="u-inl-9ea51a8">No confident classification match found.</span>';
                    }
                    return;
                }

                const top = Array.isArray(response)
                    ? response[0]
                    : { category: response.category, confidence: response.confidence };

                if (!top || !top.category) {
                    if (resultContainer) {
                        resultContainer.innerHTML = '<span class="u-inl-9ea51a8">No confident classification match found.</span>';
                    }
                    return;
                }

                const pct = Math.round((top.confidence || 0) * 100);
                const taxonomyItem = getTaxonomyItem(top.category);
                const icon = taxonomyItem.emoji || "🏷️";
                const displayName = taxonomyItem.name || top.category;

                const rawTopK = Array.isArray(response)
                    ? response.slice(1)
                    : (Array.isArray(response.topK || response.top_k)
                        ? (response.topK || response.top_k).filter(p => p.category !== top.category)
                        : []);

                const alternatives = rawTopK.map(p => {
                    const altItem = getTaxonomyItem(p.category);
                    const altConf = Math.round((p.confidence || 0) * 100);
                    return `<span class="ml-alt-chip u-inl-83e93b3" data-cat="${escapeHtml(p.category)}">${altItem.emoji} ${escapeHtml(altItem.name)} (${altConf}%)</span>`;
                }).join("");

                if (resultContainer) {
                    resultContainer.innerHTML = `
                        <div class="u-inl-094daff">
                            <div class="u-inl-8a7c82f">
                                <div>
                                    <span class="u-inl-f03c9b7">ML Predicted Category</span>
                                    <div class="u-inl-b139d61">
                                        ${icon} ${escapeHtml(displayName)}
                                        <span class="u-inl-96aa28a">(${pct}% Match)</span>
                                    </div>
                                </div>
                                <button type="button" id="mlApplyExpenseBtn" class="btn-primary btn-small u-inl-7245db8">
                                    + Add as Expense
                                </button>
                            </div>
                            ${alternatives ? `<div class="u-inl-958a6bb">Alternatives: ${alternatives}</div>` : ""}
                        </div>
                    `;

                    const applyBtn = resultContainer.querySelector("#mlApplyExpenseBtn");
                    if (applyBtn) {
                        applyBtn.addEventListener("click", () => {
                            if (window.openNewExpenseModal) {
                                window.openNewExpenseModal();
                            } else {
                                document.getElementById("openModalBtn")?.click();
                            }
                            setTimeout(() => {
                                const descInput = document.getElementById("desc");
                                if (descInput) {
                                    descInput.value = query;
                                    descInput.dispatchEvent(new Event("input", { bubbles: true }));
                                }
                                const catSelect = document.getElementById("categorySelect");
                                if (catSelect) {
                                    ensureAndSelectCategory(top.category, catSelect);
                                }
                                const amtInput = document.getElementById("amount");
                                if (amtInput) amtInput.focus();
                            }, 150);
                        });
                    }

                    resultContainer.querySelectorAll(".ml-alt-chip").forEach(chip => {
                        chip.addEventListener("click", () => {
                            const newCat = chip.getAttribute("data-cat");
                            if (newCat) {
                                submitFeedbackRecord({
                                    rawDescription: query,
                                    suggestedCategory: top.category,
                                    userSelectedCategory: newCat,
                                    confidence: top.confidence
                                });
                                doClassify(query);
                            }
                        });
                    });
                }
            } catch (err) {
                console.error("[DashboardML] Classification error:", err);
                if (resultContainer) {
                    resultContainer.innerHTML = '<span class="u-inl-3ef7dda">Classification check failed.</span>';
                }
            }
        }

        if (btn && input) {
            btn.addEventListener("click", () => doClassify(input.value));
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    doClassify(input.value);
                }
            });
        }

        sampleChips.forEach(chip => {
            chip.addEventListener("click", () => {
                const sampleText = chip.getAttribute("data-sample") || chip.textContent.trim();
                if (input) input.value = sampleText;
                doClassify(sampleText);
            });
        });
    }

    function renderMlIntelligenceCard() {
        const grid = document.getElementById("insightsCardsGrid");
        if (!grid) return;

        // Prevent duplicate cards
        const existing = document.getElementById("aiIntelligenceInsightCard");
        if (existing) existing.remove();

        const isOnline = !document.body.classList.contains("server-offline");
        const statusText = isOnline ? "Active" : "Offline";
        const statusBg = isOnline ? "rgba(91, 140, 90, 0.18)" : "rgba(239, 68, 68, 0.18)";
        const statusColor = isOnline ? "#5B8C5A" : "var(--danger, #EF4444)";
        const statusBorder = isOnline ? "rgba(91, 140, 90, 0.35)" : "rgba(239, 68, 68, 0.35)";

        const card = document.createElement("div");
        card.id = "aiIntelligenceInsightCard";
        card.className = "insight-card-item";
        card.innerHTML = `
            <div class="insight-card-item-header">
                <div class="u-inl-d939926">
                    <div class="insight-icon-box u-inl-b9e4b70">⚡</div>
                    <span class="insight-card-label u-inl-e9b24de">AI Smart Categorizer</span>
                </div>
                <span class="insight-confidence-tag" style="display:inline-flex; align-items:center; justify-content:center; gap:5px; line-height:1; background: ${statusBg}; color: ${statusColor}; border-color: ${statusBorder}; margin-left:auto; flex-shrink:0;">
                    <span class="insight-status-dot u-inl-5abdf9d"></span><span class="insight-status-text u-inl-69b4653">${statusText}</span>
                </span>
            </div>
            <div class="insight-card-content u-inl-9e3c4cc">
                <div class="u-inl-aaad8ed">
                    Dual-Gram ML classifier automatically predicts expense categories from merchant names & descriptions.
                </div>
                <div class="ml-classifier-input-row u-inl-07b8131">
                    <input class="u-inl-b811776" type="text" id="mlClassifierInput" placeholder="Classify expense (e.g. Swiggy, Uber, Netflix)..." />
                    <button type="button" id="mlClassifierBtn" class="btn-primary btn-small u-inl-c76f287">Classify</button>
                </div>
                <div class="u-inl-d431697" id="mlClassifierResult">
                    <div class="u-inl-a90d5c5">
                        <span>Try:</span>
                        <span class="ml-sample-chip u-inl-f772fd8" data-sample="Swiggy meal">🍔 Swiggy</span>
                        <span class="ml-sample-chip u-inl-f772fd8" data-sample="Uber ride">🚗 Uber</span>
                        <span class="ml-sample-chip u-inl-f772fd8" data-sample="Netflix 4K">🎬 Netflix</span>
                        <span class="ml-sample-chip u-inl-f772fd8" data-sample="Electricity bill">⚡ Power</span>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
        wireClassifierCard(card);
    }

    window.DashboardMlInsights = Object.freeze({ appendMlInsightsCard });

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
