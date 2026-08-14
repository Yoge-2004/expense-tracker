package com.example.expensetracker.controller;

import com.example.expensetracker.dto.*;
import com.example.expensetracker.mapper.UserMapper;
import com.example.expensetracker.model.User;
import com.example.expensetracker.security.GoogleIdTokenVerifier;
import com.example.expensetracker.security.JwtService;
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
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

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

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserService userService;
    private final GoogleIdTokenVerifier googleIdTokenVerifier;
    private final PasswordResetService passwordResetService;

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

    // ─── POST /api/auth/login ─────────────────────────────────────────────

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
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @SecurityRequirements
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @org.springframework.web.bind.annotation.RequestBody LoginRequest request) {
        String identifier = request.getEmail() != null ? request.getEmail().trim() : "";
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(identifier, request.getPassword()));
        User user = userService.findByIdentifier(identifier)
                .or(() -> userService.findByEmail(identifier))
                .or(() -> userService.findByIdentifier(auth.getName()))
                .or(() -> userService.findByEmail(auth.getName()))
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String token = jwtService.generateToken(user.getEmail());
        return ResponseEntity.ok(new AuthResponse(token, user.getId(), user.getName(), user.getCurrency()));
    }

    // ─── POST /api/auth/signup/send-otp ──────────────────────────────────

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
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @SecurityRequirements
    @PostMapping("/signup/send-otp")
    public ResponseEntity<Map<String, String>> sendSignupOtp(
            @Valid @org.springframework.web.bind.annotation.RequestBody SignupOtpRequest request) {
        boolean sent = passwordResetService.sendSignupOtp(request.getEmail(), request.getName());
        if (!sent) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "This email address is already registered."));
        }
        return ResponseEntity.ok(Map.of("message", "Verification code sent to " + request.getEmail()));
    }

    // ─── POST /api/auth/register ──────────────────────────────────────────

    @Operation(summary = "Register",
        description = """
            Creates a new user account after verifying the email OTP issued by
            `POST /api/auth/signup/send-otp`.

            Fields: name, email, password (min 6 chars), otp (6-digit code), currency (optional, default INR).
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
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @SecurityRequirements
    @PostMapping("/register")
    public ResponseEntity<UserDto> register(
            @Valid @org.springframework.web.bind.annotation.RequestBody RegisterRequest request) {
        // Verify the signup OTP before creating the account.
        passwordResetService.verifySignupOtp(request.getEmail(), request.getOtp());

        User user = new User();
        user.setName(request.getName());
        user.setEmail(request.getEmail());
        user.setPassword(request.getPassword());
        user.setCurrency(request.getCurrency());
        User registeredUser = userService.registerUser(user);
        return new ResponseEntity<>(UserMapper.toDto(registeredUser), HttpStatus.CREATED);
    }

    // ─── POST /api/auth/forgot-password ───────────────────────────────────

    @Operation(summary = "Request password reset code",
        description = "Sends a 6-digit one-time code to the account's email. Always responds 200 to avoid email enumeration.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "If an account exists for this email, a code has been sent")
    })
    @SecurityRequirements
    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(
            @Valid @org.springframework.web.bind.annotation.RequestBody ForgotPasswordRequest request) {
        passwordResetService.requestReset(request.getEmail());
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Reset password",
        description = "Resets the password given a valid OTP from POST /api/auth/forgot-password.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Password reset successfully"),
        @ApiResponse(responseCode = "401", description = "Invalid, expired or already-used OTP",
            content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                schema = @Schema(implementation = ErrorResponse.class)))
    })
    @SecurityRequirements
    @PutMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(
            @Valid @org.springframework.web.bind.annotation.RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request.getEmail(), request.getOtp(), request.getNewPassword());
        return ResponseEntity.ok().build();
    }

    // ─── POST /api/auth/oauth/google ──────────────────────────────────────

    @Operation(summary = "OAuth Login / Signup",
        description = "Authenticates or registers a user via Google Sign-In. Google OAuth users bypass the OTP signup flow.")
    @SecurityRequirements
    @PostMapping("/oauth/google")
    public ResponseEntity<AuthResponse> oauthLogin(
            @Valid @org.springframework.web.bind.annotation.RequestBody OAuthRequest request) {
        GoogleIdTokenVerifier.VerifiedIdentity identity = googleIdTokenVerifier.verify(request.getIdToken());

        User user = userService.findByEmail(identity.email()).orElseGet(() -> {
            User newUser = new User();
            newUser.setName(identity.name());
            newUser.setEmail(identity.email());
            newUser.setPassword(java.util.UUID.randomUUID().toString());
            newUser.setCurrency("INR");
            return userService.registerUser(newUser);
        });

        String token = jwtService.generateToken(user.getEmail());
        return ResponseEntity.ok(new AuthResponse(token, user.getId(), user.getName(), user.getCurrency()));
    }
}
