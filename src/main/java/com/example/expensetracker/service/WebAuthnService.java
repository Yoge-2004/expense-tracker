package com.example.expensetracker.service;

import com.example.expensetracker.model.User;
import com.example.expensetracker.model.WebAuthnChallenge;
import com.example.expensetracker.model.WebAuthnCredential;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.repository.WebAuthnChallengeRepository;
import com.example.expensetracker.repository.WebAuthnCredentialRepository;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.security.WebAuthnCredentialRepositoryAdapter;
import com.yubico.webauthn.AssertionRequest;
import com.yubico.webauthn.AssertionResult;
import com.yubico.webauthn.FinishAssertionOptions;
import com.yubico.webauthn.FinishRegistrationOptions;
import com.yubico.webauthn.RegistrationResult;
import com.yubico.webauthn.RelyingParty;
import com.yubico.webauthn.RelyingPartyIdentity;
import com.yubico.webauthn.StartAssertionOptions;
import com.yubico.webauthn.StartRegistrationOptions;
import com.yubico.webauthn.data.AuthenticatorAttachment;
import com.yubico.webauthn.data.ByteArray;
import com.yubico.webauthn.data.PublicKeyCredential;
import com.yubico.webauthn.data.PublicKeyCredentialCreationOptions;
import com.yubico.webauthn.data.ResidentKeyRequirement;
import com.yubico.webauthn.data.UserIdentity;
import com.yubico.webauthn.data.UserVerificationRequirement;
import com.yubico.webauthn.exception.AssertionFailedException;
import com.yubico.webauthn.exception.RegistrationFailedException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class WebAuthnService {
    private static final String REGISTRATION = "registration";
    private static final String ASSERTION = "assertion";
    private static final int CHALLENGE_TTL_MINUTES = 5;

    private final WebAuthnChallengeRepository challenges;
    private final WebAuthnCredentialRepository credentials;
    private final UserRepository users;
    private final JwtService jwtService;
    private final RelyingParty relyingParty;
    private final SecureRandom secureRandom = new SecureRandom();

    public WebAuthnService(
        WebAuthnChallengeRepository challenges,
        WebAuthnCredentialRepository credentials,
        UserRepository users,
        JwtService jwtService,
        WebAuthnCredentialRepositoryAdapter credentialRepository,
        @Value("${app.webauthn.rp-id:cozy-narwhal-3099ad.netlify.app}") String rpId,
        @Value("${app.webauthn.origin:https://cozy-narwhal-3099ad.netlify.app}") String origin
    ) {
        this.challenges = challenges;
        this.credentials = credentials;
        this.users = users;
        this.jwtService = jwtService;
        this.relyingParty = RelyingParty.builder()
            .identity(RelyingPartyIdentity.builder().id(rpId).name("Expense Tracker Pro").build())
            .credentialRepository(credentialRepository)
            .origins(Set.of(origin))
            .allowUntrustedAttestation(true)
            .validateSignatureCounter(true)
            .build();
    }

    @Transactional
    public Map<String, String> startRegistration(User user) {
        cleanupExpiredChallenges();
        byte[] userHandle = new byte[32];
        secureRandom.nextBytes(userHandle);

        UserIdentity identity = UserIdentity.builder()
            .name(user.getEmail())
            .displayName(user.getName())
            .id(new ByteArray(userHandle))
            .build();

        PublicKeyCredentialCreationOptions request = relyingParty.startRegistration(
            StartRegistrationOptions.builder()
                .user(identity)
                .authenticatorSelection(com.yubico.webauthn.data.AuthenticatorSelectionCriteria.builder()
                    .authenticatorAttachment(AuthenticatorAttachment.PLATFORM)
                    .residentKey(ResidentKeyRequirement.REQUIRED)
                    .userVerification(UserVerificationRequirement.REQUIRED)
                    .build())
                .build()
        );

        String transactionId = UUID.randomUUID().toString();
        saveChallenge(transactionId, user.getId(), REGISTRATION, request.toJson());
        return Map.of("transactionId", transactionId, "publicKey", request.toCredentialsCreateJson());
    }

    @Transactional
    public void finishRegistration(User user, String transactionId, String credentialJson) {
        WebAuthnChallenge challenge = consumeChallenge(transactionId, REGISTRATION, user.getId());
        try {
            PublicKeyCredentialCreationOptions request = PublicKeyCredentialCreationOptions.fromJson(challenge.getRequestJson());
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
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Biometric verification was not completed.");
            }

            WebAuthnCredential stored = new WebAuthnCredential();
            stored.setUser(user);
            stored.setCredentialId(result.getKeyId().getId().getBase64Url());
            stored.setPublicKeyCose(result.getPublicKeyCose().getBase64Url());
            stored.setUserHandle(request.getUser().getId().getBase64Url());
            stored.setSignatureCount(result.getSignatureCount());
            credentials.save(stored);
        } catch (RegistrationFailedException | IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Biometric registration could not be completed.", ex);
        }
    }

    @Transactional
    public Map<String, String> startAuthentication() {
        cleanupExpiredChallenges();
        AssertionRequest request = relyingParty.startAssertion(
            StartAssertionOptions.builder()
                .userVerification(UserVerificationRequirement.REQUIRED)
                .build()
        );

        String transactionId = UUID.randomUUID().toString();
        saveChallenge(transactionId, null, ASSERTION, request.toJson());
        return Map.of("transactionId", transactionId, "publicKey", request.toCredentialsGetJson());
    }

    @Transactional
    public Map<String, Object> finishAuthentication(String transactionId, String assertionJson) {
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
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Biometric verification failed.");
            }

            WebAuthnCredential stored = credentials.findByCredentialId(result.getCredential().getCredentialId().getBase64Url())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Biometric credential is not registered."));
            stored.setSignatureCount(result.getSignatureCount());
            stored.setLastUsedAt(LocalDateTime.now());
            credentials.save(stored);

            User user = stored.getUser();
            if (!user.isEnabled() || user.isAccountLocked()) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account is unavailable.");
            }

            return Map.of(
                "token", jwtService.generateToken(user.getEmail()),
                "userId", user.getId(),
                "name", user.getName(),
                "email", user.getEmail()
            );
        } catch (AssertionFailedException | IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Biometric verification failed.", ex);
        }
    }

    @Transactional
    public void disableForUser(User user) {
        credentials.deleteAll(credentials.findByUserId(user.getId()));
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid biometric transaction.");
        }
        WebAuthnChallenge challenge = challenges.findByIdAndCeremony(id, ceremony)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Biometric transaction has expired or is invalid."));
        challenges.deleteById(id);
        if (challenge.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Biometric transaction has expired.");
        }
        if (userId != null && !userId.equals(challenge.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Biometric transaction does not belong to this account.");
        }
        return challenge;
    }

    private void cleanupExpiredChallenges() {
        challenges.deleteByExpiresAtBefore(LocalDateTime.now());
    }
}
