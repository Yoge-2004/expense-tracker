package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/** Request body for POST /api/auth/login. */
@Schema(description = "Credentials required to authenticate a user")
public class LoginRequest {

    @Schema(description = "Registered email address of the user", example = "john.doe@example.com", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email")
    private String email;

    @Schema(description = "Account password (compared against BCrypt hash)", example = "secret123", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "Password is required")
    private String password;

    public LoginRequest() {}

    public String getEmail()               { return email; }
    public void   setEmail(String email)   { this.email = email; }
    public String getPassword()            { return password; }
    public void   setPassword(String p)    { this.password = p; }
}
