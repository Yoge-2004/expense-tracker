package com.example.expensetracker.service;

import com.example.expensetracker.model.User;

import java.util.Map;

/**
 * Service interface for FIDO2 / WebAuthn biometric credential management and ceremonies.
 */
public interface WebAuthnService {

    /**
     * Generates a cryptographic WebAuthn registration challenge and credential creation options.
     *
     * @param user the authenticated user initiating passkey registration
     * @return map containing the transactionId and base64/JSON publicKey creation options
     */
    Map<String, String> startRegistration(User user);

    /**
     * Verifies the authenticator attestation response and records the passkey credential.
     *
     * @param user the user completing registration
     * @param transactionId unique ceremony identifier
     * @param credentialJson client credential JSON returned from navigator.credentials.create()
     */
    void finishRegistration(User user, String transactionId, String credentialJson);

    /**
     * Generates a cryptographic WebAuthn assertion challenge and credential request options.
     *
     * @return map containing the transactionId and base64/JSON publicKey request options
     */
    Map<String, String> startAuthentication();

    /**
     * Verifies the authenticator assertion signature and completes passkey login.
     *
     * @param transactionId unique ceremony identifier
     * @param assertionJson client assertion JSON returned from navigator.credentials.get()
     * @return map containing the JWT token, userId, and user profile details
     */
    Map<String, Object> finishAuthentication(String transactionId, String assertionJson);

    /**
     * Revokes and removes all registered WebAuthn credentials for a user.
     *
     * @param user the user whose biometric credentials are removed
     */
    void disableForUser(User user);

    /**
     * Checks if the user has active WebAuthn credentials registered.
     *
     * @param user the user to check
     * @return true if biometric passkey authentication is active for this user
     */
    boolean isWebAuthnEnabled(User user);
}
