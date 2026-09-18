package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.User;
import com.example.expensetracker.model.WebAuthnChallenge;
import com.example.expensetracker.model.WebAuthnCredential;
import com.example.expensetracker.repository.WebAuthnChallengeRepository;
import com.example.expensetracker.repository.WebAuthnCredentialRepository;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.security.WebAuthnCredentialRepositoryAdapter;
import com.example.expensetracker.service.WebAuthnService;
import com.yubico.webauthn.AssertionRequest;
import com.yubico.webauthn.AssertionResult;
import com.yubico.webauthn.FinishAssertionOptions;
import com.yubico.webauthn.FinishRegistrationOptions;
import com.yubico.webauthn.RegistrationResult;
import com.yubico.webauthn.RelyingParty;
import com.yubico.webauthn.StartAssertionOptions;
import com.yubico.webauthn.StartRegistrationOptions;
import com.yubico.webauthn.data.AuthenticatorAttachment;
import com.yubico.webauthn.data.AuthenticatorSelectionCriteria;
import com.yubico.webauthn.data.ByteArray;
import com.yubico.webauthn.data.PublicKeyCredential;
import com.yubico.webauthn.data.PublicKeyCredentialCreationOptions;
import com.yubico.webauthn.data.ResidentKeyRequirement;
import com.yubico.webauthn.data.RelyingPartyIdentity;
import com.yubico.webauthn.data.UserIdentity;
import com.yubico.webauthn.data.UserVerificationRequirement;
import com.yubico.webauthn.exception.AssertionFailedException;
import com.yubico.webauthn.exception.RegistrationFailedException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@Transactional(readOnly = true)
public class WebAuthnServiceImpl implements WebAuthnService {

    private static final String REGISTRATION = "registration";
    private static final String ASSERTION = "assertion";
    private static final int CHALLENGE_TTL_MINUTES = 5;

    private final WebAuthnChallengeRepository challenges;
    private final WebAuthnCredentialRepository credentials;
    private final JwtService jwtService;
    private final RelyingParty relyingParty;
    private final SecureRandom secureRandom = new SecureRandom();

    public WebAuthnServiceImpl(
        WebAuthnChallengeRepository challenges,
        WebAuthnCredentialRepository credentials,
        JwtService jwtService,
        WebAuthnCredentialRepositoryAdapter credentialRepository,
        @Value("${app.webauthn.rp-id:cozy-narwhal-3099ad.netlify.app}") String rpId,
        @Value("${app.webauthn.origin:https://cozy-narwhal-3099ad.netlify.app}") String origin
    ) {
        this.challenges = challenges;
        this.credentials = credentials;
        this.jwtService = jwtService;
        this.relyingParty = RelyingParty.builder()
            .identity(RelyingPartyIdentity.builder().id(rpId).name("Expense Tracker Pro").build())
            .credentialRepository(credentialRepository)
            .origins(Set.of(origin))
            .allowUntrustedAttestation(true)
            .validateSignatureCounter(true)
            .build();
    }

