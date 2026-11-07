// ─── Two-phase signup: send OTP (when enabled) → verify OTP → create account ───

let otpTimerInterval = null;
let emailVerificationRequired = false; // Default false (for HF spaces / dev), updated dynamically via /auth/config

async function initAuthConfig() {
    try {
        const config = await apiRequest('/auth/config', { method: 'GET' });
        if (config && typeof config.emailVerificationEnabled === 'boolean') {
            emailVerificationRequired = config.emailVerificationEnabled;
        }
    } catch (e) {
        console.warn('Could not fetch auth config, defaulting to direct registration:', e);
        emailVerificationRequired = false;
    }

    const sendBtn = document.getElementById('sendOtpBtn');
    const regBtn  = document.getElementById('registerBtn');
    const otpGrp  = document.getElementById('otpGroup');

    if (!emailVerificationRequired) {
        // Direct registration mode
        if (sendBtn) sendBtn.style.display = 'none';
        if (otpGrp)  otpGrp.style.display  = 'none';
        if (regBtn)  regBtn.style.display  = '';
    } else {
        // OTP verification required
        if (sendBtn) sendBtn.style.display = '';
        if (otpGrp)  otpGrp.style.display  = 'none';
        if (regBtn)  regBtn.style.display  = 'none';
    }
}

document.addEventListener('DOMContentLoaded', initAuthConfig);

function startOtpTimer(seconds) {
    const timerEl = document.getElementById('otpTimer');
    if (!timerEl) return;
    clearInterval(otpTimerInterval);
    let remaining = seconds;
    function tick() {
        if (remaining <= 0) {
            clearInterval(otpTimerInterval);
            timerEl.textContent = 'Code expired — please resend';
            timerEl.style.color = '#A23E32';
            return;
        }
        const m = Math.floor(remaining / 60).toString().padStart(2, '0');
        const s = (remaining % 60).toString().padStart(2, '0');
        timerEl.textContent = `Expires in ${m}:${s}`;
        timerEl.style.color = '';
        remaining--;
    }
    tick();
    otpTimerInterval = setInterval(tick, 1000);
}

async function doSendOtp() {
    const sendBtn  = document.getElementById('sendOtpBtn');
    const name     = document.getElementById('reg-name').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    // Basic client-side validation before hitting the API
    if (!name || name.length < 2) {
        showToast('Please enter a valid full name (min 2 characters).', 'error');
        document.getElementById('reg-name').classList.add('is-invalid');
        return;
    }
    if (!email || !/^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(email.trim())) {
        showToast('Please enter a valid email address.', 'error');
        document.getElementById('reg-email').classList.add('is-invalid');
        return;
    }
    if (!password || password.length < 8) {
        showToast('Password must be at least 8 characters long.', 'error');
        document.getElementById('reg-password').classList.add('is-invalid');
        return;
    }

    sendBtn.disabled = true;
    sendBtn.querySelector('span').textContent = 'Sending…';
    try {
        const res = await apiRequest('/auth/signup/send-otp', {
            method: 'POST',
            body: JSON.stringify({ email, name }),
        });

        if (res && (res.emailVerificationEnabled === false || res.emailVerificationEnabled === 'false')) {
            emailVerificationRequired = false;
            showToast('Email verification is not required. Click Create Account to finish.', 'info');
            document.getElementById('otpGroup').style.display = 'none';
            document.getElementById('registerBtn').style.display = '';
            sendBtn.style.display = 'none';
            return;
        }

        showToast(`Verification code sent to ${email}`, 'success');

        // Reveal OTP field + submit button, hide Send OTP button
        document.getElementById('otpGroup').style.display = '';
        document.getElementById('registerBtn').style.display = '';
        sendBtn.style.display = 'none';
        document.getElementById('reg-otp').focus();
        startOtpTimer(600); // 10 minutes
    } catch (error) {
        showToast(error.message || 'Could not send verification code.', 'error');
        sendBtn.disabled = false;
        sendBtn.querySelector('span').textContent = 'Send Verification Code';
    }
}

// Send OTP button
document.getElementById('sendOtpBtn')?.addEventListener('click', doSendOtp);

