/**
 * @file feature-phone.js
 * @description Native-grade physical button & D-Pad navigation engine for Feature Phones
 * (KaiOS, JioPhone, Nokia 8110 4G, Nokia 2720, Symbian, Opera Mini, and 240x320 QVGA screens).
 *
 * Capabilities:
 * - Automatic spatial D-Pad navigation (ArrowUp, ArrowDown, ArrowLeft, ArrowRight).
 * - Smooth contextual scrolling keeping active focus centered.
 * - Hardware Softkey interception (SoftLeft / F1, SoftRight / F2, Center Key / Enter).
 * - Contextual 3-key Softkey Bar (LSK, Center, RSK).
 * - T9 Numeric Keypad shortcuts.
 */

(function () {
  'use strict';

  // Feature phone detection. A feature phone is recognised by its browser (KaiOS, Jio, Opera Mini and so on) or
  // by a tiny screen WITHOUT touch. A plain width check is wrong: many ordinary phones are exactly 360 CSS pixels
  // wide, and any phone can be held in landscape (about 360px high). Those must get the normal app.
  const hasTouch = () => 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  const isFeatureViewport = () => {
    const screenWidth = (window.screen && window.screen.width) || window.innerWidth;
    return !hasTouch() && Math.min(window.innerWidth, screenWidth) <= 320;
  };
  const isKaiOsOrFeature = () => {
    const ua = navigator.userAgent || '';
    return /KaiOS|KAIOS|Jio|FeaturePhone|Nokia|Symbian|Series60|S60|BlackBerry|BB10|IEMobile|Windows CE|Windows Phone|Bada|Tizen|webOS|PalmOS|MeeGo|Maemo|MAUI|MTK|MediaTek|BREW|Opera Mini|Opera Mobi|UCWEB|UCBrowser|NetFront|Openwave|UP\.Browser|Obigo|Teleca|SEMC/i.test(ua);
  };
  const isFeatureDevice = () => isFeatureViewport() || isKaiOsOrFeature();

  let softkeyBarEl = null;
  let lskEl = null;
  let cskEl = null;
  let rskEl = null;

  // Track current focus index in spatial navigation
  let currentFocusable = [];
  let currentIndex = -1;

  function queryFocusables() {
    const selector = [
      'button:not([disabled]):not([aria-hidden="true"])',
      'a[href]:not([aria-hidden="true"])',
      'input:not([disabled]):not([type="hidden"]):not([aria-hidden="true"])',
      'select:not([disabled]):not([aria-hidden="true"])',
      'textarea:not([disabled]):not([aria-hidden="true"])',
      '[tabindex="0"]:not([aria-hidden="true"])',
      '[role="button"]:not([aria-hidden="true"])'
    ].join(', ');

    // If an open modal exists, confine navigation to that modal
    const openModal = document.querySelector('.modal.show, .modal[style*="display: block"], .accessible-dialog-overlay.active');
    const root = openModal || document.body;

    const nodes = Array.from(root.querySelectorAll(selector));
    return nodes.filter(el => {
      if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });
  }

  function focusElement(el) {
    if (!el) return;
    el.focus();
    el.classList.add('fp-focused');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    updateSoftkeyContext(el);
  }

  function initSoftkeyBar() {
    if (softkeyBarEl) return;

    softkeyBarEl = document.createElement('footer');
    softkeyBarEl.className = 'feature-phone-softkeys';
    softkeyBarEl.setAttribute('role', 'region');
    softkeyBarEl.setAttribute('aria-label', 'Feature Phone Softkeys');

    lskEl = document.createElement('span');
    lskEl.className = 'fp-lsk';
    lskEl.textContent = 'Menu';
    lskEl.onclick = handleLeftSoftkey;

    cskEl = document.createElement('span');
    cskEl.className = 'fp-csk';
    cskEl.textContent = 'SELECT';
    cskEl.onclick = handleCenterSoftkey;

    rskEl = document.createElement('span');
    rskEl.className = 'fp-rsk';
    rskEl.textContent = 'Actions';
    rskEl.onclick = handleRightSoftkey;

    softkeyBarEl.appendChild(lskEl);
    softkeyBarEl.appendChild(cskEl);
    softkeyBarEl.appendChild(rskEl);

    document.body.appendChild(softkeyBarEl);
    syncSoftkeyBar();
  }

  /** Shows the softkey bar (and the space reserved for it) on feature phones only. */
  function syncSoftkeyBar() {
    if (!softkeyBarEl) return;
    const feature = isFeatureDevice();
    softkeyBarEl.classList.toggle('fp-auto-hidden', !feature);
    document.body.classList.toggle('has-softkey-bar', feature);
  }

  function updateSoftkeyContext(activeEl) {
    if (!softkeyBarEl) return;

    const openModal = document.querySelector('.modal.show, .modal[style*="display: block"], .accessible-dialog-overlay.active');
    if (openModal) {
      if (lskEl) lskEl.textContent = 'Back';
      if (cskEl) cskEl.textContent = 'Submit';
      if (rskEl) rskEl.textContent = 'Close';
      return;
    }

    if (!activeEl) activeEl = document.activeElement;

    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      if (lskEl) lskEl.textContent = 'Clear';
      if (cskEl) cskEl.textContent = 'Done';
      if (rskEl) rskEl.textContent = 'Next';
      return;
    }

    // Default dashboard / landing softkeys
    const hasAddExpense = !!document.getElementById('openModalBtn');
    if (hasAddExpense) {
      if (lskEl) lskEl.textContent = '+ Expense';
      if (cskEl) cskEl.textContent = 'SELECT';
      if (rskEl) rskEl.textContent = '+ Income';
    } else {
      if (lskEl) lskEl.textContent = 'Home';
      if (cskEl) cskEl.textContent = 'SELECT';
      if (rskEl) rskEl.textContent = 'Options';
    }
  }

  function handleLeftSoftkey() {
    const openModal = document.querySelector('.modal.show, .modal[style*="display: block"], .accessible-dialog-overlay.active');
    if (openModal) {
      const closeBtn = openModal.querySelector('.modal-close, .btn-secondary, [data-dismiss="modal"]');
      if (closeBtn) closeBtn.click();
      return;
    }

    const expBtn = document.getElementById('openModalBtn');
    if (expBtn) {
      expBtn.click();
      return;
    }

    // Otherwise go home or back
    if (window.location.pathname.indexOf('index.html') === -1) {
      window.location.href = 'index.html';
    }
  }

  function handleCenterSoftkey() {
    const active = document.activeElement;
    if (active && active !== document.body) {
      if (typeof active.click === 'function') {
        active.click();
        return;
      }
    }

    // Otherwise click the first submit button in open modal
    const openModal = document.querySelector('.modal.show, .modal[style*="display: block"], .accessible-dialog-overlay.active');
    if (openModal) {
      const submit = openModal.querySelector('button[type="submit"], .btn-primary');
      if (submit) submit.click();
    }
  }

  function handleRightSoftkey() {
    const openModal = document.querySelector('.modal.show, .modal[style*="display: block"], .accessible-dialog-overlay.active');
    if (openModal) {
      const closeBtn = openModal.querySelector('.modal-close, .btn-secondary');
      if (closeBtn) closeBtn.click();
      return;
    }

    const incBtn = document.getElementById('openIncomeModalBtn');
    if (incBtn) {
      incBtn.click();
      return;
    }

    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      themeBtn.click();
    }
  }

  // ── Global Keyboard Listener for Physical Buttons / D-Pad ──
  window.addEventListener('keydown', function (e) {
    // These keys only mean something on a feature phone. On phones, tablets and computers they would steal
    // F1 and F2, the arrow keys (page scrolling, dropdowns) and the number keys.
    if (!isFeatureDevice()) return;

    const key = e.key;
    const code = e.keyCode || e.which;

    // Feature phone hardware softkeys (KaiOS / Symbian)
    // SoftLeft: Key 'SoftLeft', 'F1', or code 112
    if (key === 'SoftLeft' || key === 'F1' || code === 112) {
      e.preventDefault();
      handleLeftSoftkey();
      return;
    }

    // SoftRight: Key 'SoftRight', 'F2', or code 113
    if (key === 'SoftRight' || key === 'F2' || code === 113) {
      e.preventDefault();
      handleRightSoftkey();
      return;
    }

    // Back key on feature phones (Backspace outside inputs, Escape, BrowserBack, or code 461)
    if (key === 'Escape' || code === 461 || (key === 'Backspace' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName))) {
      const openModal = document.querySelector('.modal.show, .modal[style*="display: block"], .accessible-dialog-overlay.active');
      if (openModal) {
        e.preventDefault();
        const closeBtn = openModal.querySelector('.modal-close, .btn-secondary');
        if (closeBtn) closeBtn.click();
        return;
      }
    }

    // D-Pad Arrow Navigation
    if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      // Show softkeys if hidden
      if (softkeyBarEl) softkeyBarEl.classList.remove('fp-auto-hidden');

      currentFocusable = queryFocusables();
      if (currentFocusable.length === 0) return;

      currentIndex = currentFocusable.indexOf(document.activeElement);

      if (key === 'ArrowDown') {
        e.preventDefault();
        currentIndex = (currentIndex + 1) % currentFocusable.length;
        focusElement(currentFocusable[currentIndex]);
      } else if (key === 'ArrowUp') {
        e.preventDefault();
        currentIndex = (currentIndex - 1 + currentFocusable.length) % currentFocusable.length;
        focusElement(currentFocusable[currentIndex]);
      } else if (key === 'ArrowRight' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        currentIndex = (currentIndex + 1) % currentFocusable.length;
        focusElement(currentFocusable[currentIndex]);
      } else if (key === 'ArrowLeft' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        currentIndex = (currentIndex - 1 + currentFocusable.length) % currentFocusable.length;
        focusElement(currentFocusable[currentIndex]);
      }
      return;
    }

    // Numeric keypad shortcuts (when not typing in an input field)
    if (!['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      if (key === '1') {
        const exp = document.getElementById('openModalBtn');
        if (exp) { e.preventDefault(); exp.click(); }
      } else if (key === '2') {
        const inc = document.getElementById('openIncomeModalBtn');
        if (inc) { e.preventDefault(); inc.click(); }
      } else if (key === '3') {
        const expTab = document.getElementById('tabBtnExpenses');
        if (expTab) { e.preventDefault(); expTab.click(); }
      } else if (key === '4') {
        const incTab = document.getElementById('tabBtnIncome');
        if (incTab) { e.preventDefault(); incTab.click(); }
      } else if (key === '0') {
        if (softkeyBarEl) {
          softkeyBarEl.classList.toggle('fp-auto-hidden');
        }
      }
    }
  });

  // Keep softkeys context up to date on focus changes
  document.addEventListener('focusin', function (e) {
    updateSoftkeyContext(e.target);
  });

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSoftkeyBar);
  } else {
    initSoftkeyBar();
  }

  // Handle window resize dynamically
  window.addEventListener('resize', syncSoftkeyBar);

  window.FeaturePhoneEngine = {
    init: initSoftkeyBar,
    updateSoftkeys: updateSoftkeyContext,
    focusNext: () => {
      const list = queryFocusables();
      if (list.length > 0) focusElement(list[0]);
    }
  };
})();
