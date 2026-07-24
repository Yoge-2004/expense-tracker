package com.example.expensetracker.security;

import com.example.expensetracker.model.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Collections;

/**
 * Spring Security {@link UserDetails} implementation wrapping a {@link User} entity.
 *
 * <p>This class acts as the bridge between the application's {@link User} domain model
 * and Spring Security's authentication mechanism. It is constructed by
 * {@link CustomUserDetailsService} and consumed by the security framework during
 * authentication and authorisation checks.</p>
 *
 * <p>Account status flags ({@code enabled}, {@code accountNonLocked}) are derived
 * directly from the underlying {@link User} entity. The current implementation
 * grants no specific roles or authorities — all authenticated users are treated
 * equally. Role-based access control can be added by populating the
 * {@link #getAuthorities()} method.</p>
 *
 * @author Yogeshwaran
 * @version 1.0
 * @see CustomUserDetailsService
 * @see User
 */
public class CustomUserDetails implements UserDetails {

    /**
     * Serial version UID required because {@link UserDetails} extends
     * {@link java.io.Serializable}. This application uses stateless JWT
     * authentication, so {@code CustomUserDetails} instances are never
     * actually serialised; this field satisfies the compiler contract.
     */
    private static final long serialVersionUID = 1L;

    /**
     * The underlying domain user entity.
     * Marked {@code transient} because {@link User} is not {@link java.io.Serializable}.
     * In a stateless JWT application this object is never serialised to a session store.
     */
    private final transient User user;

    /**
     * Constructs a {@code CustomUserDetails} instance wrapping the given {@link User}.
     *
     * @param user the authenticated domain user; must not be {@code null}
     */
    public CustomUserDetails(User user) {
        this.user = user;
    }

    /**
     * Returns the domain {@link User} entity wrapped by this details object.
     *
     * <p>Used in controllers and services to obtain the full user object
     * after authentication (e.g., via
     * {@link com.example.expensetracker.security.JwtAuthenticationFilter}).</p>
     *
     * @return the underlying {@link User} entity
     */
    public User getUser() {
        return user;
    }

    /**
     * Returns the granted authorities for this user.
     *
     * <p>Currently returns an empty collection, meaning no role-based
     * restrictions are enforced. Extend this method to add roles such as
     * {@code ROLE_USER} or {@code ROLE_ADMIN} as needed.</p>
     *
     * @return an empty, unmodifiable collection of {@link GrantedAuthority}
     */
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return Collections.emptyList();
    }

    /**
     * Returns the BCrypt-encoded password stored for this user.
     *
     * @return the encoded password string
     */
    @Override
    public String getPassword() {
        return user.getPassword();
    }

    /**
     * Returns the username used to authenticate this user.
     *
     * <p>In this application, the email address serves as the unique login
     * identifier and is therefore returned as the username.</p>
     *
     * @return the user's email address
     */
    @Override
    public String getUsername() {
        return user.getEmail();
    }

    /**
     * Indicates whether the user's account has not expired.
     *
     * <p>Account expiry is not currently modelled; this always returns {@code true}.</p>
     *
     * @return {@code true} always
     */
    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    /**
     * Indicates whether the user's account is not locked.
     *
     * <p>Derived from the {@code accountLocked} flag on the {@link User} entity.
     * Returns {@code true} when the account is <em>not</em> locked (i.e., access is permitted).</p>
     *
     * @return {@code true} if the account is not locked; {@code false} if it is locked
     */
    @Override
    public boolean isAccountNonLocked() {
        return !user.isAccountLocked();
    }

    /**
     * Indicates whether the user's credentials (password) have not expired.
     *
     * <p>Credential expiry is not currently modelled; this always returns {@code true}.</p>
     *
     * @return {@code true} always
     */
    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    /**
     * Indicates whether the user account is enabled and allowed to authenticate.
     *
     * <p>Derived from the {@code enabled} flag on the {@link User} entity.
     * New accounts are enabled by default upon registration.</p>
     *
     * @return {@code true} if the account is enabled; {@code false} if it is disabled
     */
    @Override
    public boolean isEnabled() {
        return user.isEnabled();
    }
}
