/**
 * @file mobile-app.js
 * @description Dedicated Native Mobile App Controller for Modern iOS & Android.
 * Provides a native-grade bottom navigation bar, quick-add action sheet,
 * active section observer, and mobile view mode switcher.
 */

(function () {
  'use strict';

  function isMobileViewport() {
    return window.innerWidth <= 768 || ('ontouchstart' in window && Math.max(window.innerWidth, window.innerHeight) <= 1024);
  }

  function initMobileApp() {
    if (!document.querySelector('.dashboard-container')) {
      return; // Only run on dashboard
    }

    injectMobileBottomNav();
    injectMobileActionSheet();
    injectMobileModeBadge();
    setupActiveSectionObserver();
  }

  function injectMobileModeBadge() {
    const heading = document.querySelector('.dashboard-heading');
    if (!heading || document.getElementById('mobileModeBadge')) return;

    const badge = document.createElement('a');
    badge.id = 'mobileModeBadge';
    badge.className = 'mobile-mode-badge';
    badge.href = 'legacy-mobile.html';
    badge.title = 'Switch to Lite / Feature Mobile Edition';
    badge.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
        <line x1="12" y1="18" x2="12.01" y2="18"></line>
      </svg>
      <span>Mobile Edition</span>
    `;
    heading.appendChild(badge);
  }

  function injectMobileBottomNav() {
    if (document.getElementById('mobileBottomNav')) return;

    const nav = document.createElement('nav');
    nav.id = 'mobileBottomNav';
    nav.className = 'mobile-bottom-nav';
    nav.setAttribute('aria-label', 'Mobile Bottom Navigation');
    nav.innerHTML = `
      <button type="button" class="mobile-nav-item active" data-target="overview" id="mobNavOverview">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <span>Overview</span>
      </button>

      <button type="button" class="mobile-nav-item" data-target="ledger" id="mobNavLedger">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"></line>
          <line x1="8" y1="12" x2="21" y2="12"></line>
          <line x1="8" y1="18" x2="21" y2="18"></line>
          <line x1="3" y1="6" x2="3.01" y2="6"></line>
          <line x1="3" y1="12" x2="3.01" y2="12"></line>
          <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
        <span>Ledger</span>
      </button>

      <button type="button" class="mobile-nav-fab" id="mobNavFab" aria-label="Quick Add Transaction">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      <button type="button" class="mobile-nav-item" data-target="analytics" id="mobNavAnalytics">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
        <span>Analytics</span>
      </button>

      <button type="button" class="mobile-nav-item" data-target="budgets" id="mobNavBudgets">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="6"></circle>
          <circle cx="12" cy="12" r="2"></circle>
        </svg>
        <span>Budgets</span>
      </button>
    `;

    document.body.appendChild(nav);
    wireBottomNavEvents(nav);
  }

  function injectMobileActionSheet() {
    if (document.getElementById('mobileActionSheetOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'mobileActionSheetOverlay';
    overlay.className = 'mobile-action-sheet-overlay';
    overlay.innerHTML = `
      <div class="mobile-action-sheet" role="dialog" aria-modal="true" aria-labelledby="mobSheetTitle">
        <div class="mobile-sheet-pill"></div>
        <div class="mobile-sheet-title" id="mobSheetTitle">Quick Transaction</div>
        <div class="mobile-sheet-options">
          <button type="button" class="mobile-sheet-btn" id="mobActionAddExpense">
            <div class="mobile-sheet-icon expense">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </div>
            <div class="mobile-sheet-text">
              <strong>Record Expense</strong>
              <span>Track an outflow from your accounts</span>
            </div>
          </button>

          <button type="button" class="mobile-sheet-btn" id="mobActionAddIncome">
            <div class="mobile-sheet-icon income">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </div>
            <div class="mobile-sheet-text">
              <strong>Record Income</strong>
              <span>Add salary, freelance, or dividend stream</span>
            </div>
          </button>
        </div>
        <button type="button" class="mobile-sheet-cancel" id="mobActionCancel">Cancel</button>
      </div>
    `;

    document.body.appendChild(overlay);

    // Close on backdrop tap or cancel
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.id === 'mobActionCancel') {
        closeMobileActionSheet();
      }
    });

    document.getElementById('mobActionAddExpense')?.addEventListener('click', () => {
      closeMobileActionSheet();
      const openBtn = document.getElementById('openModalBtn');
      if (openBtn) openBtn.click();
    });

    document.getElementById('mobActionAddIncome')?.addEventListener('click', () => {
      closeMobileActionSheet();
      const openBtn = document.getElementById('openIncomeModalBtn');
      if (openBtn) openBtn.click();
    });
  }

  function openMobileActionSheet() {
    const overlay = document.getElementById('mobileActionSheetOverlay');
    if (overlay) overlay.classList.add('active');
  }

  function closeMobileActionSheet() {
    const overlay = document.getElementById('mobileActionSheetOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  function scrollToSection(target) {
    let targetEl = null;
    if (target === 'overview') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    } else if (target === 'ledger') {
      targetEl = document.getElementById('unifiedLedgerCard') || document.querySelector('.unified-ledger-card') || document.getElementById('expenseList');
    } else if (target === 'analytics') {
      targetEl = document.getElementById('insightsPanel') || document.querySelector('.grid-analytics');
    } else if (target === 'budgets') {
      targetEl = document.querySelector('.budget-section') || document.getElementById('budgetList');
    }

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function setActiveNavItem(targetName) {
    const items = document.querySelectorAll('.mobile-nav-item');
    items.forEach(item => {
      if (item.getAttribute('data-target') === targetName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  function wireBottomNavEvents(nav) {
    nav.addEventListener('click', (e) => {
      const fab = e.target.closest('#mobNavFab');
      if (fab) {
        openMobileActionSheet();
        return;
      }

      const item = e.target.closest('.mobile-nav-item');
      if (item) {
        const target = item.getAttribute('data-target');
        setActiveNavItem(target);
        scrollToSection(target);
      }
    });
  }

  function setupActiveSectionObserver() {
    if (!('IntersectionObserver' in window)) return;

    const sections = [
      { id: 'overview', el: document.querySelector('.top-bar') || document.body },
      { id: 'analytics', el: document.getElementById('insightsPanel') || document.querySelector('.grid-analytics') },
      { id: 'budgets', el: document.querySelector('.budget-section') },
      { id: 'ledger', el: document.getElementById('unifiedLedgerCard') }
    ];

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
          const match = sections.find(s => s.el === entry.target);
          if (match) {
            setActiveNavItem(match.id);
          }
        }
      });
    }, {
      root: null,
      threshold: [0.3]
    });

    sections.forEach(s => {
      if (s.el) observer.observe(s.el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileApp);
  } else {
    initMobileApp();
  }
})();
