package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Response returned on successful authentication (POST /api/auth/login). */
@Schema(description = "JWT token and basic user info returned after a successful login")
public class AuthResponse {

    @Schema(description = "Signed JWT Bearer token. Pass as: Authorization: Bearer <token>", example = "eyJhbGciOiJIUzI1NiJ9...")
    private String token;

    @Schema(description = "Unique database ID of the authenticated user", example = "1")
    private Long userId;

    @Schema(description = "Display name of the authenticated user", example = "John Doe")
    private String name;

    @Schema(description = "Preferred display currency of the authenticated user (ISO 4217)", example = "INR")
    private String currency;

    @Schema(description = "Whether the user has configured a 6-digit Security PIN for zero-email recovery", example = "true")
    private Boolean hasSecurityPin;

    public AuthResponse(String token, Long userId, String name, String currency) {
        this(token, userId, name, currency, false);
    }

    public AuthResponse(String token, Long userId, String name, String currency, Boolean hasSecurityPin) {
        this.token          = token;
        this.userId         = userId;
        this.name           = name;
        this.currency       = currency;
        this.hasSecurityPin = hasSecurityPin;
    }

    public String  getToken()          { return token; }
    public Long    getUserId()         { return userId; }
    public String  getName()           { return name; }
    public String  getCurrency()       { return currency; }
    public Boolean getHasSecurityPin() { return hasSecurityPin; }
}
