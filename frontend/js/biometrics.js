/**
 * @file biometrics.js
 * @description WebAuthn biometric authentication module for Expense Tracker (Touch ID, Face ID, Windows Hello).
 */

const WebBiometrics = {
    /**
     * Checks whether platform authenticator (TouchID / FaceID / Windows Hello) is supported.
     */
    async isAvailable() {
        if (!window.PublicKeyCredential) return false;
        try {
            return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch (e) {
            return false;
        }
    },

    /**
     * Checks whether biometric login was previously enabled on this browser.
     */
    isEnabled() {
        return !!localStorage.getItem('webauthn_bio_token');
    },

    /**
     * Enrolls the current session for biometric sign-in using WebAuthn.
     */
    async enroll(email, token) {
        if (!(await this.isAvailable())) {
            throw new Error("Biometric authentication (Touch ID / Face ID / Windows Hello) is not supported on this device/browser.");
        }

        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const userIdBytes = new TextEncoder().encode(email || 'user');

        const credential = await navigator.credentials.create({
            publicKey: {
                challenge,
                rp: { name: "Expense Tracker Pro", id: window.location.hostname },
                user: {
                    id: userIdBytes,
                    name: email,
                    displayName: email,
                },
                pubKeyCredParams: [
                    { alg: -7, type: "public-key" },  // ES256
                    { alg: -257, type: "public-key" } // RS256
                ],
                authenticatorSelection: {
                    authenticatorAttachment: "platform",
                    userVerification: "preferred",
                    requireResidentKey: false
                },
                timeout: 60000
            }
        });

        if (credential) {
            localStorage.setItem('webauthn_bio_token', token);
            localStorage.setItem('webauthn_bio_email', email);
            localStorage.setItem('webauthn_bio_cred_id', btoa(String.fromCharCode(...new Uint8Array(credential.rawId))));
            return true;
        }
        return false;
    },

    /**
     * Performs biometric authentication and logs the user into their session.
     */
    async authenticate() {
        const token = localStorage.getItem('webauthn_bio_token');
        const email = localStorage.getItem('webauthn_bio_email');
        if (!token) throw new Error("No biometric credentials registered on this browser.");

        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge,
                rpId: window.location.hostname,
                userVerification: "preferred",
                timeout: 60000
            }
        });

        if (assertion) {
            return { token, email };
        }
        throw new Error("Biometric verification failed.");
    },

    /**
     * Disables biometric credentials on this browser.
     */
    disable() {
        localStorage.removeItem('webauthn_bio_token');
        localStorage.removeItem('webauthn_bio_email');
        localStorage.removeItem('webauthn_bio_cred_id');
    }
};

window.WebBiometrics = WebBiometrics;
