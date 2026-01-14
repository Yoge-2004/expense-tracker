package com.example.expensetracker.security;

import com.example.expensetracker.model.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import org.jspecify.annotations.NonNull;


import java.util.Collection;
import java.util.Collections;

public class CustomUserDetails implements UserDetails {

    private final User user;

    public CustomUserDetails(User user) {
        this.user = user;
    }

    public User getUser() {
        return user;
    }

    @Override
    public @NonNull Collection<? extends GrantedAuthority> getAuthorities() {
        // No roles yet
        return Collections.emptyList();
    }

    @Override
    public @NonNull String getPassword() {
        return user.getPassword();
    }

    @Override
    public @NonNull String getUsername() {
        // Email is our username
        return user.getEmail();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return !user.isAccountLocked();
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return user.isEnabled();
    }
}
