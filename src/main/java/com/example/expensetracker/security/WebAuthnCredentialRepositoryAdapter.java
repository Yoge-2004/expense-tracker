package com.example.expensetracker.security;

import com.example.expensetracker.model.User;
import com.example.expensetracker.model.WebAuthnCredential;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.repository.WebAuthnCredentialRepository;
import com.yubico.webauthn.CredentialRepository;
import com.yubico.webauthn.RegisteredCredential;
import com.yubico.webauthn.data.ByteArray;
import com.yubico.webauthn.data.PublicKeyCredentialDescriptor;
import com.yubico.webauthn.data.exception.Base64UrlException;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class WebAuthnCredentialRepositoryAdapter implements CredentialRepository {
    private final WebAuthnCredentialRepository credentials;
    private final UserRepository users;

    public WebAuthnCredentialRepositoryAdapter(WebAuthnCredentialRepository credentials, UserRepository users) {
        this.credentials = credentials;
        this.users = users;
    }

    @Override
    public Set<PublicKeyCredentialDescriptor> getCredentialIdsForUsername(String username) {
        return findUser(username)
            .map(User::getId)
            .map(credentials::findByUserId)
            .orElseGet(java.util.List::of)
            .stream()
            .map(this::toCredentialDescriptor)
            .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    @Override
    public Optional<ByteArray> getUserHandleForUsername(String username) {
        return findUser(username)
            .flatMap(u -> credentials.findByUserId(u.getId()).stream().findFirst())
            .flatMap(this::toUserHandle);
    }

    @Override
    public Optional<String> getUsernameForUserHandle(ByteArray userHandle) {
        return credentials.findByUserHandle(userHandle.getBase64Url())
            .map(c -> c.getUser().getEmail());
    }

    @Override
    public Optional<RegisteredCredential> lookup(ByteArray credentialId, ByteArray userHandle) {
        return credentials.findByCredentialIdAndUserHandle(credentialId.getBase64Url(), userHandle.getBase64Url())
            .flatMap(this::toRegisteredCredential);
    }

    @Override
    public Set<RegisteredCredential> lookupAll(ByteArray credentialId) {
        return credentials.findByCredentialId(credentialId.getBase64Url())
            .flatMap(this::toRegisteredCredential)
            .map(Set::of)
            .orElseGet(Set::of);
    }

    private Optional<User> findUser(String identifier) {
        if (identifier == null || identifier.isBlank()) return Optional.empty();
        return users.findByEmailIgnoreCase(identifier)
            .or(() -> users.findByUsernameIgnoreCase(identifier));
    }

    private PublicKeyCredentialDescriptor toCredentialDescriptor(WebAuthnCredential credential) {
        return PublicKeyCredentialDescriptor.builder()
            .id(decodeBase64Url(credential.getCredentialId(), "credential ID"))
            .build();
    }

    private Optional<ByteArray> toUserHandle(WebAuthnCredential credential) {
        return Optional.of(decodeBase64Url(credential.getUserHandle(), "user handle"));
    }

    private Optional<RegisteredCredential> toRegisteredCredential(WebAuthnCredential credential) {
        return Optional.of(RegisteredCredential.builder()
            .credentialId(decodeBase64Url(credential.getCredentialId(), "credential ID"))
            .userHandle(decodeBase64Url(credential.getUserHandle(), "user handle"))
            .publicKeyCose(decodeBase64Url(credential.getPublicKeyCose(), "public key COSE data"))
            .signatureCount(credential.getSignatureCount())
            .build());
    }

    private ByteArray decodeBase64Url(String value, String fieldName) {
        try {
            return ByteArray.fromBase64Url(value);
        } catch (Base64UrlException e) {
            throw new IllegalStateException("Invalid stored WebAuthn " + fieldName, e);
        }
    }
}
