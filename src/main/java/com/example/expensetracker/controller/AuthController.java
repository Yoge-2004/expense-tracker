package com.example.expensetracker.controller;

import com.example.expensetracker.dto.*;
import com.example.expensetracker.mapper.UserMapper;
import com.example.expensetracker.model.User;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@Tag(
    name        = "Authentication",
    description = """
        Handles all identity operations — registration, login, and password reset.

        These endpoints are **publicly accessible** (no JWT token required).
        After a successful login the server returns a signed **JWT Bearer token**
        which must be included in the `Authorization` header of every subsequent
        request to protected endpoints:
        ```
        Authorization: Bearer <token>
        ```
        Tokens are valid for **24 hours** (configurable via `jwt.expiration`).
        """
)
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

    // ─── POST /api/auth/login ─────────────────────────────────────────────

    @Operation(
        summary = "Login",
        description = """
            Authenticates a registered user and issues a signed **JWT Bearer token**.

            **How it works:**
            1. Validates that `email` and `password` fields are non-blank.
            2. Delegates to Spring Security's `AuthenticationManager`, which loads
               the user by email and verifies the BCrypt-hashed password.
            3. On success, generates a JWT token signed with the server's HS256 secret
               and returns it along with the user's `id` and `name`.

            **Using the token:**
            Copy the `token` value and click the **Authorize** button at the top of
            this page. Paste the token (without the `Bearer ` prefix) — the UI adds
            it automatically to every subsequent request.

            **Token expiry:** 24 hours. Re-authenticate to obtain a fresh token.
            """
    )
    @RequestBody(required = true, content = @Content(
        mediaType = MediaType.APPLICATION_JSON_VALUE,
        schema = @Schema(implementation = LoginRequest.class),
        examples = @ExampleObject(
            name = "auth-login-request",
            summary = "Standard login",
            value = "{ \"email\": \"john.doe@example.com\", \"password\": \"secret123\" }"
        )
    ))
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Login successful — JWT token returned",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = AuthResponse.class),
                examples = @ExampleObject(name = "auth-login-200", summary = "JWT token returned",
                    value = "{ \"token\": \"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJqb2huQGV4YW1wbGUuY29tIn0.abc\", \"userId\": 1, \"name\": \"John Doe\" }"
                ))
        ),
        @ApiResponse(responseCode = "401", description = "Invalid email or password",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "auth-login-401",
                    value = "{ \"status\": 401, \"error\": \"Authentication Failed\", \"message\": \"Invalid email or password\", \"path\": \"/api/auth/login\" }"
                ))
        ),
        @ApiResponse(responseCode = "400", description = "Request body is missing required fields",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "auth-login-400",
                    value = "{ \"status\": 400, \"error\": \"Bad Request\", \"message\": \"email: Email is required\", \"path\": \"/api/auth/login\" }"
                ))
        )
    })
    @SecurityRequirements
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @org.springframework.web.bind.annotation.RequestBody LoginRequest request) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));
        String token = jwtService.generateToken(auth.getName());
        User user = userService.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return ResponseEntity.ok(new AuthResponse(token, user.getId(), user.getName()));
    }

    // ─── POST /api/auth/register ──────────────────────────────────────────

    @Operation(
        summary = "Register",
        description = """
            Creates a new user account in the system.

            **Validation rules:**
            - `name` — must not be blank.
            - `email` — must be a valid email format and **unique** across all accounts.
            - `password` — minimum **6 characters**.

            **Password storage:**
            The plain-text password is **never stored**. It is immediately BCrypt-encoded
            (strength 10) before being persisted. The encoded hash is not returned
            in the response.

            **After registration:**
            Call `POST /api/auth/login` with the same credentials to obtain a JWT token.
            The returned `id` field is the `userId` required by all other endpoints.
            """
    )
    @RequestBody(required = true, content = @Content(
        mediaType = MediaType.APPLICATION_JSON_VALUE,
        schema = @Schema(implementation = RegisterRequest.class),
        examples = @ExampleObject(
            name = "auth-register-request",
            summary = "New user registration",
            value = "{ \"name\": \"John Doe\", \"email\": \"john.doe@example.com\", \"password\": \"secret123\" }"
        )
    ))
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Account created successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = UserDto.class),
                examples = @ExampleObject(name = "auth-register-201", summary = "Created user profile (no password)",
                    value = "{ \"id\": 1, \"email\": \"john.doe@example.com\", \"enabled\": true }"
                ))
        ),
        @ApiResponse(responseCode = "400", description = "Validation failed or email already registered",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "auth-register-400",
                    value = "{ \"status\": 400, \"error\": \"Bad Request\", \"message\": \"Email already registered\", \"path\": \"/api/auth/register\" }"
                ))
        )
    })
    @SecurityRequirements
    @PostMapping("/register")
    public ResponseEntity<UserDto> register(@Valid @org.springframework.web.bind.annotation.RequestBody RegisterRequest request) {
        User user = new User();
        user.setName(request.getName());
        user.setEmail(request.getEmail());
        user.setPassword(request.getPassword());
        User registeredUser = userService.registerUser(user);
        return new ResponseEntity<>(UserMapper.toDto(registeredUser), HttpStatus.CREATED);
    }

    // ─── PUT /api/auth/reset-password ─────────────────────────────────────

    @Operation(
        summary = "Reset password",
        description = """
            Resets the password of an existing account identified by email address.

            **How it works:**
            1. Looks up the user by `email`. If no account is found, returns `400`.
            2. BCrypt-encodes the `newPassword` and overwrites the stored hash.
            3. Returns `200` with no body on success.

            **After reset:**
            The old password is immediately invalidated. Any existing JWT tokens
            issued before the reset remain valid until they expire (tokens are
            stateless and not revoked server-side). To force logout, the user
            must wait for their current token to expire or the secret must be rotated.

            **Security note:**
            This endpoint does not require the old password or an OTP. In a production
            system it should be protected by an email-verification flow before use.
            """
    )
    @RequestBody(required = true, content = @Content(
        mediaType = MediaType.APPLICATION_JSON_VALUE,
        schema = @Schema(implementation = ResetPasswordRequest.class),
        examples = @ExampleObject(
            name = "auth-reset-request",
            summary = "Password reset payload",
            value = "{ \"email\": \"john.doe@example.com\", \"newPassword\": \"newSecret456\" }"
        )
    ))
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Password reset successfully — no body returned"),
        @ApiResponse(responseCode = "400", description = "Missing fields or no account found for the given email",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class),
                examples = @ExampleObject(name = "auth-reset-400",
                    value = "{ \"status\": 400, \"error\": \"Bad Request\", \"message\": \"User not found\", \"path\": \"/api/auth/reset-password\" }"
                ))
        )
    })
    @SecurityRequirements
    @PutMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@org.springframework.web.bind.annotation.RequestBody ResetPasswordRequest request) {
        if (request.getEmail() == null || request.getNewPassword() == null) {
            return ResponseEntity.badRequest().build();
        }
        userService.updatePassword(request.getEmail(), request.getNewPassword());
        return ResponseEntity.ok().build();
    }

    // ─── POST /api/auth/oauth/google ──────────────────────────────────────

    @Operation(
        summary = "OAuth Login / Signup",
        description = "Authenticates or registers a user via OAuth provider (Google). Generates standard JWT token."
    )
    @SecurityRequirements
    @PostMapping("/oauth/google")
    public ResponseEntity<AuthResponse> oauthLogin(@Valid @org.springframework.web.bind.annotation.RequestBody OAuthRequest request) {
        String email = request.getEmail();
        if (email == null || email.isBlank()) {
            email = "oauth_" + Math.abs(request.getIdToken().hashCode()) + "@oauth.user";
        }
        String name = (request.getName() != null && !request.getName().isBlank()) ? request.getName() : "Google User";

        String finalEmail = email;
        User user = userService.findByEmail(finalEmail).orElseGet(() -> {
            User newUser = new User();
            newUser.setName(name);
            newUser.setEmail(finalEmail);
            newUser.setPassword(java.util.UUID.randomUUID().toString());
            return userService.registerUser(newUser);
        });

        String token = jwtService.generateToken(user.getEmail());
        return ResponseEntity.ok(new AuthResponse(token, user.getId(), user.getName()));
    }
}

