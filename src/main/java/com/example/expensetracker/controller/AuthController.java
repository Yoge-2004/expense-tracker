package com.example.expensetracker.controller;

import com.example.expensetracker.dto.*;
import com.example.expensetracker.logging.LoggingUtils;
import com.example.expensetracker.mapper.UserMapper;
import com.example.expensetracker.model.User;
import com.example.expensetracker.security.CustomUserDetails;
import com.example.expensetracker.security.GoogleIdTokenVerifier;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.security.RateLimited;
import com.example.expensetracker.service.PasswordResetService;
import com.example.expensetracker.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@Tag(
    name        = "Authentication",
    description = """
        Handles all identity operations — registration, login, and password reset.

        These endpoints are **publicly accessible** (no JWT token required).
        After a successful login the server returns a signed **JWT Bearer token**.

        **Signup flow (email-verified):**
        1. Call `POST /api/auth/signup/send-otp` with name + email — a 6-digit code is emailed.
        2. Call `POST /api/auth/register` with all fields + the OTP — account is created.
        """
)
@Slf4j
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserService userService;
    private final JwtService jwtService;
    private final PasswordResetService passwordResetService;
    private final GoogleIdTokenVerifier googleIdTokenVerifier;

    @Value("${app.auth.email-verification-enabled:false}")
    private boolean emailVerificationEnabled;


    @Operation(summary = "Get auth configuration",
        description = "Returns public configuration flags like whether email OTP verification is required.")
    @SecurityRequirements
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getAuthConfig() {
        log.debug("Auth configuration requested: emailVerificationEnabled={}", emailVerificationEnabled);
        return ResponseEntity.ok(Map.of("emailVerificationEnabled", emailVerificationEnabled));
    }

    @Operation(summary = "Login with credentials",
        description = """
            Authenticates a user by email/username and password.
            Returns a JWT Bearer token valid for 24 hours upon success.
            Rate limited to **10 requests per minute** per IP address.
            """)
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Authentication successful",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = AuthResponse.class),
                examples = @ExampleObject(name = "auth-login-200",
                    value = """
                        {"token": "eyJ...", "userId": 1, "name": "John Doe", "currency": "INR"}
                        """))),
        @ApiResponse(responseCode = "401", description = "Invalid email or password",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "400", description = "Request body is missing required fields",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "429", description = "Too many login attempts (rate limit exceeded)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @SecurityRequirements
    @PostMapping("/login")
    @RateLimited(key = "auth-login", message = "Too many login attempts. Please try again in %d seconds.")
    public ResponseEntity<AuthResponse> login(
            @Valid @org.springframework.web.bind.annotation.RequestBody LoginRequest request) {
        String identifier = request.email() != null ? request.email().trim() : "";
        log.info("Login attempt received for user identifier={}", LoggingUtils.maskEmail(identifier));
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(identifier, request.password()));

        User user = null;
        if (auth.getPrincipal() instanceof CustomUserDetails cud) {
            user = cud.getUser();
        }
        if (user == null) {
            user = userService.findByIdentifier(identifier)
                    .or(() -> userService.findByEmail(identifier))
                    .or(() -> userService.findByIdentifier(auth.getName()))
                    .or(() -> userService.findByEmail(auth.getName()))
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));
        }
        String token = jwtService.generateToken(user.getEmail());
        log.info("User successfully authenticated; userId={}", user.getId());
        return ResponseEntity.ok(new AuthResponse(
                token,
                user.getId(),
                user.getName(),
                user.getUsername(),
                user.getEmail(),
                user.getCurrency(),
                user.hasSecurityPin()
        ));
    }

    @Operation(summary = "Send signup verification OTP",
        description = """
            Sends a 6-digit email verification code required before account creation.
            Returns a generic response whether or not the email is already registered.
            The code expires in 10 minutes. A new call invalidates any previous code.
            """)
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "OTP request processed"),
        @ApiResponse(responseCode = "429", description = "Too many OTP requests (rate limit exceeded)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @SecurityRequirements
    @PostMapping("/signup/send-otp")
    @RateLimited(key = "auth-signup-otp", maxRequests = 5, windowSeconds = 300,
                 message = "Too many OTP requests. Please try again in %d seconds.")
    public ResponseEntity<Map<String, String>> sendSignupOtp(
            @Valid @org.springframework.web.bind.annotation.RequestBody SignupOtpRequest request) {
        log.info("Request received to send signup OTP for email={}", LoggingUtils.maskEmail(request.email()));
        passwordResetService.sendSignupOtp(request.email(), request.name());
        return ResponseEntity.ok(Map.of(
            "message", "If this email is eligible, a verification code has been dispatched.",
            "emailVerificationEnabled", String.valueOf(emailVerificationEnabled)
        ));
    }

    @Operation(summary = "Register",
        description = """
            Creates a new user account. If email verification is enabled, verifies the OTP
            issued by `POST /api/auth/signup/send-otp`.
            Fields: name, email, password (min 6 chars), optional securityPin (6 digits), currency.
            """)
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Account created successfully",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = UserDto.class))),
        @ApiResponse(responseCode = "400", description = "Validation failed or email already registered",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "401", description = "OTP is invalid, expired, or already used",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "429", description = "Too many registration attempts (rate limit exceeded)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @SecurityRequirements
    @PostMapping("/register")
    @RateLimited(key = "auth-register", message = "Too many registration attempts. Please try again in %d seconds.")
    public ResponseEntity<UserDto> register(
            @Valid @org.springframework.web.bind.annotation.RequestBody RegisterRequest request) {
        log.info("Registration request received for email={}, username={}",
                LoggingUtils.maskEmail(request.email()), request.username());
        // SECURITY: the legacy "BYPASS" OTP backdoor constant is no longer special-cased.
        // A submitted code is always verified like any other value (and rejected as
        // invalid unless it matches a real, unconsumed OTP record).
        boolean hasOtp = request.otp() != null && !request.otp().isBlank();
        if (emailVerificationEnabled || hasOtp) {
            passwordResetService.verifySignupOtp(request.email(), request.otp());
        }

        User user = new User();
        user.setName(request.name());
        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setPassword(request.password());
        user.setCurrency(request.currency());
        if (request.securityPin() != null && !request.securityPin().isBlank()) {
            user.setSecurityPinHash(request.securityPin().trim());
        }
        User registeredUser = userService.registerUser(user);
        log.info("User registered successfully with id={}", registeredUser.getId());
        return new ResponseEntity<>(UserMapper.toDto(registeredUser), HttpStatus.CREATED);
    }

    @Operation(summary = "Request password reset",
        description = "Initializes password recovery without revealing whether the email "
                    + "exists or which recovery factors are configured.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Reset request processed"),
        @ApiResponse(responseCode = "429", description = "Too many password recovery requests (rate limit exceeded)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @SecurityRequirements
    @PostMapping("/forgot-password")
    @RateLimited(key = "auth-forgot-password", maxRequests = 5, windowSeconds = 300,
                 message = "Too many password recovery requests. Please try again in %d seconds.")
    public ResponseEntity<Map<String, Object>> forgotPassword(
            @Valid @org.springframework.web.bind.annotation.RequestBody ForgotPasswordRequest request) {
        String email = request.email().trim();
        log.info("Password reset request received for email={}", LoggingUtils.maskEmail(email));
        // FIXED: previously caught Exception (everything), which masked DB outages as a 200 OK
        // "instructions have been prepared" response — misleading the user into thinking the
        // reset email was sent when it wasn't. Now we only swallow expected exceptions
        // (NoSuchElementException when the email doesn't exist — we don't want to leak that),
        // and let infrastructure exceptions (DataAccessException, CannotCreateTransactionException)
        // propagate so GlobalExceptionHandler returns 503 SERVICE_UNAVAILABLE.
        try {
            passwordResetService.requestReset(email);
        } catch (java.util.NoSuchElementException e) {
            log.info("Password reset request for unknown account processed without exposing account state");
        }
        return ResponseEntity.ok(Map.of(
            "message", "If an account exists for that email, recovery instructions have been prepared.",
            "emailVerificationEnabled", emailVerificationEnabled
        ));
    }

    @Operation(summary = "Reset password",
        description = "Resets the password given a valid 6-digit Security PIN or email OTP.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Password reset successfully"),
        @ApiResponse(responseCode = "401", description = "Invalid, expired or already-used OTP/PIN",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "404", description = "No account found with this email address",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "429", description = "Too many password reset attempts (rate limit exceeded)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @SecurityRequirements
    @PutMapping("/reset-password")
    @RateLimited(key = "auth-reset-password", maxRequests = 5, windowSeconds = 600,
                 message = "Too many password reset attempts. Please try again in %d seconds.")
    public ResponseEntity<Void> resetPassword(
            @Valid @org.springframework.web.bind.annotation.RequestBody ResetPasswordRequest request) {
        log.info("Password reset execution requested for email={}", LoggingUtils.maskEmail(request.email()));
        String code = request.resolveVerificationCode();
        passwordResetService.resetPassword(request.email(), code, request.newPassword());
        log.info("Password successfully updated for email={}", LoggingUtils.maskEmail(request.email()));
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "OAuth Login / Signup",
        description = "Authenticates or registers a user via Google Sign-In. "
                    + "Google OAuth users bypass the OTP signup flow.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Google OAuth login successful"),
        @ApiResponse(responseCode = "401", description = "Invalid Google ID token",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "429", description = "Too many OAuth requests (rate limit exceeded)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @SecurityRequirements
    @PostMapping("/oauth/google")
    @RateLimited(key = "auth-oauth", maxRequests = 15,
                 message = "Too many OAuth login attempts. Please try again in %d seconds.")
    public ResponseEntity<AuthResponse> oauthLogin(
            @Valid @org.springframework.web.bind.annotation.RequestBody OAuthRequest request) {
        log.info("Google OAuth login verification initiated");
        GoogleIdTokenVerifier.VerifiedIdentity identity = googleIdTokenVerifier.verify(request.idToken());
        log.info("Google OAuth token verified for email={}", LoggingUtils.maskEmail(identity.email()));

        User user = userService.findByEmail(identity.email()).orElseGet(() -> {
            User newUser = new User();
            newUser.setName(identity.name());
            newUser.setEmail(identity.email());
            newUser.setPassword(UUID.randomUUID().toString());

            // 1. Resolve currency: client preference > default "INR"
            String reqCurrency = request.currency();
            if (reqCurrency != null && reqCurrency.trim().matches("^[A-Za-z]{3}$")) {
                newUser.setCurrency(reqCurrency.trim().toUpperCase(java.util.Locale.ROOT));
            } else {
                newUser.setCurrency("INR");
            }

            // 2. Resolve username: custom preference > generated unique handle
            String targetUsername = null;
            if (request.username() != null && request.username().trim().matches("^[a-zA-Z0-9._]{3,30}$")) {
                String candidate = request.username().trim();
                if (!userService.userExistsByUsername(candidate)) {
                    targetUsername = candidate;
                }
            }
            if (targetUsername == null) {
                targetUsername = generateUniqueOAuthUsername(identity.email(), identity.name());
            }
            newUser.setUsername(targetUsername);

            log.info("Auto-registering new user via Google OAuth: email={}, username={}, currency={}",
                    LoggingUtils.maskEmail(newUser.getEmail()), newUser.getUsername(), newUser.getCurrency());
            return userService.registerUser(newUser);
        });

        // SECURITY FIX: previously, a user whose account had been disabled or locked
        // could still authenticate via Google Sign-In (the OAuth flow bypassed the
        // standard Spring Security authentication path that checks these flags).
        // Now we explicitly reject disabled/locked accounts with 401 Unauthorized,
        // matching the standard login flow's behavior.
        if (!user.isEnabled() || user.isAccountLocked()) {
            log.warn("Google OAuth login rejected for disabled/locked account email={}",
                    LoggingUtils.maskEmail(identity.email()));
            throw new org.springframework.security.authentication.BadCredentialsException(
                    "Account is disabled or locked. Please contact support.");
        }

        String token = jwtService.generateToken(user.getEmail());
        log.info("Google OAuth login successful for userId={}", user.getId());
        return ResponseEntity.ok(new AuthResponse(
                token,
                user.getId(),
                user.getName(),
                user.getUsername(),
                user.getEmail(),
                user.getCurrency(),
                user.hasSecurityPin()
        ));
    }

    private String generateUniqueOAuthUsername(String email, String name) {
        String base = "";
        if (email != null && email.contains("@")) {
            base = email.substring(0, email.indexOf('@')).replaceAll("[^a-zA-Z0-9._]", "_");
        } else if (name != null && !name.isBlank()) {
            base = name.trim().toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-zA-Z0-9._]", "_");
        }
        if (base.length() < 3) {
            base = (base + "user").substring(0, Math.min(base.length() + 4, 30));
        }
        if (base.length() > 24) {
            base = base.substring(0, 24);
        }
        if (!userService.userExistsByUsername(base)) {
            return base;
        }
        int suffix = 1;
        while (suffix < 10000) {
            String candidate = base + suffix;
            if (candidate.length() > 30) {
                candidate = base.substring(0, 30 - String.valueOf(suffix).length()) + suffix;
            }
            if (!userService.userExistsByUsername(candidate)) {
                return candidate;
            }
            suffix++;
        }
        return "user_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }
}
