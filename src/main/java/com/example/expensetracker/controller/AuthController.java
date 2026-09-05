package com.example.expensetracker.controller;

import com.example.expensetracker.dto.*;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

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
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserService userService;
    private final GoogleIdTokenVerifier googleIdTokenVerifier;
    private final PasswordResetService passwordResetService;

    @Value("${app.auth.email-verification-enabled:false}")
    private boolean emailVerificationEnabled;

    public AuthController(AuthenticationManager authenticationManager,
                          JwtService jwtService,
                          UserService userService,
                          GoogleIdTokenVerifier googleIdTokenVerifier,
                          PasswordResetService passwordResetService) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.userService = userService;
        this.googleIdTokenVerifier = googleIdTokenVerifier;
        this.passwordResetService = passwordResetService;
    }

    // ─── GET /api/auth/config ───────────────────────────────────────────────────

    @Operation(summary = "Get auth configuration",
        description = "Returns public configuration flags like whether email OTP verification is required.")
    @SecurityRequirements
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getAuthConfig() {
        log.debug("Auth configuration requested: emailVerificationEnabled={}", emailVerificationEnabled);
        return ResponseEntity.ok(Map.of(
            "emailVerificationEnabled", emailVerificationEnabled
        ));
    }

    // ─── POST /api/auth/login ────────────────────────────────────────────────────

    @Operation(summary = "Login",
        description = "Authenticates a registered user and issues a signed JWT Bearer token including preferred currency.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Login successful — JWT token returned",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = AuthResponse.class),
                examples = @ExampleObject(name = "auth-login-200",
                    value = "{ \"token\": \"eyJ...\", \"userId\": 1, \"name\": \"John Doe\", \"currency\": \"INR\" }"))),
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
    @RateLimited(key = "auth-login", maxRequests = 10, windowSeconds = 60, message = "Too many login attempts. Please try again in %d seconds.")
    public ResponseEntity<AuthResponse> login(
            @Valid @org.springframework.web.bind.annotation.RequestBody LoginRequest request) {
        String identifier = request.getEmail() != null ? request.getEmail().trim() : "";
        log.info("Login attempt for identifier={}", identifier);
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(identifier, request.getPassword()));

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
        log.info("User {} (id={}) successfully authenticated", user.getEmail(), user.getId());
        return ResponseEntity.ok(new AuthResponse(token, user.getId(), user.getName(), user.getCurrency(), user.hasSecurityPin()));
    }

    // ─── POST /api/auth/signup/send-otp ──────────────────────────────────────────

    @Operation(summary = "Send signup verification OTP",
        description = """
            Sends a 6-digit email verification code required before account creation.
            Returns 400 if the email is already registered.
            The code expires in 10 minutes. A new call invalidates any previous code.
            """)
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "OTP sent to the provided email address"),
        @ApiResponse(responseCode = "400", description = "Email already registered or validation failed",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "429", description = "Too many OTP requests (rate limit exceeded)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @SecurityRequirements
    @PostMapping("/signup/send-otp")
    @RateLimited(key = "auth-signup-otp", maxRequests = 5, windowSeconds = 300, message = "Too many OTP requests. Please try again in %d seconds.")
    public ResponseEntity<Map<String, String>> sendSignupOtp(
            @Valid @org.springframework.web.bind.annotation.RequestBody SignupOtpRequest request) {
        log.info("Request received to send signup OTP for email={}", request.getEmail());
        boolean sent = passwordResetService.sendSignupOtp(request.getEmail(), request.getName());
        if (!sent) {
            log.warn("Signup OTP not sent: email {} is already registered", request.getEmail());
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "This email address is already registered."));
        }
        log.info("Signup OTP dispatched for email={}", request.getEmail());
        return ResponseEntity.ok(Map.of(
            "message", "Verification code sent to " + request.getEmail(),
            "emailVerificationEnabled", String.valueOf(emailVerificationEnabled)
        ));
    }

    // ─── POST /api/auth/register ─────────────────────────────────────────────────

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
    @RateLimited(key = "auth-register", maxRequests = 10, windowSeconds = 60, message = "Too many registration attempts. Please try again in %d seconds.")
    public ResponseEntity<UserDto> register(
            @Valid @org.springframework.web.bind.annotation.RequestBody RegisterRequest request) {
        log.info("Registration request received for email={}, username={}", request.getEmail(), request.getUsername());
        // Verify OTP if email verification is enabled or if an explicit OTP was submitted
        if (emailVerificationEnabled || (request.getOtp() != null && !request.getOtp().isBlank() && !"BYPASS".equalsIgnoreCase(request.getOtp()))) {
            passwordResetService.verifySignupOtp(request.getEmail(), request.getOtp());
        }

        User user = new User();
        user.setName(request.getName());
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPassword(request.getPassword());
        user.setCurrency(request.getCurrency());
        if (request.getSecurityPin() != null && !request.getSecurityPin().isBlank()) {
            user.setSecurityPinHash(request.getSecurityPin().trim());
        }
        User registeredUser = userService.registerUser(user);
        log.info("User registered successfully with id={}, email={}", registeredUser.getId(), registeredUser.getEmail());
        return new ResponseEntity<>(UserMapper.toDto(registeredUser), HttpStatus.CREATED);
    }

    // ─── POST /api/auth/forgot-password ──────────────────────────────────────────

    @Operation(summary = "Request password reset",
        description = "Initializes password recovery. Returns whether a Security PIN is set and if email OTP was sent.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Reset verification flow initialized"),
        @ApiResponse(responseCode = "404", description = "No account found with this email address",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "429", description = "Too many password recovery requests (rate limit exceeded)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @SecurityRequirements
    @PostMapping("/forgot-password")
    @RateLimited(key = "auth-forgot-password", maxRequests = 5, windowSeconds = 300, message = "Too many password recovery requests. Please try again in %d seconds.")
    public ResponseEntity<Map<String, Object>> forgotPassword(
            @Valid @org.springframework.web.bind.annotation.RequestBody ForgotPasswordRequest request) {
        log.info("Password reset requested for email={}", request.getEmail());
        boolean hasPin = false;
        try {
            Optional<User> userOpt = userService.findByEmail(request.getEmail());
            if (userOpt.isPresent()) {
                hasPin = userOpt.get().hasSecurityPin();
            }
            passwordResetService.requestReset(request.getEmail());
        } catch (Exception e) {
            log.info("Password reset notice for email={}: {}", request.getEmail(), e.getMessage());
        }
        log.info("Password reset initialized for email={}", request.getEmail());
        return ResponseEntity.ok(Map.of(
            "email", request.getEmail(),
            "hasSecurityPin", hasPin,
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
    @RateLimited(key = "auth-reset-password", maxRequests = 5, windowSeconds = 600, message = "Too many password reset attempts. Please try again in %d seconds.")
    public ResponseEntity<Void> resetPassword(
            @Valid @org.springframework.web.bind.annotation.RequestBody ResetPasswordRequest request) {
        log.info("Password reset execution requested for email={}", request.getEmail());
        String code = request.resolveVerificationCode();
        passwordResetService.resetPassword(request.getEmail(), code, request.getNewPassword());
        log.info("Password successfully updated for email={}", request.getEmail());
        return ResponseEntity.ok().build();
    }

    // ─── POST /api/auth/oauth/google ─────────────────────────────────────────────

    @Operation(summary = "OAuth Login / Signup",
        description = "Authenticates or registers a user via Google Sign-In. Google OAuth users bypass the OTP signup flow.")
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
    @RateLimited(key = "auth-oauth", maxRequests = 15, windowSeconds = 60, message = "Too many OAuth login attempts. Please try again in %d seconds.")
    public ResponseEntity<AuthResponse> oauthLogin(
            @Valid @org.springframework.web.bind.annotation.RequestBody OAuthRequest request) {
        log.info("Google OAuth login verification initiated");
        GoogleIdTokenVerifier.VerifiedIdentity identity = googleIdTokenVerifier.verify(request.getIdToken());
        log.info("Google OAuth token verified for email={}", identity.email());

        User user = userService.findByEmail(identity.email()).orElseGet(() -> {
            log.info("Google OAuth user {} not found; registering new account", identity.email());
            User newUser = new User();
            newUser.setName(identity.name());
            newUser.setEmail(identity.email());
            newUser.setPassword(java.util.UUID.randomUUID().toString());
            newUser.setCurrency("INR");
            return userService.registerUser(newUser);
        });

        String token = jwtService.generateToken(user.getEmail());
        log.info("Google OAuth login successful for userId={}, email={}", user.getId(), user.getEmail());
        return ResponseEntity.ok(new AuthResponse(token, user.getId(), user.getName(), user.getCurrency(), user.hasSecurityPin()));
    }
}
