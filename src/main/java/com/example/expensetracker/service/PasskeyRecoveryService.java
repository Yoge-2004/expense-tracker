package com.example.expensetracker.service;

import java.util.Map;

/**
 * Password recovery proved by a passkey (fingerprint / face / device PIN on the authenticator) instead of
 * an emailed code. Possession of a registered passkey plus on-device user verification is at least as
 * strong a proof as access to the mailbox, and it grants no more than passkey sign-in already does.
 */
public interface PasskeyRecoveryService {

    /** Starts recovery: returns the assertion challenge ("transactionId" + "publicKey" options). */
    Map<String, String> startRecovery();

    /**
     * Verifies the signed assertion and, only if it is valid, sets the new password.
     *
     * @throws IllegalArgumentException the new password is missing or too short (checked BEFORE the
     *                                  assertion so a typo does not burn the single-use challenge)
     * @throws org.springframework.web.server.ResponseStatusException 401 when the assertion is not valid
     */
    void resetPassword(String transactionId, String credentialJson, String newPassword);
}