// Resend OTP button
document.getElementById('resendOtpBtn')?.addEventListener('click', async () => {
    const resendBtn = document.getElementById('resendOtpBtn');
    resendBtn.disabled = true;
    const name  = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    try {
        await apiRequest('/auth/signup/send-otp', {
            method: 'POST',
            body: JSON.stringify({ email, name }),
        });
        showToast(`New code sent to ${email}`, 'success');
        document.getElementById('reg-otp').value = '';
        startOtpTimer(600);
    } catch (error) {
        showToast(error.message || 'Could not resend code.', 'error');
    } finally {
        resendBtn.disabled = false;
    }
});

// Final registration submit
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('registerBtn');
    if (submitBtn?.disabled) return;

    const name        = document.getElementById('reg-name').value.trim();
    const username    = document.getElementById('reg-username').value.trim();
    const email       = document.getElementById('reg-email').value.trim();
    const password    = document.getElementById('reg-password').value;
    const securityPin = (document.getElementById('reg-security-pin')?.value || '').trim();
    const otp         = (document.getElementById('reg-otp')?.value || '').trim();
    const currency    = document.getElementById('reg-currency')?.value || 'INR';

    if (!/^[a-zA-Z0-9._]{3,30}$/.test(username)) {
        showToast('Username must be 3-30 characters: letters, numbers, dots, or underscores only.', 'error');
        document.getElementById('reg-username').classList.add('is-invalid');
        return;
    }

    if (securityPin && !/^[0-9]{6}$/.test(securityPin)) {
        showToast('Security PIN must be exactly 6 numeric digits.', 'error');
        document.getElementById('reg-security-pin')?.classList.add('is-invalid');
        return;
    }

    if (emailVerificationRequired && (!otp || otp.length !== 6)) {
        showToast('Please enter the 6-digit verification code from your email.', 'error');
        document.getElementById('reg-otp').classList.add('is-invalid');
        return;
    }

    if (submitBtn) submitBtn.disabled = true;

    // Ask for notification permission NOW, while the click that submitted the
    // form still counts as a user gesture. Firefox and Safari only show the
    // prompt from a gesture and Chrome may suppress it otherwise; by the time
    // the register request returns (slow on a cold server) that activation has
    // expired, so the old prompt-after-the-request often never appeared.
    let notificationPrompt = null;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        notificationPrompt = Promise.resolve()
            .then(() => Notification.requestPermission())
            .catch(() => {});
    }

    try {
        const payload = { name, username, email, password, currency };
        if (otp) payload.otp = otp;
        if (securityPin) payload.securityPin = securityPin;

        await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        clearInterval(otpTimerInterval);
        if (notificationPrompt) await notificationPrompt;
        sessionStorage.setItem('flash_toast', JSON.stringify({
            message: 'Registration successful! Please sign in with your credentials.',
            type: 'success'
        }));
        showToast('Registration successful! Redirecting to sign in…', 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 800);

    } catch (error) {
        showToast(error.message || 'Registration failed. Please try again.', 'error');
        if (submitBtn) submitBtn.disabled = false;
        if (error.message?.toLowerCase().includes('email') ||
            error.message?.toLowerCase().includes('user') ||
            error.message?.toLowerCase().includes('taken') ||
            error.message?.toLowerCase().includes('exist')) {
            if (typeof generateUsernameSuggestions === 'function') {
                generateUsernameSuggestions();
            }
        }
    }
});

