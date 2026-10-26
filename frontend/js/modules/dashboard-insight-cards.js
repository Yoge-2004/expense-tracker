/* ==========================================================================
   ENGINE-DRIVEN INSIGHT CARDS
   ==========================================================================

   Renders the output of InsightEngine (js/modules/insight-engine.js) into the
   existing insights grid.

   This module WRAPS the original renderFinancialInsights rather than
   replacing it. The original still renders its current-month summary cards
   exactly as before; these append after. Two reasons for wrapping instead
   of rewriting: the original file is being worked on in parallel, and
   keeping the existing cards intact means this can be reverted by removing
   one script tag if anything misbehaves.
   ========================================================================== */

(function () {
    "use strict";

    const engine = window.InsightEngine;
    const utils = window.DashboardUtils;
    if (!engine || !utils) return;

    const { formatCurrency, escapeHtml } = utils;

    /* Visual treatment per insight kind. Colours reuse the semantic tokens
       already defined in variables/tokens.css rather than introducing new
       hardcoded hex values. */
    const SVG_ICONS = {
        caution: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        positive: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        informational: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
        "month-over-month": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
        "projection": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></svg>',
        "temporal-pattern": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
        category: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
        anomaly: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
        recurring: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>',
        goal: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>'
    };

    const KIND_STYLE = {
        caution:       { icon: SVG_ICONS.caution, varName: "--metric-savings", fallback: "#F59E0B" },
        positive:      { icon: SVG_ICONS.positive, varName: "--metric-inflow",  fallback: "#10B981" },
        informational: { icon: SVG_ICONS.informational, varName: "--metric-netflow", fallback: "#3B82F6" }
    };

    function iconFor(insight) {
        if (SVG_ICONS[insight.id]) return SVG_ICONS[insight.id];
        if (insight.id.startsWith("category-trend")) return SVG_ICONS.category;
        if (insight.id.startsWith("anomaly")) return SVG_ICONS.anomaly;
        if (insight.id.startsWith("recurring")) return SVG_ICONS.recurring;
        if (insight.id.startsWith("goal")) return SVG_ICONS.goal;
        return KIND_STYLE[insight.kind]?.icon || SVG_ICONS.informational;
    }

    /* A moderate/low-confidence insight is labelled as such in the UI. The
       engine deliberately reports confidence; hiding it would undo the point
       of computing it. */
    function confidenceBadge(confidence) {
        if (confidence === "high") return "";
        const label = confidence === "low" ? "Early estimate" : "Provisional";
        return `<span class="insight-confidence-tag" data-confidence="${escapeHtml(confidence)}">${label}</span>`;
    }

    function titleFor(insight) {
        if (insight.id === "month-over-month") return "Versus Your Average";
        if (insight.id === "projection") return "Weighted Month-End Forecast";
        if (insight.id === "temporal-pattern") return "Spending Rhythm";
        if (insight.id.startsWith("category-trend")) return `${insight.category} Trend`;
        if (insight.id.startsWith("anomaly")) return "Unusual Charge";
        if (insight.id.startsWith("recurring")) return "Possible Subscription";
        if (insight.id.startsWith("goal")) return "Goal Trajectory";
        return "Insight";
    }

    /* Money inside engine summaries is left raw (the engine has no locale
       context by design). Re-render the bare integers through the app's
       currency formatter so they match the rest of the dashboard. */
    function withFormattedMoney(insight) {
        let text = insight.summary;
        if (insight.id === "projection" && Number.isFinite(insight.projected)) {
            text = `On your current pace, this month lands near <strong>${formatCurrency(insight.projected)}</strong> — weighted by which days you actually tend to spend on.`;
        }
        if (insight.id.startsWith("anomaly") && Number.isFinite(insight.categoryMean)) {
            text = `A ${escapeHtml(insight.category)} charge of <strong>${formatCurrency(insight.amount)}</strong> came in well above your usual for that category (typically around ${formatCurrency(insight.categoryMean)}).`;
        }
        if (insight.id.startsWith("recurring") && Number.isFinite(insight.averageAmount)) {
            text = `<strong>${escapeHtml(insight.label)}</strong> looks like a ${escapeHtml(insight.cadence)} charge of about ${formatCurrency(insight.averageAmount)} that isn't marked as recurring — ${insight.occurrences} occurrences so far.`;
        }
        return text;
    }

    function cardHtml(insight) {
        const style = KIND_STYLE[insight.kind] || KIND_STYLE.informational;
        const colour = `var(${style.varName}, ${style.fallback})`;
        return `
            <div class="insight-card-item insight-card-engine" data-insight-kind="${escapeHtml(insight.kind)}">
                <div class="insight-card-item-header">
                    <div class="insight-icon-box" style="background: color-mix(in srgb, ${colour} 15%, transparent); color: ${colour};">${iconFor(insight)}</div>
                    <span class="insight-card-label">${escapeHtml(titleFor(insight))}</span>
                    ${confidenceBadge(insight.confidence)}
                </div>
                <div class="insight-card-content">${withFormattedMoney(insight)}</div>
            </div>
        `;
    }

    function renderEngineCards(expenses, incomes, goals) {
        const grid = document.getElementById("insightsCardsGrid");
        if (!grid) return;

        /* Clear only our own cards, never the original renderer's. */
        grid.querySelectorAll(".insight-card-engine").forEach((n) => n.remove());

        let insights;
        try {
            insights = engine.generateInsights(
                { expenses: expenses || [], incomes: incomes || [], goals: goals || [] },
                new Date()
            );
        } catch (err) {
            /* An analysis failure must never take the dashboard down with it.
               The original cards are already rendered at this point. */
            console.error("Insight engine failed:", err);
            return;
        }

        if (!insights.length) return;

        /* Most actionable first: cautions, then by magnitude. */
        const rank = { caution: 0, positive: 1, informational: 2 };
        insights.sort((a, b) => {
            const r = (rank[a.kind] ?? 3) - (rank[b.kind] ?? 3);
            if (r !== 0) return r;
            return (b.magnitude || 0) - (a.magnitude || 0);
        });

        const frag = document.createElement("div");
        frag.innerHTML = insights.slice(0, 8).map(cardHtml).join("");
        grid.append(...frag.children);
    }

    /* --- wrap the original renderer -------------------------------------
       window.DashboardInsights is Object.freeze'd by its own module, so
       assigning to .renderFinancialInsights on it would throw here (this
       IIFE is strict-mode). Replace the whole namespace object with a new
       frozen one instead. dashboard.js resolves
       window.DashboardInsights.renderFinancialInsights at call time rather
       than capturing it at load, so the replacement is picked up. */
    const original = window.DashboardInsights && window.DashboardInsights.renderFinancialInsights;
    if (typeof original === "function") {
        window.DashboardInsights = Object.freeze({
            renderFinancialInsights: function (expenses, incomes, goals) {
                const result = original.apply(this, arguments);
                renderEngineCards(expenses, incomes, goals);
                return result;
            }
        });
    }

    window.DashboardInsightCards = { renderEngineCards };
})();
