package com.example.expensetracker.security;

import com.example.expensetracker.model.User;
import com.example.expensetracker.service.UserService;
import org.jspecify.annotations.NonNull;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserService userService;

    public CustomUserDetailsService(UserService userService) {
        this.userService = userService;
    }

    @Override
    public @NonNull UserDetails loadUserByUsername(
            @NonNull String email) throws UsernameNotFoundException {

        User user = userService.findByEmail(email)
                .orElseThrow(() ->
                        new UsernameNotFoundException("User not found: " + email));

        return new CustomUserDetails(user);
    }
}