// The legacy registration page keeps its progress indicator in an inline script.
// Synchronize the optional 6-digit Security PIN with that indicator after the page
// initialization has completed, without changing the registration/API workflow.
document.addEventListener('DOMContentLoaded', () => {
    const pinInput = document.getElementById('reg-security-pin');
    const bar = document.getElementById('stepBar');
    const dot6 = document.getElementById('dot6');

    if (!pinInput || !bar || !dot6 || typeof window.updateFormState !== 'function') return;

    const syncPinProgress = () => {
        const nameInput = document.getElementById('reg-name');
        const userInput = document.getElementById('reg-username');
        const emailInput = document.getElementById('reg-email');
        const currencyInput = document.getElementById('reg-currency');
        const passInput = document.getElementById('reg-password');

        const nameValid = !!nameInput && nameInput.value.trim().length >= 2;
        const userValid = !!userInput && userInput.value.trim().length >= 3 && /^[a-zA-Z0-9_.-]+$/.test(userInput.value.trim());
        const emailValid = !!emailInput && /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(emailInput.value.trim());
        const currencyValid = !!currencyInput?.value;
        const password = passInput?.value || '';
        const passwordScore = [
            password.length >= 8,
            /[A-Z]/.test(password) && /[a-z]/.test(password),
            /[0-9]/.test(password),
            /[^A-Za-z0-9]/.test(password),
        ].filter(Boolean).length;
        const passwordValid = passwordScore >= 3;
        const pinValid = /^[0-9]{6}$/.test(pinInput.value.trim());

        const completedRequiredFields = [nameValid, userValid, emailValid, currencyValid, passwordValid]
            .filter(Boolean).length;
        const completedFields = completedRequiredFields + (pinValid ? 1 : 0);

        dot6.classList.toggle('step-dot-done', pinValid);
        bar.style.width = `${(completedFields / 6) * 100}%`;
    };

    [
        document.getElementById('reg-name'),
        document.getElementById('reg-username'),
        document.getElementById('reg-email'),
        document.getElementById('reg-password'),
        document.getElementById('reg-currency'),
        pinInput,
    ].filter(Boolean).forEach((el) => {
        el.addEventListener('input', syncPinProgress);
        el.addEventListener('change', syncPinProgress);
    });

    const originalUpdateFormState = window.updateFormState;
    window.updateFormState = function (...args) {
        originalUpdateFormState.apply(this, args);
        syncPinProgress();
    };

    syncPinProgress();
});


