// ─── Two-phase signup: send OTP → verify OTP → create account ───────────────

let otpTimerInterval = null;

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
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
        await apiRequest('/auth/signup/send-otp', {
            method: 'POST',
            body: JSON.stringify({ email, name }),
        });
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

    const name     = document.getElementById('reg-name').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const otp      = (document.getElementById('reg-otp').value || '').trim();
    const currency = document.getElementById('reg-currency')?.value || 'INR';

    if (!otp || otp.length !== 6) {
        showToast('Please enter the 6-digit verification code from your email.', 'error');
        document.getElementById('reg-otp').classList.add('is-invalid');
        return;
    }

    if (submitBtn) submitBtn.disabled = true;
    try {
        await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, otp, currency }),
        });

        clearInterval(otpTimerInterval);
        showToast('Registration successful! Redirecting to sign in…', 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 800);

    } catch (error) {
        showToast(error.message || 'Registration failed.', 'error');
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
