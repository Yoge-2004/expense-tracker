// ─── Forgot Password / Account Recovery Module ───

let resetEmail = "";
        let hasSecurityPin = false;
        let isEmailVerificationEnabled = false;

        document.getElementById("requestCodeForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn?.disabled) return;

            resetEmail = document.getElementById("email").value.trim();
            if (!resetEmail) return;

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.classList.add("loading");
            }

            try {
                const res = await apiRequest("/auth/forgot-password", {
                    method: "POST",
                    body: JSON.stringify({ email: resetEmail })
                });

                hasSecurityPin = !!(res && res.hasSecurityPin);
                isEmailVerificationEnabled = !!(res && res.emailVerificationEnabled);

                document.getElementById("requestCodeForm").style.display = "none";
                document.getElementById("resetForm").style.display = "block";
                document.getElementById("resetForm").classList.add("animate-surface-pop");

                document.getElementById("formHeaderTitle").textContent = "Set New Password";

                const otpInput = document.getElementById("otp");
                const codeLabel = document.getElementById("codeLabel");
                const codeSentNote = document.getElementById("codeSentNote");
                const resendBtn = document.getElementById("resendBtn");
                const pinNotice = document.getElementById("pinNotice");

                if (hasSecurityPin) {
                    codeLabel.textContent = "6-Digit Security PIN";
                    otpInput.placeholder = "Enter 6-digit PIN";
                    codeSentNote.textContent = "Protected with PIN";
                    document.getElementById("formHeaderSubtitle").textContent = "Enter your 6-digit Security PIN to authenticate and set a new password";
                    if (resendBtn) resendBtn.style.display = "none";
                    if (pinNotice) pinNotice.style.display = "block";
                    showToast("Account verified. Please enter your 6-digit Security PIN.", "info");
                } else if (isEmailVerificationEnabled) {
                    codeLabel.textContent = "6-Digit Verification Code";
                    otpInput.placeholder = "123456";
                    codeSentNote.textContent = "Sent to ";
          const recipient = document.createElement("strong");
          recipient.style.color = "var(--primary)";
          recipient.textContent = resetEmail;
          codeSentNote.appendChild(recipient);
                    document.getElementById("formHeaderSubtitle").textContent = "Enter the 6-digit code sent to your email";
                    if (resendBtn) resendBtn.style.display = "block";
                    showToast("Verification code dispatched to your email.", "success");
                } else {
                    codeLabel.textContent = "Security PIN / Code";
                    codeSentNote.textContent = "Identity verification";
                    document.getElementById("formHeaderSubtitle").textContent = "Enter your 6-digit Security PIN to continue";
                    if (resendBtn) resendBtn.style.display = "none";
                    showToast("Please enter your 6-digit Security PIN.", "info");
                }

                otpInput.value = "";
                otpInput.focus();
            } catch (error) {
                showToast(error.message || "Could not process password reset. Please try again.", "error");
                const emailInput = document.getElementById("email");
                if (emailInput) {
                    emailInput.classList.add("is-invalid");
                    emailInput.focus();
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove("loading");
                }
            }
        });

        document.getElementById("resendBtn").addEventListener("click", async (e) => {
            if (e.target.disabled) return;
            e.target.disabled = true;
            try {
                await apiRequest("/auth/forgot-password", {
                    method: "POST",
                    body: JSON.stringify({ email: resetEmail })
                });
                showToast("Verification code resent! Check your inbox.", "success");
            } catch (error) {
                showToast(error.message || "Couldn't resend the code.", "error");
            } finally {
                setTimeout(() => { e.target.disabled = false; }, 3000);
            }
        });

        document.getElementById("resetForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn?.disabled) return;

            const code = document.getElementById("otp").value.trim();
            const newPassword = document.getElementById("newPassword").value;

            if (!code || !/^[0-9]{6}$/.test(code)) {
                showToast("Please enter a valid 6-digit Security PIN or verification code.", "error");
                document.getElementById("otp").focus();
                return;
            }

            if (!newPassword || newPassword.length < 6) {
                showToast("New password must be at least 6 characters long.", "error");
                document.getElementById("newPassword").focus();
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.classList.add("loading");
            }

            try {
                await apiRequest("/auth/reset-password", {
                    method: "PUT",
                    body: JSON.stringify({
                        email: resetEmail,
                        securityPin: code,
                        otp: code,
                        newPassword: newPassword
                    })
                });
                sessionStorage.setItem("flash_toast", JSON.stringify({
                    message: "Password updated successfully! Please sign in with your new password.",
                    type: "success"
                }));
                showToast("Password updated successfully! Redirecting to sign in...", "success");
                setTimeout(() => { window.location.href = "index.html"; }, 800);
            } catch (error) {
                showToast(error.message || "Failed to update password. Please check your PIN/code.", "error");
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove("loading");
                }
            }
        });

        // ---- Reset with a fingerprint / passkey (only offered when this device has a platform authenticator)
        const passkeyOption = document.getElementById("passkeyOption");
        const passkeyForm = document.getElementById("passkeyResetForm");
        const requestCodeFormEl = document.getElementById("requestCodeForm");

        window.WebBiometrics?.isAvailable().then((available) => {
            if (available) passkeyOption.hidden = false;
        }).catch(() => {});

        document.getElementById("passkeyStartBtn")?.addEventListener("click", () => {
            requestCodeFormEl.hidden = true;
            passkeyOption.hidden = true;
            passkeyForm.hidden = false;
            document.getElementById("passkeyNewPassword").focus();
        });

        document.getElementById("passkeyBackBtn")?.addEventListener("click", () => {
            passkeyForm.hidden = true;
            requestCodeFormEl.hidden = false;
            passkeyOption.hidden = false;
        });

        passkeyForm?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById("passkeyResetBtn");
            if (submitBtn?.disabled) return;
            const newPassword = document.getElementById("passkeyNewPassword").value;
            if (newPassword.length < 6) {
                showToast("New password must be at least 6 characters long.", "error");
                return;
            }
            submitBtn.disabled = true;
            submitBtn.classList.add("loading");
            try {
                await window.WebBiometrics.recover(newPassword);
                sessionStorage.setItem("flash_toast", JSON.stringify({
                    message: "Password updated successfully! Please sign in with your new password.",
                    type: "success"
                }));
                showToast("Password updated successfully! Redirecting to sign in...", "success");
                setTimeout(() => { window.location.href = "index.html"; }, 800);
            } catch (error) {
                showToast(error.message || "Could not verify your fingerprint. Try an email code instead.", "error");
                submitBtn.disabled = false;
                submitBtn.classList.remove("loading");
            }
        });

        const passEl = document.getElementById("newPassword");
        const emailEl = document.getElementById("email");

        function getPasswordStrength(v) {
            if (!v) return { level: 0, label: '', color: 'transparent' };
            if (v.length < 6) return { level: 1, label: 'Too short (Min 6)', color: '#EF4444' };

            let score = 0;
            if (v.length >= 8) score++;
            if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
            if (/[0-9]/.test(v)) score++;
            if (/[^A-Za-z0-9]/.test(v)) score++;

            if (score <= 1) return { level: 1, label: 'Weak', color: '#EF4444' };
            if (score === 2) return { level: 2, label: 'Fair', color: '#F59E0B' };
            if (score === 3) return { level: 3, label: 'Good', color: '#0EA5E9' };
            return { level: 4, label: 'Strong (Protected)', color: '#10B981' };
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

        if (emailEl) {
            emailEl.addEventListener('input', () => {
                setFieldState(emailEl, /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(emailEl.value.trim()));
            });
        }

        if (passEl) {
            passEl.addEventListener('input', function() {
                const v = this.value;
                const pStrength = getPasswordStrength(v);
                // FIXED: previously these getElementById calls had no null guards. If any
                // segment element was missing, s.style.background would throw and the entire
                // input handler would die — leaving the strength meter frozen. Now we filter
                // out nulls and guard the label element too.
                const segs = [document.getElementById('seg1'), document.getElementById('seg2'), document.getElementById('seg3'), document.getElementById('seg4')].filter(Boolean);
                const lbl = document.getElementById('strengthLabel');

                segs.forEach((s, i) => { s.style.background = (v && i < pStrength.level) ? pStrength.color : 'var(--border)'; });
                if (lbl) {
                    lbl.textContent = pStrength.label;
                    lbl.style.color = pStrength.color;
                }

                setFieldState(passEl, pStrength.level >= 2 && v.length >= 6);
            });
        }
