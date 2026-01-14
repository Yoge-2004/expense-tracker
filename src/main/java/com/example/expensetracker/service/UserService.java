package com.example.expensetracker.service;

import com.example.expensetracker.model.User;

import java.util.Optional;

public interface UserService {

    User registerUser(User user);

    Optional<User> findByEmail(String email);

    Optional<User> findById(Long id);

    boolean existsByEmail(String email);
}
