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
    if (!email || !/^\s*[^\s@]+@[^\s@]+\.[^\s@]+\s*$/.test(email)) {
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

        if (res && res.emailVerificationEnabled === 'false') {
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
document.getElementById('sendOtpBtn').addEventListener('click', doSendOtp);

// Resend OTP button
document.getElementById('resendOtpBtn').addEventListener('click', async () => {
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
document.getElementById('registerForm').addEventListener('submit', async (e) => {
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
    try {
        const payload = { name, username, email, password, currency };
        if (otp) payload.otp = otp;
        if (securityPin) payload.securityPin = securityPin;

        await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        clearInterval(otpTimerInterval);
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
        const emailValid = !!emailInput && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim());
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