    @Override
    @Transactional
    public Map<String, String> startRegistration(User user) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("User and User ID cannot be null");
        }
        cleanupExpiredChallenges();

        // Reuse user's persistent WebAuthn user handle if one is already registered,
        // or generate a new cryptographically secure 32-byte handle.
        byte[] userHandle = credentials.findByUserId(user.getId()).stream()
                .findFirst()
                .map(c -> {
                    try {
                        return ByteArray.fromBase64Url(c.getUserHandle()).getBytes();
                    } catch (com.yubico.webauthn.data.exception.Base64UrlException e) {
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .orElseGet(() -> {
                    byte[] handle = new byte[32];
                    secureRandom.nextBytes(handle);
                    return handle;
                });

        UserIdentity identity = UserIdentity.builder()
            .name(user.getEmail())
            .displayName(user.getName())
            .id(new ByteArray(userHandle))
            .build();

        PublicKeyCredentialCreationOptions request = relyingParty.startRegistration(
            StartRegistrationOptions.builder()
                .user(identity)
                .authenticatorSelection(
                    AuthenticatorSelectionCriteria.builder()
                        .authenticatorAttachment(AuthenticatorAttachment.PLATFORM)
                        .residentKey(ResidentKeyRequirement.PREFERRED)
                        .userVerification(UserVerificationRequirement.REQUIRED)
                        .build()
                )
                .build()
        );

        String transactionId = UUID.randomUUID().toString();
        try {
            saveChallenge(transactionId, user.getId(), REGISTRATION, request.toJson());
            log.info("WebAuthn registration challenge created for userId={}, transactionId={}",
                    user.getId(), transactionId);
            return Map.of("transactionId", transactionId, "publicKey", request.toCredentialsCreateJson());
        } catch (IOException ex) {
            log.error("Failed to serialize registration options for userId={}: {}",
                    user.getId(), ex.getMessage(), ex);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to prepare biometric registration.", ex);
        }
    }

    @Override
    @Transactional
    public void finishRegistration(User user, String transactionId, String credentialJson) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("User and User ID cannot be null");
        }
        if (transactionId == null || transactionId.isBlank()) {
            throw new IllegalArgumentException("Transaction ID cannot be null or blank");
        }
        if (credentialJson == null || credentialJson.isBlank()) {
            throw new IllegalArgumentException("Credential JSON cannot be null or blank");
        }
        WebAuthnChallenge challenge = consumeChallenge(transactionId, REGISTRATION, user.getId());
        try {
            PublicKeyCredentialCreationOptions request =
                    PublicKeyCredentialCreationOptions.fromJson(challenge.getRequestJson());
            PublicKeyCredential<?, ?> parsed = PublicKeyCredential.parseRegistrationResponseJson(credentialJson);
            @SuppressWarnings("unchecked")
            PublicKeyCredential<com.yubico.webauthn.data.AuthenticatorAttestationResponse,
                com.yubico.webauthn.data.ClientRegistrationExtensionOutputs> credential =
                (PublicKeyCredential<com.yubico.webauthn.data.AuthenticatorAttestationResponse,
                    com.yubico.webauthn.data.ClientRegistrationExtensionOutputs>) parsed;

            RegistrationResult result = relyingParty.finishRegistration(
                FinishRegistrationOptions.builder().request(request).response(credential).build()
            );

            if (!result.isUserVerified()) {
                log.warn("WebAuthn registration failed: user not verified for userId={}, transactionId={}",
                        user.getId(), transactionId);
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "Biometric verification was not completed.");
            }

            WebAuthnCredential stored = new WebAuthnCredential();
            stored.setUser(user);
            stored.setCredentialId(result.getKeyId().getId().getBase64Url());
            stored.setPublicKeyCose(result.getPublicKeyCose().getBase64Url());
            stored.setUserHandle(request.getUser().getId().getBase64Url());
            stored.setSignatureCount(result.getSignatureCount());
            stored.setCreatedAt(LocalDateTime.now());
            credentials.save(stored);
            log.info("WebAuthn credential registered successfully for userId={}, credentialId={}",
                    user.getId(), stored.getCredentialId());
        } catch (RegistrationFailedException | IllegalArgumentException ex) {
            log.warn("WebAuthn registration attestation failed for userId={}, transactionId={}: {}",
                    user.getId(), transactionId, ex.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Biometric registration could not be completed.", ex);
        } catch (IOException ex) {
            log.error("WebAuthn registration payload deserialization error for userId={}: {}",
                    user.getId(), ex.getMessage(), ex);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Biometric registration could not be completed.", ex);
        }
    }

    @Override
    @Transactional
    public Map<String, String> startAuthentication() {
        cleanupExpiredChallenges();
        AssertionRequest request = relyingParty.startAssertion(
            StartAssertionOptions.builder()
                .userVerification(UserVerificationRequirement.REQUIRED)
                .build()
        );

        String transactionId = UUID.randomUUID().toString();
        try {
            saveChallenge(transactionId, null, ASSERTION, request.toJson());
            log.info("WebAuthn login assertion challenge created: transactionId={}", transactionId);
            return Map.of("transactionId", transactionId, "publicKey", request.toCredentialsGetJson());
        } catch (IOException ex) {
            log.error("Failed to serialize assertion request for transactionId={}: {}",
                    transactionId, ex.getMessage(), ex);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to prepare biometric login.", ex);
        }
    }

    @Override
    @Transactional
    public Map<String, Object> finishAuthentication(String transactionId, String assertionJson) {
        if (transactionId == null || transactionId.isBlank()) {
            throw new IllegalArgumentException("Transaction ID cannot be null or blank");
        }
        if (assertionJson == null || assertionJson.isBlank()) {
            throw new IllegalArgumentException("Assertion JSON cannot be null or blank");
        }
        WebAuthnChallenge challenge = consumeChallenge(transactionId, ASSERTION, null);
        try {
            AssertionRequest request = AssertionRequest.fromJson(challenge.getRequestJson());
            PublicKeyCredential<?, ?> parsed = PublicKeyCredential.parseAssertionResponseJson(assertionJson);
            @SuppressWarnings("unchecked")
            PublicKeyCredential<com.yubico.webauthn.data.AuthenticatorAssertionResponse,
                com.yubico.webauthn.data.ClientAssertionExtensionOutputs> credential =
                (PublicKeyCredential<com.yubico.webauthn.data.AuthenticatorAssertionResponse,
                    com.yubico.webauthn.data.ClientAssertionExtensionOutputs>) parsed;

            AssertionResult result = relyingParty.finishAssertion(
                FinishAssertionOptions.builder().request(request).response(credential).build()
            );

            if (!result.isSuccess() || !result.isUserVerified()) {
                log.warn("WebAuthn assertion verification failed or unverified for transactionId={}", transactionId);
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Biometric verification failed.");
            }

            WebAuthnCredential stored = credentials.findByCredentialId(result.getCredential().getCredentialId().getBase64Url())
                .orElseThrow(() -> {
                    log.warn("WebAuthn assertion credential not recognized for transactionId={}", transactionId);
                    return new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                            "Biometric credential is not registered.");
                });
            stored.setSignatureCount(result.getSignatureCount());
            stored.setLastUsedAt(LocalDateTime.now());
            credentials.save(stored);

            User user = stored.getUser();
            if (!user.isEnabled() || user.isAccountLocked()) {
                log.warn("WebAuthn login rejected: user account userId={} is locked or disabled", user.getId());
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account is unavailable.");
            }

            log.info("WebAuthn assertion verified successfully for userId={}, credentialId={}",
                    user.getId(), stored.getCredentialId());

            Map<String, Object> response = new HashMap<>();
            response.put("token", jwtService.generateToken(user.getEmail()));
            response.put("userId", user.getId());
            response.put("name", user.getName() != null ? user.getName() : "");
            response.put("username", user.getUsername() != null ? user.getUsername() : "");
            response.put("email", user.getEmail() != null ? user.getEmail() : "");
            response.put("currency", user.getCurrency() != null ? user.getCurrency() : "INR");
            response.put("hasSecurityPin", user.hasSecurityPin());
            return response;
        } catch (AssertionFailedException | IllegalArgumentException ex) {
            log.warn("WebAuthn assertion failed for transactionId={}: {}", transactionId, ex.getMessage());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Biometric verification failed.", ex);
        } catch (IOException ex) {
            log.error("WebAuthn assertion JSON parsing error for transactionId={}: {}",
                    transactionId, ex.getMessage(), ex);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Biometric verification failed.", ex);
        }
    }

    @Override
    @Transactional
    public void disableForUser(User user) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("User and User ID cannot be null");
        }
        log.info("Disabling all WebAuthn credentials for userId={}", user.getId());
        credentials.deleteAll(credentials.findByUserId(user.getId()));
    }

    @Override
    public boolean isWebAuthnEnabled(User user) {
        if (user == null || user.getId() == null) {
            return false;
        }
        return !credentials.findByUserId(user.getId()).isEmpty();
    }

    private void saveChallenge(String id, Long userId, String ceremony, String requestJson) {
        WebAuthnChallenge challenge = new WebAuthnChallenge();
        challenge.setId(id);
        challenge.setUserId(userId);
        challenge.setCeremony(ceremony);
        challenge.setRequestJson(requestJson);
        challenge.setExpiresAt(LocalDateTime.now().plusMinutes(CHALLENGE_TTL_MINUTES));
        challenges.save(challenge);
    }

    private WebAuthnChallenge consumeChallenge(String id, String ceremony, Long userId) {
        if (id == null || id.isBlank()) {
            log.warn("WebAuthn challenge consumption rejected: transactionId is null or blank");
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid biometric transaction.");
        }
        WebAuthnChallenge challenge = challenges.findByIdAndCeremony(id, ceremony)
            .orElseThrow(() -> {
                log.warn("WebAuthn challenge not found for transactionId={}, ceremony={}", id, ceremony);
                return new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "Biometric transaction has expired or is invalid.");
            });
        challenges.deleteById(id);
        if (challenge.getExpiresAt().isBefore(LocalDateTime.now())) {
            log.warn("WebAuthn challenge expired for transactionId={}, expiredAt={}",
                    id, challenge.getExpiresAt());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Biometric transaction has expired.");
        }
        if (userId != null && !userId.equals(challenge.getUserId())) {
            log.warn("WebAuthn challenge ownership mismatch: expected userId={}, got challenge userId={}",
                    userId, challenge.getUserId());
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Biometric transaction does not belong to this account.");
        }
        return challenge;
    }

    private void cleanupExpiredChallenges() {
        try {
            challenges.deleteByExpiresAtBefore(LocalDateTime.now());
        } catch (Exception ex) {
            log.debug("Challenge cleanup encountered non-critical error: {}", ex.getMessage());
        }
    }
}
