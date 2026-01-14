package com.example.expensetracker.controller;

import com.example.expensetracker.dto.AuthResponse;
import com.example.expensetracker.dto.LoginRequest;
import com.example.expensetracker.dto.RegisterRequest;
import com.example.expensetracker.dto.UserDto;
import com.example.expensetracker.mapper.UserMapper;
import com.example.expensetracker.model.User;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserService userService;

    public AuthController(AuthenticationManager authenticationManager,
                          JwtService jwtService,
                          UserService userService) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.userService = userService;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        String token = jwtService.generateToken(authentication.getName());

        // ✅ Fetch User to get ID
        User user = userService.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        return ResponseEntity.ok(new AuthResponse(token, user.getId()));
    }

    // ✅ Added Register Endpoint
    @PostMapping("/register")
    public ResponseEntity<UserDto> register(@Valid @RequestBody RegisterRequest request) {
        User user = new User();
        user.setEmail(request.getEmail());
        user.setPassword(request.getPassword());
        User registeredUser = userService.registerUser(user);
        return new ResponseEntity<>(UserMapper.toDto(registeredUser), HttpStatus.CREATED);
    }
}