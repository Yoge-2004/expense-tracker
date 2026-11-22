(function () {
      // In-memory / LocalStorage state store
      var STORAGE_KEY = "et_mobile_records_v1";
      var BUDGET_KEY = "et_mobile_budget_v1";
      var records = [];
      var budgetTarget = 0;
      var budgetStatusList = [];
      var savingsGoalsList = [];
      var currentView = "tx"; // "tx", "budgets", "goals", "reports"

      // Theme Adaptation Engine (Dark by default, unless explicitly set to 'light')
      try {
        var storedTheme = localStorage.getItem("theme");
        if (storedTheme === "light") {
          document.documentElement.setAttribute("data-theme", "light");
        } else {
          document.documentElement.setAttribute("data-theme", "dark");
        }
      } catch (e) {}

      // Feature Mobile Platform Detection & Softkey Bar Activation
      (function checkFeatureMobile() {
        var hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
        var screenWidth = (window.screen && window.screen.width) || window.innerWidth;
        var ua = navigator.userAgent || "";
        var isModernSmart = /iPhone|iPad|iPod/i.test(ua) || (/Android/i.test(ua) && !/KaiOS|KAIOS|Jio/i.test(ua) && (hasTouch || window.innerWidth > 320));
        var isFeature = !isModernSmart && (!hasTouch && Math.min(window.innerWidth, screenWidth) <= 320 || /KaiOS|KAIOS|Jio|FeaturePhone|Nokia8110|Nokia2720|Symbian|Series60|S60|BlackBerry|BB10|IEMobile|Windows CE|Windows Phone|Bada|BREW|Opera Mini/i.test(ua));
        if (isFeature) {
          document.body.className = (document.body.className + " is-feature-device").trim();
        }
      })();

      // Comprehensive Historical Legacy Mobile & Feature Phone Platform Detection
      function detectLegacyPlatform(customUa) {
        var str = customUa || navigator.userAgent || "";

        // 1. Apple iPhone OS / iOS (1.0 to modern)
        var iosMatch = str.match(/(?:iPhone OS|CPU iPhone OS|iPad.*OS|CPU OS)\s*([0-9._]+)/i);
        if (iosMatch) {
          var iosVer = iosMatch[1].replace(/_/g, ".");
          var majorIos = parseInt(iosVer.split(".")[0], 10);
          if (majorIos <= 1) return "iOS 1.0";
          if (majorIos === 2) return "iOS 2.0";
          if (majorIos === 3) return "iOS 3.0";
          if (majorIos <= 6) return "iOS " + majorIos + " (Classic)";
          if (majorIos <= 9) return "iOS " + majorIos + " (Legacy)";
          return "iOS " + iosVer;
        }
        if (/iPhone.*WebKit\/42/i.test(str)) return "iOS 1.0";
        if (/iPhone/i.test(str)) return "iPhone Web";

        // 2. Android (1.0 to 4.x legacy and beyond)
        var androidMatch = str.match(/Android\s*([0-9.]+)/i);
        if (androidMatch) {
          var aVer = androidMatch[1];
          var majorA = parseFloat(aVer);
          if (majorA <= 1.05) return "Android 1.0";
          if (majorA < 2.0) return "Android 1.x (Cupcake/Donut)";
          if (majorA < 3.0) return "Android 2.x (Eclair/Froyo/GB)";
          if (majorA < 4.0) return "Android 3.x (Honeycomb)";
          if (majorA < 5.0) return "Android 4.x (ICS/JB/KitKat)";
          return "Android " + aVer;
        }
        if (/Android.*WebKit\/525/i.test(str)) return "Android 1.0";

        // 3. Windows Mobile / Windows Phone / Windows CE
        if (/Windows Phone/i.test(str)) {
          var wpMatch = str.match(/Windows Phone\s*(?:OS\s*)?([0-9.]+)/i);
          return "Windows Phone " + (wpMatch ? wpMatch[1] : "7/8");
        }
        if (/Windows CE|Pocket PC|IEMobile/i.test(str)) return "Windows Mobile";

        // 4. BlackBerry
        if (/BB10|BlackBerry.*Version\/10/i.test(str)) return "BlackBerry 10";
        if (/BlackBerry/i.test(str) || /RIM Tablet/i.test(str) || /PlayBook/i.test(str)) {
          var bbMatch = str.match(/BlackBerry\s*([0-9]+)/i);
          var bbVerMatch = str.match(/Version\/([0-9.]+)/i);
          return "BlackBerry " + (bbMatch ? bbMatch[1] : (bbVerMatch ? "OS " + bbVerMatch[1] : "OS"));
        }

        // Microbrowsers (Opera Mini, Opera Mobi, UC Browser)
        if (/Opera Mini/i.test(str)) {
          var opMiniMatch = str.match(/Opera Mini\/([0-9.]+)/i);
          return "Opera Mini" + (opMiniMatch ? " " + opMiniMatch[1] : "");
        }
        if (/Opera Mobi/i.test(str)) return "Opera Mobile";
        if (/UCWEB|UCBrowser/i.test(str)) return "UC Browser";

        // 5. Symbian OS / Series 60 / S40 / Nokia Asha
        if (/Series60|S60/i.test(str)) {
          var s60Match = str.match(/Series60\/([0-9.]+)/i);
          return "Symbian S60" + (s60Match ? " v" + s60Match[1] : "");
        }
        if (/SymbianOS|SymbOS|Symbian/i.test(str)) return "Symbian OS";
        if (/Asha/i.test(str)) return "Nokia Asha";
        if (/Nokia/i.test(str)) {
          var nokiaMatch = str.match(/Nokia([A-Za-z0-9\-_]+)/i);
          return "Nokia " + (nokiaMatch ? nokiaMatch[1] : "Mobile");
        }

        // 6. Palm OS & HP / Palm webOS
        if (/webOS|hpwOS/i.test(str)) return "Palm webOS";
        if (/PalmOS|PalmSource|Blazer|Xiino/i.test(str)) return "Palm OS";

        // 7. Samsung Bada & Tizen
        if (/Bada[ \/]?([0-9.]*)/i.test(str)) {
          var badaMatch = str.match(/Bada[ \/]?([0-9.]*)/i);
          return "Samsung Bada" + (badaMatch && badaMatch[1] ? " " + badaMatch[1] : "");
        }
        if (/Tizen/i.test(str)) return "Samsung Tizen";

        // 8. MeeGo & Maemo
        if (/MeeGo/i.test(str)) return "MeeGo";
        if (/Maemo/i.test(str)) return "Nokia Maemo";

        // 9. KaiOS & JioPhone
        if (/KaiOS|KAIOS/i.test(str)) {
          var kaiMatch = str.match(/KaiOS\/([0-9.]+)/i);
          return "KaiOS" + (kaiMatch ? " " + kaiMatch[1] : "");
        }
        if (/Jio/i.test(str)) return "JioPhone";

        // 10. Feature Phone Chipsets & Microbrowsers
        if (/MAUI/i.test(str) || /MTK/i.test(str) || /MediaTek/i.test(str)) return "MediaTek MAUI";
        if (/BREW|Brew MP/i.test(str)) return "Qualcomm BREW";
        if (/NetFront/i.test(str)) return "Access NetFront";
        if (/UP\.Browser|UP\.Link|Openwave/i.test(str)) return "Openwave WAP";
        if (/Teleca|Obigo/i.test(str)) return "Teleca-Obigo";
        if (/SEMC-Browser|SonyEricsson/i.test(str)) return "Sony Ericsson";
        if (/MOT-|Motorola/i.test(str)) return "Motorola EZ";

        // 11. Handheld Gaming Consoles
        if (/PlayStation Portable|PSP/i.test(str)) return "PlayStation Portable";
        if (/PlayStation Vita/i.test(str)) return "PlayStation Vita";
        if (/Nintendo 3DS/i.test(str)) return "Nintendo 3DS";
        if (/Nintendo DSi/i.test(str)) return "Nintendo DSi";

        // 12. Fallbacks
        if (/Mobile|Handheld|MIDP|CLDC|WAP/i.test(str)) return "Feature Mobile";
        return "Legacy Mobile Web";
      }

      // Platform detection for badge
      var ua = navigator.userAgent || "";
      var badgeEl = document.getElementById("deviceBadge");
      var detectedPlatform = detectLegacyPlatform(ua);
      if (badgeEl) {
        badgeEl.innerHTML = esc(detectedPlatform);
      }
      try {
        document.body.setAttribute("data-os", detectedPlatform.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
      } catch (e) {}

      // ======================================================================
      // Feature Phone D-Pad Spatial Navigation & Physical Button Engine (ES3)
      // ======================================================================
      var softkeyLsk = document.getElementById("fpLsk");
      var softkeyCsk = document.getElementById("fpCsk");
      var softkeyRsk = document.getElementById("fpRsk");

      function getOpenModal() {
        var ids = ["expenseModal", "incomeModal", "loginModal", "budgetModal", "goalModal", "depositModal", "editTxModal"];
        var i;
        for (i = 0; i < ids.length; i++) {
          var m = document.getElementById(ids[i]);
          if (m && ((typeof m.open === "boolean" && m.open) || m.style.display === "block")) {
            return m;
          }
        }
        return null;
      }

      function showAppModal(modal) {
        if (!modal) return;
        modal._returnFocus = document.activeElement;
        if (typeof modal.showModal === "function") {
          if (!modal.open) modal.showModal();
          return;
        }

        if (modal.className.indexOf("modal-fallback") === -1) {
          modal.className += " modal-fallback";
        }
        modal.style.display = "block";
        var fields = modal.getElementsByTagName("input");
        var i;
        for (i = 0; i < fields.length; i++) {
          if (fields[i].type !== "hidden" && !fields[i].disabled) {
            try { fields[i].focus(); } catch (e) {}
            break;
          }
        }
      }

      function hideAppModal(modal) {
        if (!modal) return;
        if (typeof modal.close === "function" && modal.open) modal.close();
        else modal.style.display = "none";
        if (modal._returnFocus && modal._returnFocus.focus) {
          try { modal._returnFocus.focus(); } catch (e) {}
        }
        modal._returnFocus = null;
      }

      function updateSoftkeys() {
        var openModal = getOpenModal();
        if (openModal) {
          if (softkeyLsk) softkeyLsk.innerHTML = "Cancel";
          if (softkeyCsk) softkeyCsk.innerHTML = (openModal.id === "loginModal") ? "SIGN IN" : ((openModal.id === "depositModal") ? "DEPOSIT" : ((openModal.id === "editTxModal") ? "UPDATE" : "SAVE"));
          if (softkeyRsk) softkeyRsk.innerHTML = "Close";
          return;
        }

        var active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "SELECT" || active.tagName === "TEXTAREA")) {
          if (softkeyLsk) softkeyLsk.innerHTML = "Clear";
          if (softkeyCsk) softkeyCsk.innerHTML = "DONE";
          if (softkeyRsk) softkeyRsk.innerHTML = "Next";
          return;
        }

        if (currentView === "budgets") {
          if (softkeyLsk) softkeyLsk.innerHTML = "+ BUDGET [1]";
          if (softkeyCsk) softkeyCsk.innerHTML = "SELECT";
          if (softkeyRsk) softkeyRsk.innerHTML = "SYNC [9]";
        } else if (currentView === "goals") {
          if (softkeyLsk) softkeyLsk.innerHTML = "+ GOAL [1]";
          if (softkeyCsk) softkeyCsk.innerHTML = "SELECT";
          if (softkeyRsk) softkeyRsk.innerHTML = "SYNC [9]";
        } else if (currentView === "reports") {
          if (softkeyLsk) softkeyLsk.innerHTML = "CSV [1]";
          if (softkeyCsk) softkeyCsk.innerHTML = "SELECT";
          if (softkeyRsk) softkeyRsk.innerHTML = "SYNC [9]";
        } else {
          if (softkeyLsk) softkeyLsk.innerHTML = "+ EXPENSE [1]";
          if (softkeyCsk) softkeyCsk.innerHTML = "SELECT";
          if (softkeyRsk) softkeyRsk.innerHTML = "+ INCOME [2]";
        }
      }

      function getVisibleFocusables() {
        var openModal = getOpenModal();
        var root = openModal ? openModal : document.body;

        var tags = ["a", "button", "input", "select", "textarea"];
        var elements = [];
        var i, j;
        for (i = 0; i < tags.length; i++) {
          var found = root.getElementsByTagName(tags[i]);
          for (j = 0; j < found.length; j++) {
            var el = found[j];
            if (el.type === "hidden" || el.disabled) continue;
            if (el.offsetWidth === 0 && el.offsetHeight === 0 && el.style.display === "none") continue;
            elements.push(el);
          }
        }
        return elements;
      }

      function focusFpElement(el) {
        if (!el) return;
        var i;
        var all = getVisibleFocusables();
        for (i = 0; i < all.length; i++) {
          if (all[i].className) {
            all[i].className = all[i].className.replace(/\s*fp-focused\b/g, "");
          }
        }
        if (el.className) {
          el.className += " fp-focused";
        } else {
          el.className = "fp-focused";
        }
        try { el.focus(); } catch(e) {}
        try {
          if (el.scrollIntoView) {
            el.scrollIntoView(false);
          }
        } catch(e) {}
        updateSoftkeys();
      }

      function handleFpLsk() {
        var openModal = getOpenModal();
        if (openModal) {
          hideAppModal(openModal);
          updateSoftkeys();
          return;
        }

        var active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
          active.value = "";
          return;
        }

        if (currentView === "budgets") {
          var btnBud = document.getElementById("btnOpenBudgetModal");
          if (btnBud) btnBud.click();
        } else if (currentView === "goals") {
          var btnGoa = document.getElementById("btnOpenGoalModal");
          if (btnGoa) btnGoa.click();
        } else if (currentView === "reports") {
          var btnCsv = document.getElementById("btnExportCsv");
          if (btnCsv) btnCsv.click();
        } else {
          var btnExp = document.getElementById("btnOpenExpenseModal");
          if (btnExp) btnExp.click();
        }
        updateSoftkeys();
      }

      function handleFpCsk() {
        var openModal = getOpenModal();
        if (openModal) {
          if (openModal.id === "expenseModal") {
            var bSaveExp = document.getElementById("btnSaveExpense");
            if (bSaveExp) bSaveExp.click();
          } else if (openModal.id === "incomeModal") {
            var bSaveInc = document.getElementById("btnSaveIncome");
            if (bSaveInc) bSaveInc.click();
          } else if (openModal.id === "budgetModal") {
            var bSaveBud = document.getElementById("btnSaveBudget");
            if (bSaveBud) bSaveBud.click();
          } else if (openModal.id === "goalModal") {
            var bSaveGoa = document.getElementById("btnSaveGoal");
            if (bSaveGoa) bSaveGoa.click();
          } else if (openModal.id === "depositModal") {
            var bSaveDep = document.getElementById("btnSaveDeposit");
            if (bSaveDep) bSaveDep.click();
          } else if (openModal.id === "editTxModal") {
            var bSaveEdit = document.getElementById("btnSaveEditTx");
            if (bSaveEdit) bSaveEdit.click();
          } else if (openModal.id === "loginModal") {
            var bSubLog = document.getElementById("btnSubmitLogin");
            if (bSubLog) bSubLog.click();
          }
          updateSoftkeys();
          return;
        }

        var active = document.activeElement;
        if (active && active !== document.body) {
          if (typeof active.click === "function") {
            active.click();
            updateSoftkeys();
            return;
          }
        }

        var focusables = getVisibleFocusables();
        if (focusables.length > 0) {
          focusFpElement(focusables[0]);
        }
      }

      function handleFpRsk() {
        var openModal = getOpenModal();
        if (openModal) {
          hideAppModal(openModal);
          updateSoftkeys();
          return;
        }

        var active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "SELECT")) {
          var focusables = getVisibleFocusables();
          var idx = -1;
          for (var i = 0; i < focusables.length; i++) {
            if (focusables[i] === active) { idx = i; break; }
          }
          if (idx !== -1 && idx + 1 < focusables.length) {
            focusFpElement(focusables[idx + 1]);
          } else if (active.blur) {
            active.blur();
          }
          return;
        }

        if (currentView === "budgets" || currentView === "goals" || currentView === "reports") {
          var tSync = document.getElementById("tabRefresh");
          if (tSync) tSync.click();
        } else {
          var btnInc = document.getElementById("btnOpenIncomeModal");
          if (btnInc) btnInc.click();
        }
        updateSoftkeys();
      }

      // Wire softkey button clicks
      if (softkeyLsk) softkeyLsk.onclick = handleFpLsk;
      if (softkeyCsk) softkeyCsk.onclick = handleFpCsk;
      if (softkeyRsk) softkeyRsk.onclick = handleFpRsk;

      // Global Hardware Keyboard Listener for Physical Buttons / D-Pad
      document.onkeydown = function (e) {
        e = e || window.event;
        var code = e.keyCode || e.which || 0;
        var key = e.key || "";

        var isInput = false;
        var target = e.target || e.srcElement;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
          isInput = true;
        }

        if (isInput && code === 13) {
          var activeModal = getOpenModal();
          if (activeModal) {
            var submitButtonId = activeModal.id === "expenseModal" ? "btnSaveExpense"
              : activeModal.id === "incomeModal" ? "btnSaveIncome"
                : activeModal.id === "loginModal" ? "btnSubmitLogin"
                  : activeModal.id === "budgetModal" ? "btnSaveBudget"
                    : activeModal.id === "goalModal" ? "btnSaveGoal"
                      : activeModal.id === "depositModal" ? "btnSaveDeposit"
                        : "btnSaveEditTx";
            var submitButton = document.getElementById(submitButtonId);
            if (submitButton) {
              if (e.preventDefault) e.preventDefault();
              submitButton.click();
              return false;
            }
          }
        }

        if (target && target.getAttribute && target.getAttribute("role") === "tab"
            && (code === 37 || code === 38 || code === 39 || code === 40)) {
          var tabList = document.getElementById("bottomTabBar");
          var tabButtons = tabList ? tabList.getElementsByTagName("button") : [];
          var tabIndex = -1;
          var tabDelta = code === 37 || code === 38 ? -1 : 1;
          var tabNumber;
          for (tabNumber = 0; tabNumber < tabButtons.length; tabNumber++) {
            if (tabButtons[tabNumber] === target) {
              tabIndex = tabNumber;
              break;
            }
          }
          if (tabIndex !== -1 && tabButtons.length) {
            var nextTabIndex = (tabIndex + tabDelta + tabButtons.length) % tabButtons.length;
            if (e.preventDefault) e.preventDefault();
            tabButtons[nextTabIndex].focus();
            tabButtons[nextTabIndex].click();
            return false;
          }
        }

        // SoftLeft / F1 (code 403 / 112)
        if (key === "SoftLeft" || key === "F1" || code === 403 || code === 112) {
          if (e.preventDefault) e.preventDefault();
          handleFpLsk();
          return false;
        }
        // SoftRight / F2 (code 404 / 113)
        if (key === "SoftRight" || key === "F2" || code === 404 || code === 113) {
          if (e.preventDefault) e.preventDefault();
          handleFpRsk();
          return false;
        }
        // Center Select Key (code 13 / 29443) when not typing in input
        if ((key === "Enter" || code === 13 || code === 29443) && !isInput) {
          if (e.preventDefault) e.preventDefault();
          handleFpCsk();
          return false;
        }
        // Back / Escape / BrowserBack (code 461 / 27 / 8)
        if (key === "Escape" || key === "BrowserBack" || code === 27 || code === 461 || (code === 8 && !isInput)) {
          var om = getOpenModal();
          if (om) {
            if (e.preventDefault) e.preventDefault();
            hideAppModal(om);
            updateSoftkeys();
            return false;
          }
        }

        // Spatial D-Pad: Down (40), Up (38), Left (37), Right (39)
        if (!isInput && (code === 38 || code === 40 || code === 37 || code === 39)) {
          var focusables = getVisibleFocusables();
          if (focusables.length === 0) return true;

          var current = -1;
          for (var i = 0; i < focusables.length; i++) {
            if (focusables[i] === document.activeElement || (focusables[i].className && focusables[i].className.indexOf("fp-focused") !== -1)) {
              current = i;
              break;
            }
          }

          var next = current;
          if (code === 40 || code === 39) {
            next = current + 1;
            if (next >= focusables.length) next = 0;
          } else if (code === 38 || code === 37) {
            next = current - 1;
            if (next < 0) next = focusables.length - 1;
          }

          if (focusables[next]) {
            if (e.preventDefault) e.preventDefault();
            focusFpElement(focusables[next]);
            return false;
          }
        }

        // T9 Numeric Keypad Shortcuts (when not in an input field)
        if (!isInput) {
          if (key === "1" || code === 49) {
            if (e.preventDefault) e.preventDefault();
            handleFpLsk();
            return false;
          }
          if (key === "2" || code === 50) {
            if (e.preventDefault) e.preventDefault();
            var bInc = document.getElementById("btnOpenIncomeModal");
            if (bInc) bInc.click();
            updateSoftkeys();
            return false;
          }
          if (key === "3" || code === 51) {
            if (e.preventDefault) e.preventDefault();
            var tOver = document.getElementById("tabOverview");
            if (tOver) tOver.click();
            return false;
          }
          if (key === "4" || code === 52) {
            if (e.preventDefault) e.preventDefault();
            var tExp = document.getElementById("tabExpenses");
            if (tExp) tExp.click();
            return false;
          }
          if (key === "5" || code === 53) {
            if (e.preventDefault) e.preventDefault();
            var tInc = document.getElementById("tabIncome");
            if (tInc) tInc.click();
            return false;
          }
          if (key === "6" || code === 54) {
            if (e.preventDefault) e.preventDefault();
            var tBud = document.getElementById("tabBudgets");
            if (tBud) tBud.click();
            return false;
          }
          if (key === "7" || code === 55) {
            if (e.preventDefault) e.preventDefault();
            var tGoa = document.getElementById("tabGoals");
            if (tGoa) tGoa.click();
            return false;
          }
          if (key === "8" || code === 56) {
            if (e.preventDefault) e.preventDefault();
            var tRep = document.getElementById("tabReports");
            if (tRep) tRep.click();
            return false;
          }
          if (key === "9" || code === 57) {
            if (e.preventDefault) e.preventDefault();
            var tRef = document.getElementById("tabRefresh");
            if (tRef) tRef.click();
            return false;
          }
          if (key === "0" || code === 48) {
            if (e.preventDefault) e.preventDefault();
            var bAcc = document.getElementById("btnAccount");
            if (bAcc) bAcc.click();
            return false;
          }
          if (key === "*" || code === 106) {
            if (e.preventDefault) e.preventDefault();
            window.scrollTo(0, 0);
            return false;
          }
          if (key === "#" || code === 192) {
            if (e.preventDefault) e.preventDefault();
            alert("Feature Phone Keypad Guide:\n[1] Context Action (+Exp/+Bud/+Goal/CSV)\n[2] +Income\n[3] All Transactions\n[4] Expenses\n[5] Income\n[6] Budgets\n[7] Savings Goals\n[8] Reports\n[9] Sync\n[0] Account\n[D-Pad] Navigate\n[Enter/Center] Select");
            return false;
          }
        }
      };

      // Currency symbol resolver
      function getCurrencySymbol() {
        var code = "INR";
        try {
          if (window.localStorage) {
            code = window.localStorage.getItem("userCurrency") || "INR";
          }
        } catch (e) {}
        switch (code) {
          case "USD": return "$";
          case "EUR": return "\u20AC";
          case "GBP": return "\u00A3";
          case "JPY": return "\u00A5";
          case "CAD": return "CA$";
          case "AUD": return "A$";
          case "INR":
          default:
            return "\u20B9";
        }
      }

      // Format currency without Intl.NumberFormat dependency
      function formatMoney(amount) {
        var num = parseFloat(amount);
        if (isNaN(num)) {
          num = 0.0;
        }
        var fixed = num.toFixed(2);
        var parts = fixed.split(".");
        var intPart = parts[0];
        var decPart = parts.length > 1 ? "." + parts[1] : ".00";

        // Regex for comma separation
        var rgx = /(\d+)(\d{3})/;
        while (rgx.test(intPart)) {
          intPart = intPart.replace(rgx, "$1" + "," + "$2");
        }
        return getCurrencySymbol() + intPart + decPart;
      }

      // Escape text before putting it into innerHTML
      function esc(value) {
        return String(value === null || value === undefined ? "" : value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      // Safe ISO date string for ES3
      function getTodayDateString() {
        var now = new Date();
        var y = now.getFullYear();
        var m = now.getMonth() + 1;
        var d = now.getDate();
        var mStr = m < 10 ? "0" + m : "" + m;
        var dStr = d < 10 ? "0" + d : "" + d;
        return y + "-" + mStr + "-" + dStr;
      }

      // Safe storage reader/writer
      function loadRecords() {
        records = [];
        var raw = null;
        try {
          if (window.localStorage) {
            raw = window.localStorage.getItem(STORAGE_KEY);
            var rawBudget = window.localStorage.getItem(BUDGET_KEY);
            if (rawBudget) {
              budgetTarget = parseFloat(rawBudget) || 0;
            }
          }
        } catch (e) {
          raw = null;
        }

        if (raw) {
          try {
            records = JSON.parse(raw);
          } catch (e) {
            records = [];
          }
        }
        if (!records) {
          records = [];
        }
      }

      function saveRecords() {
        if (syncMode) {
          return; // server data is not copied into the offline notebook
        }
        try {
          if (window.localStorage) {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
          }
        } catch (e) {
          // In-memory fallback
        }
      }

      // Recalculate metrics and update DOM
      function updateSummary() {
        var totalInc = 0;
        var totalExp = 0;
        var i;
        for (i = 0; i < records.length; i++) {
          var item = records[i];
          var amt = parseFloat(item.amount) || 0;
          if (item.type === "INCOME") {
            totalInc += amt;
          } else {
            totalExp += amt;
          }
        }

        var net = totalInc - totalExp;

        var netEl = document.getElementById("netBalanceVal");
        var incEl = document.getElementById("totalIncomeVal");
        var expEl = document.getElementById("totalExpenseVal");
        var pBarEl = document.getElementById("budgetProgressBar");
        var bLabelEl = document.getElementById("budgetLabel");

        if (netEl) {
          netEl.innerHTML = formatMoney(net);
          netEl.style.color = net >= 0 ? "#ffffff" : "#ef4444";
        }
        if (incEl) {
          incEl.innerHTML = "+" + formatMoney(totalInc);
        }
        if (expEl) {
          expEl.innerHTML = "-" + formatMoney(totalExp);
        }

        if (pBarEl && bLabelEl) {
          var totalLimit = 0;
          var anyOver = false;
          if (syncMode && budgetStatusList && budgetStatusList.length > 0) {
            for (i = 0; i < budgetStatusList.length; i++) {
              var b = budgetStatusList[i];
              totalLimit += (parseFloat(b.limit) || 0);
              if ((parseFloat(b.spent) || 0) > (parseFloat(b.limit) || 0)) {
                anyOver = true;
              }
            }
          } else {
            totalLimit = budgetTarget;
          }

          if (totalLimit > 0) {
            var pct = Math.min(100, Math.round((totalExp / totalLimit) * 100));
            pBarEl.style.width = pct + "%";
            var barColor = (pct > 90 || anyOver) ? "#ef4444" : (pct > 70 ? "#f59e0b" : "#10b981");
            pBarEl.style.backgroundColor = barColor;
            var overBadge = anyOver || totalExp > totalLimit ? ' <span class="badge-overbudget">OVER BUDGET</span>' : '';
            bLabelEl.innerHTML = "Budget Target: " + pct + "% used (" + formatMoney(totalExp) + " / " + formatMoney(totalLimit) + ")" + overBadge;
          } else {
            pBarEl.style.width = "0%";
            bLabelEl.innerHTML = "Budget Target: No limit set (" + formatMoney(totalExp) + " spent)";
          }
        }
      }

      // Render transactions with filtering
      function renderTransactions() {
        var container = document.getElementById("txListContainer");
        if (!container) return;

        var searchVal = (document.getElementById("searchKeyword").value || "").toLowerCase();
        var typeFilter = document.getElementById("filterType").value || "ALL";

        var filtered = [];
        var i;
        for (i = 0; i < records.length; i++) {
          var r = records[i];
          if (typeFilter !== "ALL" && r.type !== typeFilter) {
            continue;
          }
          if (searchVal) {
            var titleLower = (r.title || "").toLowerCase();
            var catLower = (r.category || "").toLowerCase();
            if (titleLower.indexOf(searchVal) === -1 && catLower.indexOf(searchVal) === -1) {
              continue;
            }
          }
          filtered.push(r);
        }

        if (filtered.length === 0) {
          container.innerHTML = '<div class="empty-state">No matching transactions found.</div>';
          return;
        }

        var html = "";
        for (i = 0; i < filtered.length; i++) {
          var item = filtered[i];
          var isInc = item.type === "INCOME";
          var amtClass = isInc ? "tx-amount-inc" : "tx-amount-exp";
          var amtPrefix = isInc ? "+" : "-";

          html += '<div class="tx-item">';
          html += '  <div class="tx-left">';
          html += '    <div class="tx-title">' + esc(item.title || "Untitled") + '</div>';
          html += '    <div class="tx-meta">';
          html += '      <span class="tx-tag">' + esc(item.category || "General") + '</span>';
          html += '      <span>' + esc(item.date || "") + '</span>';
          html += '    </div>';
          html += '  </div>';
          html += '  <div class="tx-right">';
          html += '    <div class="' + amtClass + '">' + amtPrefix + formatMoney(item.amount) + '</div>';
          html += '    <div class="tx-actions">';
          html += '      <button type="button" class="tx-btn-edit" data-id="' + esc(item.id) + '">Edit</button>';
          html += '      <button type="button" class="tx-btn-del" data-id="' + esc(item.id) + '">Delete</button>';
          html += '    </div>';
          html += '  </div>';
          html += '</div>';
        }

        container.innerHTML = html;

        // Wire delete buttons using classical DOM
        var delButtons = container.getElementsByClassName ? container.getElementsByClassName("tx-btn-del") : [];
        for (i = 0; i < delButtons.length; i++) {
          delButtons[i].onclick = function () {
            var delId = this.getAttribute("data-id");
            if (confirm("Delete this transaction?")) {
              deleteRecord(delId);
            }
          };
        }

        // Wire edit buttons
        var editButtons = container.getElementsByClassName ? container.getElementsByClassName("tx-btn-edit") : [];
        for (i = 0; i < editButtons.length; i++) {
          editButtons[i].onclick = function () {
            var editId = this.getAttribute("data-id");
            openEditTxModal(editId);
          };
        }
      }

      function openEditTxModal(id) {
        var target = null;
        var i;
        for (i = 0; i < records.length; i++) {
          if (String(records[i].id) === String(id)) {
            target = records[i];
            break;
          }
        }
        if (!target) return;

        var modal = document.getElementById("editTxModal");
        if (!modal) return;

        document.getElementById("editTxId").value = target.id;
        document.getElementById("editTxType").value = target.type;
        document.getElementById("editTxDescription").value = target.title || "";
        document.getElementById("editTxAmount").value = target.amount || "";
        document.getElementById("editTxDate").value = target.date || "";

        var catSel = document.getElementById("editTxCategory");
        if (catSel) {
          catSel.value = target.category || "";
        }

        showAppModal(modal);
        updateSoftkeys();
      }

      function deleteRecord(id) {
        var next = [];
        var target = null;
        var i;
        for (i = 0; i < records.length; i++) {
          if (String(records[i].id) !== String(id)) {
            next.push(records[i]);
          } else {
            target = records[i];
          }
        }
        if (syncMode && target) {
          var kind = target.type === "INCOME" ? "/incomes/" : "/expenses/";
          apiCall("DELETE", kind + target.serverId + "/user/" + session.userId, null, function (status) {
            if (status === 200 || status === 204) {
              refreshFromServer();
            } else if (status !== 401) {
              alert("Could not delete (" + status + "). Please try again.");
            }
          });
          return;
        }
        records = next;
        saveRecords();
        updateSummary();
        renderTransactions();
      }

      // Render category budgets view
      function renderBudgets() {
        var container = document.getElementById("budgetListContainer");
        if (!container) return;

        if (!budgetStatusList || budgetStatusList.length === 0) {
          container.innerHTML = '<div class="empty-state">No category budgets configured yet. Tap + Set Budget to begin.</div>';
          return;
        }

        var html = "";
        var i;
        for (i = 0; i < budgetStatusList.length; i++) {
          var b = budgetStatusList[i];
          var limit = parseFloat(b.limit) || 0;
          var spent = parseFloat(b.spent) || 0;
          var pct = Math.round(b.percentage || (limit > 0 ? (spent / limit) * 100 : 0));
          var isOver = spent > limit || pct > 100;
          var badgeHtml = isOver ? '<span class="badge-overbudget">OVER BUDGET (' + pct + '%)</span>' : '<span class="badge-ontrack">' + pct + '% ON TRACK</span>';
          var barWidth = Math.min(100, Math.max(0, pct));
          var barColor = isOver ? '#ef4444' : (pct > 80 ? '#f59e0b' : '#10b981');

          html += '<div class="budget-card">';
          html += '  <div class="card-header-row">';
          html += '    <span class="card-header-title">' + esc(b.categoryName || "Category") + '</span>';
          html += '    <span class="card-header-action">';
          html += '      ' + badgeHtml;
          html += '      <button type="button" class="btn-xs btn-xs-rose btn-del-budget" data-catid="' + esc(b.categoryId) + '" style="margin-left:6px;">Delete</button>';
          html += '    </span>';
          html += '  </div>';
          html += '  <div style="font-size:12px; margin-bottom:4px; color:#d1cbba;">';
          html += '    Spent: <strong>' + formatMoney(spent) + '</strong> &bull; Limit: <strong>' + formatMoney(limit) + '</strong>';
          html += '  </div>';
          html += '  <div class="progress-bar-bg">';
          html += '    <div class="progress-bar-fill" style="width:' + barWidth + '%; background-color:' + barColor + ';"></div>';
          html += '  </div>';
          html += '</div>';
        }

        container.innerHTML = html;

        // Wire budget delete buttons
        var delBudgetBtns = container.getElementsByClassName ? container.getElementsByClassName("btn-del-budget") : [];
        for (i = 0; i < delBudgetBtns.length; i++) {
          delBudgetBtns[i].onclick = function () {
            var catId = this.getAttribute("data-catid");
            if (!confirm("Delete budget for this category?")) return;
            if (syncMode && session) {
              apiCall("DELETE", "/expenses/budget/user/" + session.userId + "/category/" + catId, null, function (status) {
                if (status === 200 || status === 204) {
                  refreshFromServer();
                } else if (status !== 401) {
                  alert("Could not delete budget (" + status + ").");
                }
              });
            } else {
              var nextBudgets = [];
              for (var j = 0; j < budgetStatusList.length; j++) {
                if (String(budgetStatusList[j].categoryId) !== String(catId)) {
                  nextBudgets.push(budgetStatusList[j]);
                }
              }
              budgetStatusList = nextBudgets;
              renderBudgets();
              updateSummary();
            }
          };
        }
      }

      // Render savings goals view
      function renderGoals() {
        var container = document.getElementById("goalsListContainer");
        if (!container) return;

        if (!savingsGoalsList || savingsGoalsList.length === 0) {
          container.innerHTML = '<div class="empty-state">No savings goals tracked yet. Tap + New Goal to begin.</div>';
          return;
        }

        var html = "";
        var i;
        for (i = 0; i < savingsGoalsList.length; i++) {
          var g = savingsGoalsList[i];
          var target = parseFloat(g.targetAmount) || 0;
          var cur = parseFloat(g.currentAmount) || 0;
          var pct = target > 0 ? Math.min(100, Math.round((cur / target) * 100)) : 0;
          var isDone = g.status === "COMPLETED" || pct >= 100;
          var badgeClass = isDone ? "badge-ontrack" : "badge-overbudget";
          var badgeText = isDone ? "COMPLETED" : "IN PROGRESS (" + pct + "%)";
          var barColor = isDone ? "#10b981" : "#0284c7";

          html += '<div class="goal-card">';
          html += '  <div class="card-header-row">';
          html += '    <span class="card-header-title">' + esc(g.name || "Savings Goal") + '</span>';
          html += '    <span class="card-header-action">';
          html += '      <span class="' + badgeClass + '" style="' + (isDone ? '' : 'background-color:#1e3a8a; color:#93c5fd;') + '">' + badgeText + '</span>';
          html += '      <button type="button" class="btn-xs btn-xs-emerald btn-dep-goal" data-id="' + esc(g.id) + '" data-name="' + esc(g.name) + '" style="margin-left:6px;">+ Deposit</button>';
          html += '      <button type="button" class="btn-xs btn-xs-rose btn-del-goal" data-id="' + esc(g.id) + '" style="margin-left:4px;">Delete</button>';
          html += '    </span>';
          html += '  </div>';
          html += '  <div style="font-size:12px; margin-bottom:4px; color:#d1cbba;">';
          html += '    Saved: <strong>' + formatMoney(cur) + '</strong> &bull; Target: <strong>' + formatMoney(target) + '</strong>';
          html += '  </div>';
          html += '  <div class="progress-bar-bg">';
          html += '    <div class="progress-bar-fill" style="width:' + pct + '%; background-color:' + barColor + ';"></div>';
          html += '  </div>';
          if (g.targetDate) {
            html += '  <div style="font-size:10px; color:#8e8b80; margin-top:4px;">Target Date: ' + esc(g.targetDate) + '</div>';
          }
          html += '</div>';
        }

        container.innerHTML = html;

        // Wire deposit buttons
        var depBtns = container.getElementsByClassName ? container.getElementsByClassName("btn-dep-goal") : [];
        for (i = 0; i < depBtns.length; i++) {
          depBtns[i].onclick = function () {
            var gId = this.getAttribute("data-id");
            var gName = this.getAttribute("data-name");
            var depModal = document.getElementById("depositModal");
            if (depModal) {
              document.getElementById("depositGoalId").value = gId;
              document.getElementById("depositGoalTitle").innerHTML = "Goal: " + esc(gName);
              document.getElementById("depositAmount").value = "";
              showAppModal(depModal);
              updateSoftkeys();
            }
          };
        }

        // Wire goal delete buttons
        var delGoalBtns = container.getElementsByClassName ? container.getElementsByClassName("btn-del-goal") : [];
        for (i = 0; i < delGoalBtns.length; i++) {
          delGoalBtns[i].onclick = function () {
            var gId = this.getAttribute("data-id");
            if (!confirm("Delete this savings goal?")) return;
            if (syncMode && session) {
              apiCall("DELETE", "/savings/goals/" + gId + "/user/" + session.userId, null, function (status) {
                if (status === 200 || status === 204) {
                  refreshFromServer();
                } else if (status !== 401) {
                  alert("Could not delete savings goal (" + status + ").");
                }
              });
            } else {
              var nextGoals = [];
              for (var j = 0; j < savingsGoalsList.length; j++) {
                if (String(savingsGoalsList[j].id) !== String(gId)) {
                  nextGoals.push(savingsGoalsList[j]);
                }
              }
              savingsGoalsList = nextGoals;
              renderGoals();
            }
          };
        }
      }

      // Render reports & breakdown view
      function renderReports() {
        var container = document.getElementById("reportsContainer");
        if (!container) return;

        var totalInc = 0;
        var totalExp = 0;
        var catTotals = {};
        var i;

        for (i = 0; i < records.length; i++) {
          var item = records[i];
          var amt = parseFloat(item.amount) || 0;
          if (item.type === "INCOME") {
            totalInc += amt;
          } else {
            totalExp += amt;
            var catName = item.category || "General";
            catTotals[catName] = (catTotals[catName] || 0) + amt;
          }
        }

        var net = totalInc - totalExp;
        var savingsRate = totalInc > 0 ? Math.max(0, Math.round((net / totalInc) * 100)) : 0;

        var html = "";
        html += '<div class="section-title">Cashflow Summary</div>';
        html += '<table class="report-table">';
        html += '  <thead><tr><th>Metric</th><th style="text-align:right;">Amount</th></tr></thead>';
        html += '  <tbody>';
        html += '    <tr><td>Total Inflows (Income)</td><td style="text-align:right; color:#10b981; font-weight:700;">+' + formatMoney(totalInc) + '</td></tr>';
        html += '    <tr><td>Total Outflows (Expenses)</td><td style="text-align:right; color:#ef4444; font-weight:700;">-' + formatMoney(totalExp) + '</td></tr>';
        html += '    <tr><td>Net Cashflow</td><td style="text-align:right; font-weight:700; color:' + (net >= 0 ? '#ffffff' : '#ef4444') + ';">' + formatMoney(net) + '</td></tr>';
        html += '    <tr><td>Savings Rate</td><td style="text-align:right; font-weight:700; color:#c79a3e;">' + savingsRate + '%</td></tr>';
        html += '  </tbody>';
        html += '</table>';

        html += '<div class="section-title">Expense Breakdown By Category</div>';
        var catKeys = [];
        for (var k in catTotals) {
          if (Object.prototype.hasOwnProperty.call(catTotals, k)) {
            catKeys.push(k);
          }
        }

        catKeys.sort(function (a, b) {
          return catTotals[b] - catTotals[a];
        });

        if (catKeys.length === 0) {
          html += '<div class="empty-state">No expense records found to generate category report.</div>';
        } else {
          html += '<table class="report-table">';
          html += '  <thead><tr><th>Category</th><th style="text-align:right;">Spent</th><th style="text-align:right;">Share</th></tr></thead>';
          html += '  <tbody>';
          for (i = 0; i < catKeys.length; i++) {
            var cName = catKeys[i];
            var cAmt = catTotals[cName];
            var cPct = totalExp > 0 ? Math.round((cAmt / totalExp) * 100) : 0;
            html += '  <tr>';
            html += '    <td><strong>' + esc(cName) + '</strong></td>';
            html += '    <td style="text-align:right; color:#ef4444; font-weight:700;">' + formatMoney(cAmt) + '</td>';
            html += '    <td style="text-align:right; color:#c79a3e;">' + cPct + '%</td>';
            html += '  </tr>';
          }
          html += '  </tbody>';
          html += '</table>';
        }

        container.innerHTML = html;
      }

      // Offline & Online CSV Ledger Exporter
      function exportCsvLedger() {
        if (!records || records.length === 0) {
          alert("No transactions available to export.");
          return;
        }

        var csv = "Date,Type,Category,Description,Amount\r\n";
        var i;
        for (i = 0; i < records.length; i++) {
          var r = records[i];
          var date = (r.date || "").replace(/"/g, '""');
          var type = (r.type || "").replace(/"/g, '""');
          var cat = (r.category || "").replace(/"/g, '""');
          var desc = (r.title || "").replace(/"/g, '""');
          var amt = parseFloat(r.amount) || 0;
          csv += '"' + date + '","' + type + '","' + cat + '","' + desc + '","' + amt.toFixed(2) + '"\r\n';
        }

        try {
          var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url;
          a.download = "ledger-" + getTodayDateString() + ".csv";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          alert("Ledger exported successfully (" + records.length + " transactions).");
        } catch (e) {
          // Fallback data URI for classic webkit
          var uri = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
          window.open(uri, "_blank");
        }
      }

      // View switching controller
      function updateTabSelection(tab, selected) {
        if (!tab) return;
        tab.className = "tab-item" + (selected ? " active" : "");
        tab.setAttribute("aria-selected", selected ? "true" : "false");
        tab.tabIndex = selected ? 0 : -1;
      }

      function setPanelVisibility(panel, visible) {
        if (!panel) return;
        panel.hidden = !visible;
        panel.className = "view-section" + (visible ? " active" : "");
        panel.setAttribute("aria-hidden", visible ? "false" : "true");
      }

      function switchView(viewName) {
        currentView = viewName;

        var vt = document.getElementById("viewTransactions");
        var vb = document.getElementById("viewBudgets");
        var vg = document.getElementById("viewGoals");
        var vr = document.getElementById("viewReports");

        setPanelVisibility(vt, viewName === "tx");
        setPanelVisibility(vb, viewName === "budgets");
        setPanelVisibility(vg, viewName === "goals");
        setPanelVisibility(vr, viewName === "reports");

        var tabOver = document.getElementById("tabOverview");
        var tabExp = document.getElementById("tabExpenses");
        var tabInc = document.getElementById("tabIncome");
        var tabBud = document.getElementById("tabBudgets");
        var tabGoa = document.getElementById("tabGoals");
        var tabRep = document.getElementById("tabReports");

        var fType = (document.getElementById("filterType") ? document.getElementById("filterType").value : "ALL");
        updateTabSelection(tabOver, viewName === "tx" && fType === "ALL");
        updateTabSelection(tabExp, viewName === "tx" && fType === "EXPENSE");
        updateTabSelection(tabInc, viewName === "tx" && fType === "INCOME");
        updateTabSelection(tabBud, viewName === "budgets");
        updateTabSelection(tabGoa, viewName === "goals");
        updateTabSelection(tabRep, viewName === "reports");

        var transactionTab = viewName === "tx" && fType === "EXPENSE" ? tabExp
          : viewName === "tx" && fType === "INCOME" ? tabInc
            : viewName === "tx" ? tabOver
              : viewName === "budgets" ? tabBud
                : viewName === "goals" ? tabGoa : tabRep;
        var panel = viewName === "tx" ? vt : (viewName === "budgets" ? vb : (viewName === "goals" ? vg : vr));
        if (panel && transactionTab) panel.setAttribute("aria-labelledby", transactionTab.id);

        if (viewName === "budgets") {
          renderBudgets();
        } else if (viewName === "goals") {
          renderGoals();
        } else if (viewName === "reports") {
          renderReports();
        } else {
          renderTransactions();
        }

        updateSoftkeys();
      }

      // Wire modal events
      function setupModals() {
        var expModal = document.getElementById("expenseModal");
        var incModal = document.getElementById("incomeModal");
        var budModal = document.getElementById("budgetModal");
        var goaModal = document.getElementById("goalModal");
        var depModal = document.getElementById("depositModal");
        var editModal = document.getElementById("editTxModal");
        var modalIds = ["expenseModal", "incomeModal", "loginModal", "budgetModal", "goalModal", "depositModal", "editTxModal"];
        var modalIndex;
        for (modalIndex = 0; modalIndex < modalIds.length; modalIndex++) {
          var modalElement = document.getElementById(modalIds[modalIndex]);
          if (modalElement) {
            modalElement.onclick = function (event) {
              event = event || window.event;
              if ((event.target || event.srcElement) === this) {
                hideAppModal(this);
                updateSoftkeys();
              }
            };
            modalElement.onclose = updateSoftkeys;
          }
        }

        var fExp = document.getElementById("formExpense");
        if (fExp) fExp.onsubmit = function () { return false; };
        var fInc = document.getElementById("formIncome");
        if (fInc) fInc.onsubmit = function () { return false; };
        var fBud = document.getElementById("formBudget");
        if (fBud) fBud.onsubmit = function () { return false; };
        var fGoa = document.getElementById("formGoal");
        if (fGoa) fGoa.onsubmit = function () { return false; };
        var fDep = document.getElementById("formDeposit");
        if (fDep) fDep.onsubmit = function () { return false; };
        var fEdit = document.getElementById("formEditTx");
        if (fEdit) fEdit.onsubmit = function () { return false; };
        var fLog = document.getElementById("formLogin");
        if (fLog) fLog.onsubmit = function () { return false; };

        // 1. Add Expense
        var btnOpenExp = document.getElementById("btnOpenExpenseModal");
        var btnCloseExp = document.getElementById("btnCloseExpenseModal");
        var btnSaveExp = document.getElementById("btnSaveExpense");

        if (btnOpenExp) {
          btnOpenExp.onclick = function () {
            document.getElementById("expDate").value = getTodayDateString();
            showAppModal(expModal);
            updateSoftkeys();
          };
        }
        if (btnCloseExp) {
          btnCloseExp.onclick = function () {
            hideAppModal(expModal);
            updateSoftkeys();
          };
        }
        if (btnSaveExp) {
          btnSaveExp.onclick = function () {
            var desc = document.getElementById("expDescription").value;
            var amt = parseFloat(document.getElementById("expAmount").value);
            var cat = document.getElementById("expCategory").value;
            var date = document.getElementById("expDate").value || getTodayDateString();

            if (!desc || isNaN(amt) || amt <= 0) {
              alert("Please enter a valid description and amount.");
              return;
            }

            if (syncMode && session) {
              var catId = parseInt(cat, 10);
              if (isNaN(catId)) {
                alert("Please choose a category.");
                return;
              }
              if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                alert("Date must look like 2026-11-18.");
                return;
              }
              apiCall("POST", "/expenses/user/" + session.userId,
                { amount: amt, description: desc, expenseDate: date, categoryId: catId, isRecurring: false },
                function (status) {
                  if (status === 200 || status === 201) {
                    document.getElementById("expDescription").value = "";
                    document.getElementById("expAmount").value = "";
                    hideAppModal(expModal);
                    refreshFromServer();
                  } else if (status !== 401) {
                    alert("Could not save (" + status + "). Please try again.");
                  }
                });
              return;
            }

            var newRecord = {
              id: new Date().getTime(),
              type: "EXPENSE",
              title: desc,
              amount: amt,
              category: cat,
              date: date
            };

            records.unshift(newRecord);
            saveRecords();
            updateSummary();
            renderTransactions();

            document.getElementById("expDescription").value = "";
            document.getElementById("expAmount").value = "";
            hideAppModal(expModal);
            updateSoftkeys();
          };
        }

        // 2. Add Income
        var btnOpenInc = document.getElementById("btnOpenIncomeModal");
        var btnCloseInc = document.getElementById("btnCloseIncomeModal");
        var btnSaveInc = document.getElementById("btnSaveIncome");

        if (btnOpenInc) {
          btnOpenInc.onclick = function () {
            document.getElementById("incDate").value = getTodayDateString();
            showAppModal(incModal);
            updateSoftkeys();
          };
        }
        if (btnCloseInc) {
          btnCloseInc.onclick = function () {
            hideAppModal(incModal);
            updateSoftkeys();
          };
        }
        if (btnSaveInc) {
          btnSaveInc.onclick = function () {
            var src = document.getElementById("incSource").value;
            var amt = parseFloat(document.getElementById("incAmount").value);
            var cat = document.getElementById("incCategory").value;
            var date = document.getElementById("incDate").value || getTodayDateString();

            if (!src || isNaN(amt) || amt <= 0) {
              alert("Please enter a valid source and amount.");
              return;
            }

            if (syncMode && session) {
              if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                alert("Date must look like 2026-11-18.");
                return;
              }
              apiCall("POST", "/incomes/user/" + session.userId,
                { source: src, amount: amt, incomeDate: date, description: "", isRecurring: false,
                  kind: "", countsTowardMonth: "", reimbursedCategoryId: 0 },
                function (status) {
                  if (status === 200 || status === 201) {
                    document.getElementById("incSource").value = "";
                    document.getElementById("incAmount").value = "";
                    hideAppModal(incModal);
                    refreshFromServer();
                  } else if (status !== 401) {
                    alert("Could not save (" + status + "). Please try again.");
                  }
                });
              return;
            }

            var newRecord = {
              id: new Date().getTime(),
              type: "INCOME",
              title: src,
              amount: amt,
              category: cat,
              date: date
            };

            records.unshift(newRecord);
            saveRecords();
            updateSummary();
            renderTransactions();

            document.getElementById("incSource").value = "";
            document.getElementById("incAmount").value = "";
            hideAppModal(incModal);
            updateSoftkeys();
          };
        }

        // 3. Set Category Budget
        var btnOpenBud = document.getElementById("btnOpenBudgetModal");
        var btnCloseBud = document.getElementById("btnCloseBudgetModal");
        var btnSaveBud = document.getElementById("btnSaveBudget");

        if (btnOpenBud) {
          btnOpenBud.onclick = function () {
            showAppModal(budModal);
            updateSoftkeys();
          };
        }
        if (btnCloseBud) {
          btnCloseBud.onclick = function () {
            hideAppModal(budModal);
            updateSoftkeys();
          };
        }
        if (btnSaveBud) {
          btnSaveBud.onclick = function () {
            var catVal = document.getElementById("budgetCategory").value;
            var limitVal = parseFloat(document.getElementById("budgetLimit").value);

            if (!catVal || isNaN(limitVal) || limitVal <= 0) {
              alert("Please select a valid category and enter a positive monthly limit.");
              return;
            }

            if (syncMode && session) {
              var catId = parseInt(catVal, 10);
              apiCall("POST", "/expenses/budget/user/" + session.userId,
                { categoryId: catId, limitAmount: limitVal },
                function (status) {
                  if (status === 200 || status === 201) {
                    document.getElementById("budgetLimit").value = "";
                    hideAppModal(budModal);
                    refreshFromServer();
                  } else if (status !== 401) {
                    alert("Could not save budget (" + status + ").");
                  }
                });
              return;
            }

            // Local fallback budget tracking
            budgetTarget = limitVal;
            try {
              if (window.localStorage) {
                window.localStorage.setItem(BUDGET_KEY, String(budgetTarget));
              }
            } catch (e) {}
            hideAppModal(budModal);
            updateSummary();
            renderBudgets();
            updateSoftkeys();
          };
        }

        // 4. Create Savings Goal
        var btnOpenGoa = document.getElementById("btnOpenGoalModal");
        var btnCloseGoa = document.getElementById("btnCloseGoalModal");
        var btnSaveGoa = document.getElementById("btnSaveGoal");

        if (btnOpenGoa) {
          btnOpenGoa.onclick = function () {
            showAppModal(goaModal);
            updateSoftkeys();
          };
        }
        if (btnCloseGoa) {
          btnCloseGoa.onclick = function () {
            hideAppModal(goaModal);
            updateSoftkeys();
          };
        }
        if (btnSaveGoa) {
          btnSaveGoa.onclick = function () {
            var gName = document.getElementById("goalName").value;
            var gTarget = parseFloat(document.getElementById("goalTarget").value);
            var gDate = document.getElementById("goalDate").value || "";

            if (!gName || isNaN(gTarget) || gTarget <= 0) {
              alert("Please enter a valid goal name and target amount.");
              return;
            }

            if (syncMode && session) {
              apiCall("POST", "/savings/goals/user/" + session.userId,
                { name: gName, targetAmount: gTarget, targetDate: gDate || null, status: "IN_PROGRESS", isRecurring: false },
                function (status) {
                  if (status === 200 || status === 201) {
                    document.getElementById("goalName").value = "";
                    document.getElementById("goalTarget").value = "";
                    document.getElementById("goalDate").value = "";
                    hideAppModal(goaModal);
                    refreshFromServer();
                  } else if (status !== 401) {
                    alert("Could not create savings goal (" + status + ").");
                  }
                });
              return;
            }

            var newGoal = {
              id: new Date().getTime(),
              name: gName,
              targetAmount: gTarget,
              currentAmount: 0,
              targetDate: gDate,
              status: "IN_PROGRESS"
            };
            savingsGoalsList.unshift(newGoal);
            document.getElementById("goalName").value = "";
            document.getElementById("goalTarget").value = "";
            document.getElementById("goalDate").value = "";
            hideAppModal(goaModal);
            renderGoals();
            updateSoftkeys();
          };
        }

        // 5. Deposit to Goal
        var btnCloseDep = document.getElementById("btnCloseDepositModal");
        var btnSaveDep = document.getElementById("btnSaveDeposit");

        if (btnCloseDep) {
          btnCloseDep.onclick = function () {
            hideAppModal(depModal);
            updateSoftkeys();
          };
        }
        if (btnSaveDep) {
          btnSaveDep.onclick = function () {
            var gId = document.getElementById("depositGoalId").value;
            var depAmt = parseFloat(document.getElementById("depositAmount").value);

            if (isNaN(depAmt) || depAmt <= 0) {
              alert("Please enter a positive deposit amount.");
              return;
            }

            if (syncMode && session) {
              apiCall("POST", "/savings/goals/" + gId + "/deposit/user/" + session.userId,
                { amount: depAmt },
                function (status) {
                  if (status === 200 || status === 201) {
                    document.getElementById("depositAmount").value = "";
                    hideAppModal(depModal);
                    refreshFromServer();
                  } else if (status !== 401) {
                    alert("Could not apply deposit (" + status + ").");
                  }
                });
              return;
            }

            for (var j = 0; j < savingsGoalsList.length; j++) {
              if (String(savingsGoalsList[j].id) === String(gId)) {
                savingsGoalsList[j].currentAmount = (savingsGoalsList[j].currentAmount || 0) + depAmt;
                if (savingsGoalsList[j].currentAmount >= savingsGoalsList[j].targetAmount) {
                  savingsGoalsList[j].status = "COMPLETED";
                }
                break;
              }
            }
            hideAppModal(depModal);
            renderGoals();
            updateSoftkeys();
          };
        }

        // 6. Edit Transaction
        var btnCloseEdit = document.getElementById("btnCloseEditModal");
        var btnSaveEdit = document.getElementById("btnSaveEditTx");

        if (btnCloseEdit) {
          btnCloseEdit.onclick = function () {
            hideAppModal(editModal);
            updateSoftkeys();
          };
        }
        if (btnSaveEdit) {
          btnSaveEdit.onclick = function () {
            var editId = document.getElementById("editTxId").value;
            var editType = document.getElementById("editTxType").value;
            var desc = document.getElementById("editTxDescription").value;
            var amt = parseFloat(document.getElementById("editTxAmount").value);
            var cat = document.getElementById("editTxCategory").value;
            var date = document.getElementById("editTxDate").value || getTodayDateString();

            if (!desc || isNaN(amt) || amt <= 0) {
              alert("Please enter a valid description and amount.");
              return;
            }

            var target = null;
            for (var i = 0; i < records.length; i++) {
              if (String(records[i].id) === String(editId)) {
                target = records[i];
                break;
              }
            }
            if (!target) return;

            if (syncMode && session) {
              if (editType === "EXPENSE") {
                var catId = parseInt(cat, 10);
                if (isNaN(catId) && categories.length > 0) {
                  for (var c = 0; c < categories.length; c++) {
                    if (categories[c].name === cat) {
                      catId = categories[c].id;
                      break;
                    }
                  }
                }
                apiCall("PUT", "/expenses/" + target.serverId + "/user/" + session.userId,
                  { amount: amt, description: desc, expenseDate: date, categoryId: catId, isRecurring: false },
                  function (status) {
                    if (status === 200 || status === 204) {
                      hideAppModal(editModal);
                      refreshFromServer();
                    } else if (status !== 401) {
                      alert("Could not update expense (" + status + ").");
                    }
                  });
              } else {
                apiCall("PUT", "/incomes/" + target.serverId + "/user/" + session.userId,
                  { source: desc, amount: amt, incomeDate: date, description: "", isRecurring: false,
                    kind: "", countsTowardMonth: "", reimbursedCategoryId: 0 },
                  function (status) {
                    if (status === 200 || status === 204) {
                      hideAppModal(editModal);
                      refreshFromServer();
                    } else if (status !== 401) {
                      alert("Could not update income (" + status + ").");
                    }
                  });
              }
              return;
            }

            target.title = desc;
            target.amount = amt;
            target.category = cat;
            target.date = date;
            saveRecords();
            updateSummary();
            renderTransactions();
            hideAppModal(editModal);
            updateSoftkeys();
          };
        }

        // 7. CSV Export
        var btnExpCsv = document.getElementById("btnExportCsv");
        if (btnExpCsv) {
          btnExpCsv.onclick = exportCsvLedger;
        }
      }

      // Wire search and filters
      function setupFilters() {
        var searchInput = document.getElementById("searchKeyword");
        var filterSelect = document.getElementById("filterType");

        if (searchInput) {
          searchInput.onkeyup = function () {
            renderTransactions();
          };
        }
        if (filterSelect) {
          filterSelect.onchange = function () {
            switchView("tx");
          };
        }
      }

      // Wire bottom tab navigation
      function setupTabs() {
        var tabOverview = document.getElementById("tabOverview");
        var tabExpenses = document.getElementById("tabExpenses");
        var tabIncome = document.getElementById("tabIncome");
        var tabBudgets = document.getElementById("tabBudgets");
        var tabGoals = document.getElementById("tabGoals");
        var tabReports = document.getElementById("tabReports");
        var tabRefresh = document.getElementById("tabRefresh");

        if (tabOverview) {
          tabOverview.onclick = function () {
            if (document.getElementById("filterType")) document.getElementById("filterType").value = "ALL";
            switchView("tx");
          };
        }
        if (tabExpenses) {
          tabExpenses.onclick = function () {
            if (document.getElementById("filterType")) document.getElementById("filterType").value = "EXPENSE";
            switchView("tx");
          };
        }
        if (tabIncome) {
          tabIncome.onclick = function () {
            if (document.getElementById("filterType")) document.getElementById("filterType").value = "INCOME";
            switchView("tx");
          };
        }
        if (tabBudgets) {
          tabBudgets.onclick = function () {
            switchView("budgets");
          };
        }
        if (tabGoals) {
          tabGoals.onclick = function () {
            switchView("goals");
          };
        }
        if (tabReports) {
          tabReports.onclick = function () {
            switchView("reports");
          };
        }
        if (tabRefresh) {
          tabRefresh.onclick = function () {
            if (session) {
              refreshFromServer(function (ok) {
                alert(ok ? "Synced with your account." : "Could not reach your account. Showing what is on this device.");
              });
              return;
            }
            // Not signed in: check for REST API connectivity via XMLHttpRequest
            var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : (window.ActiveXObject ? new ActiveXObject("Microsoft.XMLHTTP") : null);
            if (xhr) {
              xhr.open("GET", "/api/health", true);
              xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                  alert("Local state synchronized. Backend status: " + (xhr.status === 200 ? "Online" : "Offline / Standalone"));
                }
              };
              try {
                xhr.send(null);
              } catch (e) {
                alert("Offline Standalone Mode active.");
              }
            } else {
              alert("State refreshed.");
            }
          };
        }
      }

      // ---- Account: uses the same sign-in as the main app (same browser storage) and the same API ----
      var API = window.BrowserSession ? window.BrowserSession.apiBaseUrl : "/api";
      var session = null;      // { userId, name } while signed in
      var syncMode = false;    // true while the list shows server data
      var categories = [];     // server categories: [{ id, name }]
      var defaultExpenseOptions = "";

      function readSession() {
        try {
          var u = window.localStorage.getItem("userId");
          if (u) {
            return { userId: u, name: window.localStorage.getItem("userName") || "" };
          }
        } catch (e) {
          // storage blocked
        }
        return null;
      }

      function apiCall(method, path, body, callback) {
        var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : null;
        if (!xhr) {
          callback(0, null);
          return;
        }
        try {
          xhr.open(method, API + path, true);
          xhr.setRequestHeader("Accept", "application/json");
          if (body) {
            xhr.setRequestHeader("Content-Type", "application/json");
          }
          if (window.BrowserSession) {
            window.BrowserSession.configureXhr(xhr, method, API + path);
          }
          xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) {
              return;
            }
            var data = null;
            try {
              data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
            } catch (e) {
              data = null;
            }
            if (xhr.status === 401 && session) {
              signOut(true);
            }
            callback(xhr.status, data);
          };
          xhr.send(body ? JSON.stringify(body) : null);
        } catch (e) {
          callback(0, null);
        }
      }

      function renderAccountBar() {
        var text = document.getElementById("accountText");
        var btn = document.getElementById("btnAccount");
        if (!text || !btn) {
          return;
        }
        if (syncMode) {
          text.textContent = "Signed in" + (session && session.name ? " as " + session.name : "") + ". Showing your account.";
          btn.innerHTML = "Sign out";
        } else if (session) {
          text.textContent = "Signed in, but your data could not be loaded.";
          btn.innerHTML = "Retry";
        } else {
          text.textContent = "Not signed in. Entries stay on this device.";
          btn.innerHTML = "Sign in";
        }
      }

      function fillExpenseCategories() {
        var sel = document.getElementById("expCategory");
        var editSel = document.getElementById("editTxCategory");
        var budSel = document.getElementById("budgetCategory");

        var html = "";
        var i;
        if (syncMode && categories.length) {
          for (i = 0; i < categories.length; i++) {
            html += '<option value="' + esc(categories[i].id) + '">' + esc(categories[i].name) + '</option>';
          }
        } else {
          html = defaultExpenseOptions;
        }

        if (sel) sel.innerHTML = html;
        if (editSel) editSel.innerHTML = html;
        if (budSel) {
          budSel.innerHTML = '<option value="">Select Category</option>' + html;
        }
      }

      function showAll() {
        updateSummary();
        if (currentView === "budgets") renderBudgets();
        else if (currentView === "goals") renderGoals();
        else if (currentView === "reports") renderReports();
        else renderTransactions();
        renderAccountBar();
        fillExpenseCategories();
      }

      // Loads categories, expenses, incomes, budgets, and savings goals. done(true) when lists arrived.
      function loadFromServer(done) {
        var pending = 5;
        var failed = false;
        var exp = [];
        var inc = [];
        var budgets = [];
        var goals = [];

        function finish() {
          pending--;
          if (pending > 0) {
            return;
          }
          if (failed || !session) {
            done(false);
            return;
          }
          var list = [];
          var i;
          for (i = 0; i < exp.length; i++) {
            list.push({
              id: "e" + exp[i].id, serverId: exp[i].id, type: "EXPENSE",
              title: exp[i].description || exp[i].categoryName || "Expense",
              amount: exp[i].amount, category: exp[i].categoryName || "General", date: exp[i].expenseDate || ""
            });
          }
          for (i = 0; i < inc.length; i++) {
            list.push({
              id: "i" + inc[i].id, serverId: inc[i].id, type: "INCOME",
              title: inc[i].source || inc[i].description || "Income",
              amount: inc[i].amount, category: inc[i].kind || "Income", date: inc[i].incomeDate || ""
            });
          }
          list.sort(function (a, b) {
            return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0);
          });
          records = list;
          budgetStatusList = budgets;
          savingsGoalsList = goals;
          done(true);
        }

        apiCall("GET", "/categories/user/" + session.userId, null, function (status, data) {
          if (status === 200 && data && data.length !== undefined) {
            categories = data;
          }
          finish();
        });
        apiCall("GET", "/expenses/user/" + session.userId, null, function (status, data) {
          if (status === 200 && data && data.length !== undefined) {
            exp = data;
          } else {
            failed = true;
          }
          finish();
        });
        apiCall("GET", "/incomes/user/" + session.userId, null, function (status, data) {
          if (status === 200 && data && data.length !== undefined) {
            inc = data;
          } else {
            failed = true;
          }
          finish();
        });
        apiCall("GET", "/expenses/budget/status/user/" + session.userId, null, function (status, data) {
          if (status === 200 && data && data.length !== undefined) {
            budgets = data;
          }
          finish();
        });
        apiCall("GET", "/savings/goals/user/" + session.userId, null, function (status, data) {
          if (status === 200 && data && data.length !== undefined) {
            goals = data;
          }
          finish();
        });
      }

      function refreshFromServer(after) {
        if (!session) {
          return;
        }
        loadFromServer(function (ok) {
          if (ok) {
            syncMode = true;
          } else if (session) {
            syncMode = false;
            loadRecords();
          }
          showAll();
          if (after) {
            after(ok);
          }
        });
      }

      function signOut(expired) {
        if (window.BrowserSession) window.BrowserSession.logout();
        else try { window.localStorage.removeItem("userId"); } catch (e) {}
        session = null;
        syncMode = false;
        categories = [];
        budgetStatusList = [];
        savingsGoalsList = [];
        loadRecords();
        showAll();
        if (expired) {
          alert("Your session expired. Please sign in again.");
        }
      }

      function setupAccount() {
        var btn = document.getElementById("btnAccount");
        var modal = document.getElementById("loginModal");
        var closeBtn = document.getElementById("btnCloseLoginModal");
        var submitBtn = document.getElementById("btnSubmitLogin");
        var errEl = document.getElementById("loginError");
        if (!btn || !modal) {
          return;
        }
        btn.onclick = function () {
          if (syncMode) {
            signOut(false);
          } else if (session) {
            refreshFromServer();
          } else {
            errEl.textContent = "";
            showAppModal(modal);
            updateSoftkeys();
          }
        };
        closeBtn.onclick = function () {
          hideAppModal(modal);
          updateSoftkeys();
        };
        submitBtn.onclick = function () {
          var who = document.getElementById("loginEmail").value;
          var pass = document.getElementById("loginPassword").value;
          if (!who || !pass) {
            errEl.textContent = "Enter your email or username and your password.";
            return;
          }
          errEl.textContent = "Signing in...";
          apiCall("POST", "/auth/login", { email: who, password: pass }, function (status, data) {
            if (status === 200 && data && data.userId) {
              if (window.BrowserSession) window.BrowserSession.storeProfile(data);
              session = { userId: String(data.userId), name: data.name || "" };
              document.getElementById("loginPassword").value = "";
              hideAppModal(modal);
              refreshFromServer();
            } else if (status === 401 || status === 400) {
              errEl.textContent = "Wrong email, username or password.";
            } else if (status === 429) {
              errEl.textContent = "Too many attempts. Wait a minute and try again.";
            } else if (status === 0) {
              errEl.textContent = "Cannot reach the server. Check your connection.";
            } else {
              errEl.textContent = "Sign-in failed (" + status + ").";
            }
          });
        };
      }

      // Boot application
      var expSelect = document.getElementById("expCategory");
      defaultExpenseOptions = expSelect ? expSelect.innerHTML : "";
      session = readSession();
      loadRecords();
      updateSummary();
      renderTransactions();
      setupModals();
      setupFilters();
      setupTabs();
      setupAccount();
      renderAccountBar();
      if (session) {
        refreshFromServer();
      }

      // Export for testing
      window.ExpenseTrackerMobile = {
        getRecords: function () { return records; },
        addRecord: function (r) { records.unshift(r); saveRecords(); updateSummary(); renderTransactions(); },
        deleteRecord: deleteRecord,
        formatMoney: formatMoney,
        detectPlatform: detectLegacyPlatform,
        updateSoftkeys: updateSoftkeys,
        handleLsk: handleFpLsk,
        handleCsk: handleFpCsk,
        handleRsk: handleFpRsk,
        focusElement: focusFpElement,
        switchView: switchView,
        renderBudgets: renderBudgets,
        renderGoals: renderGoals,
        renderReports: renderReports,
        exportCsvLedger: exportCsvLedger,
        getBudgetStatus: function () { return budgetStatusList; },
        getSavingsGoals: function () { return savingsGoalsList; },
        openEditTxModal: openEditTxModal
      };
    })();