// ─── Form Validation, Progress & Interactive Components ───
// Form Validation, Step Progress, Password Strength & Username Suggestions
        const nameInput = document.getElementById('reg-name');
        const userInput = document.getElementById('reg-username');
        const emailInput = document.getElementById('reg-email');
        const currencyInput = document.getElementById('reg-currency');
        const passInput = document.getElementById('reg-password');
        const bar = document.getElementById('stepBar');
        const dots = [document.getElementById('dot1'), document.getElementById('dot2'), document.getElementById('dot3'), document.getElementById('dot4'), document.getElementById('dot5')];
        const suggestionsBox = document.getElementById('usernameSuggestions');
        if (suggestionsBox) {
            suggestionsBox.addEventListener('click', (e) => {
                const chip = e.target.closest('.suggestion-chip');
                if (chip && chip.dataset.username && typeof window.pickUsername === 'function') {
                    window.pickUsername(chip.dataset.username);
                }
            });
        }

        function isNameValid(val) { return val.trim().length >= 2; }
        function isUserValid(val) { return val.trim().length >= 3 && /^[a-zA-Z0-9_.]+$/.test(val.trim()); }
        function isEmailValid(val) { return /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(val.trim()); }

        function getPasswordStrength(v) {
            if (!v) return { level: 0, label: '', color: 'transparent' };
            if (v.length < 6) return { level: 1, label: 'Too short (Min 8)', color: '#A23E32' };

            let score = 0;
            if (v.length >= 8) score++;
            if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
            if (/[0-9]/.test(v)) score++;
            if (/[^A-Za-z0-9]/.test(v)) score++;

            if (score <= 1) return { level: 1, label: 'Weak', color: '#A23E32' };
            if (score === 2) return { level: 2, label: 'Fair', color: '#C9932E' };
            if (score === 3) return { level: 3, label: 'Good', color: '#4C7A78' };
            return { level: 4, label: 'Strong (Rule Compliant)', color: '#C79A3E' };
        }

        function updateFormState() {
            const nVal = isNameValid(nameInput.value);
            const uVal = isUserValid(userInput.value);
            const eVal = isEmailValid(emailInput.value);
            const pStrength = getPasswordStrength(passInput.value);
            const pVal = pStrength.level >= 3 && passInput.value.length >= 8;

            // Field visual feedback
            setFieldState(nameInput, nVal);
            setFieldState(userInput, uVal);
            setFieldState(emailInput, eVal);
            setFieldState(passInput, pVal);

            // Progress bar based STRICTLY on valid fields
            const cVal = !!(currencyInput && currencyInput.value);
            const validFields = [nVal, uVal, eVal, cVal, pVal];
            const validCount = validFields.filter(Boolean).length;
            bar.style.width = `${(validCount / 5) * 100}%`;

            dots.forEach((dot, idx) => {
                if (dot) dot.classList.toggle('step-dot-done', validFields[idx]);
            });

            // Password meter render
            const segs = [document.getElementById('seg1'), document.getElementById('seg2'), document.getElementById('seg3'), document.getElementById('seg4')];
            const lbl = document.getElementById('strengthLabel');
            segs.forEach((s, i) => {
                s.style.background = (passInput.value && i < pStrength.level) ? pStrength.color : 'var(--border)';
            });
            lbl.textContent = pStrength.label;
            lbl.style.color = pStrength.color;
        }

        function setFieldState(el, isValid) {
            if (!el.value.trim()) {
                el.classList.remove('is-valid', 'is-invalid');
            } else if (isValid) {
                el.classList.add('is-valid');
                el.classList.remove('is-invalid');
            } else {
                el.classList.add('is-invalid');
                el.classList.remove('is-valid');
            }
        }

        // Username Suggestions Generator (DB Checked)
        async function generateUsernameSuggestions() {
            const baseName = nameInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            const userTyped = userInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            const prefix = baseName || userTyped || 'user';

            if (prefix.length >= 2) {
                const tags = ['pro', 'hq', 'dev', 'app', 'hub', 'zone', 'prime', 'lab', 'max', 'core', 'flow', 'star', 'vault'];
                const adjs = ['cool', 'swift', 'hyper', 'super', 'smart', 'ultra', 'epic', 'bright', 'elite', 'nova', 'apex'];
                const rnd = new Uint32Array(3);
                (window.crypto || window.msCrypto).getRandomValues(rnd);
                const randomTag = tags[rnd[0] % tags.length];
                const randomAdj = adjs[rnd[1] % adjs.length];
                const randomNum = 100 + (rnd[2] % 900);

                let suggestions = [
                    `${prefix}_${randomNum}`,
                    `${prefix}.${randomTag}`,
                    `${randomAdj}_${prefix}`
                ];

                try {
                    const apiUrl = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:8080';
                    const res = await fetch(`${apiUrl}/api/users/suggest-usernames?base=${encodeURIComponent(prefix)}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.suggestions && data.suggestions.length >= 3) {
                            suggestions = data.suggestions;
                        }
                    }
                } catch {
                    console.log('Using dynamic local username suggestions');
                }

                const [s1, s2, s3] = suggestions;
                suggestionsBox.innerHTML = `
                    <div class="suggestion-title">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        Suggested usernames:
                    </div>
                    <span class="suggestion-chip" onclick="pickUsername('${s1}')">@${s1}</span>
                    <span class="suggestion-chip" onclick="pickUsername('${s2}')">@${s2}</span>
                    <span class="suggestion-chip" onclick="pickUsername('${s3}')">@${s3}</span>
                `;
                suggestionsBox.style.display = 'flex';
            } else {
                suggestionsBox.style.display = 'none';
            }
        }

        window.pickUsername = function(suggested) {
            userInput.value = suggested;
            suggestionsBox.style.display = 'none';
            updateFormState();
        };

        [nameInput, userInput, emailInput, passInput, currencyInput].filter(Boolean).forEach(el => {
            el.addEventListener('input', updateFormState);
            el.addEventListener('change', updateFormState);
        });

        nameInput.addEventListener('input', generateUsernameSuggestions);
        userInput.addEventListener('input', generateUsernameSuggestions);

        // Dynamic 50-Currency Custom Select Component with Search Filter & Location Auto-Detection
        const currWrapper = document.getElementById("currencySelectWrapper");
        const currTrigger = document.getElementById("currencySelectTrigger");
        const currLabel = document.getElementById("selectedCurrencyLabel");

        if (currTrigger && currWrapper && typeof WORLD_CURRENCIES !== "undefined") {
            const optionsContainer = currWrapper.querySelector(".custom-select-options");
            const currencyList = typeof getCurrenciesSortedByLikelihood === "function"
                ? getCurrenciesSortedByLikelihood()
                : WORLD_CURRENCIES;

            // Render options starting with 'None'
            optionsContainer.innerHTML = `
                <input type="text" class="custom-select-search" placeholder="Search 100+ currencies (USD, EUR, ₹, Yen)..." aria-label="Search currencies">
                <div class="custom-options-list">
                    <div class="custom-option selected" data-value="" data-name="none select currency" data-symbol="">
                        <span><span class="custom-option-flag" style="display:inline-flex; align-items:center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/></svg></span> None (Select Currency)</span>
                    </div>
                    ${currencyList.map(item => `
                        <div class="custom-option" data-value="${item.code}" data-name="${item.name.toLowerCase()}" data-symbol="${item.symbol.toLowerCase()}">
                            <span><span class="custom-option-flag">${item.flag}</span> ${item.code} (${item.symbol}) — ${item.name}</span>
                        </div>
                    `).join('')}
                </div>
            `;

            const searchInput = optionsContainer.querySelector(".custom-select-search");
            const optionsList = optionsContainer.querySelectorAll(".custom-option");

            // Initial selection is explicitly 'None' — so progress bar is 0% and dot4 is not highlighted
            if (currencyInput) currencyInput.value = "";
            if (currLabel) currLabel.textContent = "None (Select Currency)";

            function selectCurrency(code, triggerUpdate = true) {
                optionsList.forEach(opt => {
                    const optVal = opt.getAttribute("data-value");
                    opt.classList.toggle("selected", optVal === (code || ""));
                });

                if (!code) {
                    if (currencyInput) currencyInput.value = "";
                    if (currLabel) currLabel.textContent = "None (Select Currency)";
                } else {
                    const item = WORLD_CURRENCIES.find(c => c.code === code);
                    if (item) {
                        if (currencyInput) currencyInput.value = item.code;
                        if (currLabel) currLabel.textContent = `${item.flag} ${item.code} (${item.symbol}) — ${item.name}`;
                    }
                }

                if (triggerUpdate) {
                    updateFormState();
                }
            }

            optionsList.forEach(opt => {
                opt.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const val = opt.getAttribute("data-value");
                    selectCurrency(val, true);
                    currWrapper.classList.remove("open");
                });
            });

            currTrigger.addEventListener("click", (e) => {
                e.stopPropagation();
                currWrapper.classList.toggle("open");
                if (currWrapper.classList.contains("open") && searchInput) {
                    searchInput.focus();
                }
            });

            if (searchInput) {
                searchInput.addEventListener("input", () => {
                    const q = searchInput.value.toLowerCase().trim();
                    optionsList.forEach(opt => {
                        const code = opt.getAttribute("data-value").toLowerCase();
                        const name = opt.getAttribute("data-name");
                        const symbol = opt.getAttribute("data-symbol");
                        const match = !q || code.includes(q) || name.includes(q) || symbol.includes(q);
                        opt.style.display = match ? "flex" : "none";
                    });
                });
                searchInput.addEventListener("click", e => e.stopPropagation());
            }

            document.addEventListener("click", () => {
                currWrapper.classList.remove("open");
            });

            // Automatically detect client location and update currency;
            // THEN AND ONLY THEN is currency selected, dot4 highlighted, and progress updated!
            (async function autoDetectClientLocationCurrency() {
                try {
                    let detected = null;
                    if (typeof detectClientLocationCurrency === "function") {
                        detected = await detectClientLocationCurrency();
                    } else if (typeof detectLikelyCurrencyCode === "function") {
                        detected = detectLikelyCurrencyCode();
                    }
                    if (detected && currencyInput && currencyInput.value === "") {
                        selectCurrency(detected, true);
                    }
                } catch (err) {
                    console.warn("Currency auto-detection error:", err);
                }
            })();
        }

        // Initialize state on load
        updateFormState();
