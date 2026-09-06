package com.example.expensetracker.security;

import com.example.expensetracker.model.User;
import com.example.expensetracker.model.WebAuthnCredential;
import com.example.expensetracker.repository.UserRepository;
import com.example.expensetracker.repository.WebAuthnCredentialRepository;
import com.yubico.webauthn.CredentialRepository;
import com.yubico.webauthn.RegisteredCredential;
import com.yubico.webauthn.data.ByteArray;
import com.yubico.webauthn.data.PublicKeyCredentialDescriptor;
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
            .map(c -> PublicKeyCredentialDescriptor.builder()
                .id(ByteArray.fromBase64Url(c.getCredentialId()))
                .build())
            .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    @Override
    public Optional<ByteArray> getUserHandleForUsername(String username) {
        return findUser(username)
            .flatMap(u -> credentials.findByUserId(u.getId()).stream().findFirst())
            .map(c -> ByteArray.fromBase64Url(c.getUserHandle()));
    }

    @Override
    public Optional<String> getUsernameForUserHandle(ByteArray userHandle) {
        return credentials.findByUserHandle(userHandle.getBase64Url())
            .map(c -> c.getUser().getEmail());
    }

    @Override
    public Optional<RegisteredCredential> lookup(ByteArray credentialId, ByteArray userHandle) {
        return credentials.findByCredentialIdAndUserHandle(credentialId.getBase64Url(), userHandle.getBase64Url())
            .map(this::toRegisteredCredential);
    }

    @Override
    public Set<RegisteredCredential> lookupAll(ByteArray credentialId) {
        return credentials.findByCredentialId(credentialId.getBase64Url())
            .map(c -> Set.of(toRegisteredCredential(c)))
            .orElseGet(Set::of);
    }

    private Optional<User> findUser(String identifier) {
        if (identifier == null || identifier.isBlank()) return Optional.empty();
        return users.findByEmailIgnoreCase(identifier)
            .or(() -> users.findByUsernameIgnoreCase(identifier));
    }

    private RegisteredCredential toRegisteredCredential(WebAuthnCredential credential) {
        return RegisteredCredential.builder()
            .credentialId(ByteArray.fromBase64Url(credential.getCredentialId()))
            .userHandle(ByteArray.fromBase64Url(credential.getUserHandle()))
            .publicKeyCose(ByteArray.fromBase64Url(credential.getPublicKeyCose()))
            .signatureCount(credential.getSignatureCount())
            .build();
    }
}
