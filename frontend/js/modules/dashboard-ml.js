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
                        ${altItem.emoji} ${escapeHtml(altItem.name)} <span style="opacity:0.75; font-size:10px;">${altConf}%</span>
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
                resultContainer.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">Classifying with ML intelligence...</span>';
            }
            try {
                const response = await classifyDescription(query, 3);
                if (!response) {
                    if (resultContainer) {
                        resultContainer.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">No confident classification match found.</span>';
                    }
                    return;
                }

                const top = Array.isArray(response)
                    ? response[0]
                    : { category: response.category, confidence: response.confidence };

                if (!top || !top.category) {
                    if (resultContainer) {
                        resultContainer.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">No confident classification match found.</span>';
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
                    return `<span class="ml-alt-chip" data-cat="${escapeHtml(p.category)}" style="cursor:pointer; display:inline-block; padding:2px 8px; border-radius:10px; background:rgba(255,255,255,0.06); font-size:11px; margin-right:4px;">${altItem.emoji} ${escapeHtml(altItem.name)} (${altConf}%)</span>`;
                }).join("");

                if (resultContainer) {
                    resultContainer.innerHTML = `
                        <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:10px; padding:10px 12px; margin-top:8px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                                <div>
                                    <span style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:700; letter-spacing:0.5px;">ML Predicted Category</span>
                                    <div style="font-size:13.5px; font-weight:700; color:var(--primary, #D4AF37); margin-top:2px;">
                                        ${icon} ${escapeHtml(displayName)}
                                        <span style="font-size:11px; font-weight:600; color:var(--text-muted); margin-left:4px;">(${pct}% Match)</span>
                                    </div>
                                </div>
                                <button type="button" id="mlApplyExpenseBtn" class="btn-primary btn-small" style="font-size:11.5px; height:28px; padding:0 10px; border-radius:6px;">
                                    + Add as Expense
                                </button>
                            </div>
                            ${alternatives ? `<div style="margin-top:6px; font-size:11px; color:var(--text-muted);">Alternatives: ${alternatives}</div>` : ""}
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
                    resultContainer.innerHTML = '<span style="color:var(--danger, #EF4444); font-size:12px;">Classification check failed.</span>';
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
                <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1 1 auto;">
                    <div class="insight-icon-box" style="background: rgba(var(--primary-rgb, 199, 154, 62), 0.15); color: var(--primary, #C79A3E);">⚡</div>
                    <span class="insight-card-label" style="min-width:0; overflow-wrap:break-word;">AI Smart Categorizer</span>
                </div>
                <span class="insight-confidence-tag" style="display:inline-flex; align-items:center; justify-content:center; gap:5px; line-height:1; background: ${statusBg}; color: ${statusColor}; border-color: ${statusBorder}; margin-left:auto; flex-shrink:0;">
                    <span class="insight-status-dot" style="display:inline-block; width:6px; height:6px; border-radius:50%; background:currentColor; flex-shrink:0; transform:translateY(-0.5px);"></span><span class="insight-status-text" style="display:inline-block; line-height:1;">${statusText}</span>
                </span>
            </div>
            <div class="insight-card-content" style="margin-top:6px;">
                <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">
                    Dual-Gram ML classifier automatically predicts expense categories from merchant names & descriptions.
                </div>
                <div class="ml-classifier-input-row" style="display:flex; gap:6px; align-items:center;">
                    <input type="text" id="mlClassifierInput" placeholder="Classify expense (e.g. Swiggy, Uber, Netflix)..." style="flex:1; min-width:0; height:32px; font-size:12px; border-radius:8px; padding:0 10px; background:var(--card-bg, rgba(255,255,255,0.04)); border:1px solid var(--border); color:var(--text-main); outline:none;" />
                    <button type="button" id="mlClassifierBtn" class="btn-primary btn-small" style="height:32px; padding:0 12px; font-size:11.5px; border-radius:8px; flex-shrink:0;">Classify</button>
                </div>
                <div id="mlClassifierResult" style="margin-top:8px;">
                    <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap; font-size:11px; color:var(--text-muted);">
                        <span>Try:</span>
                        <span class="ml-sample-chip" data-sample="Swiggy meal" style="cursor:pointer; padding:2px 7px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border);">🍔 Swiggy</span>
                        <span class="ml-sample-chip" data-sample="Uber ride" style="cursor:pointer; padding:2px 7px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border);">🚗 Uber</span>
                        <span class="ml-sample-chip" data-sample="Netflix 4K" style="cursor:pointer; padding:2px 7px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border);">🎬 Netflix</span>
                        <span class="ml-sample-chip" data-sample="Electricity bill" style="cursor:pointer; padding:2px 7px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border);">⚡ Power</span>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
        wireClassifierCard(card);
    }

    // Wrap DashboardInsights.renderFinancialInsights if available
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

    // 9. PUBLIC API & DOM READY INITIALIZATION
    window.DashboardML = Object.freeze({
        classifyDescription,
        submitFeedbackRecord,
        resolveToCanonical,
        getTaxonomyItem,
        checkDuplicateExpense,
        onExpenseSaved,
        resetActiveSession,
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
