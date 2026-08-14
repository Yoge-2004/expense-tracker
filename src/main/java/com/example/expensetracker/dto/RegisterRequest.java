package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Request body for POST /api/auth/register. */
@Schema(description = "Information required to create a new user account")
public class RegisterRequest {

    @Schema(description = "Full display name of the new user", example = "John Doe", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "Name is required")
    private String name;

    @Schema(description = "Email address — used as the unique login identifier", example = "john.doe@example.com", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    private String email;

    @Schema(description = "Plain-text password — BCrypt-encoded before storage. Minimum 6 characters.", example = "secret123", minLength = 6, requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "Password is required")
    @Size(min = 6, message = "Password must be at least 6 characters")
    private String password;

    @Schema(description = "6-digit email verification OTP (required when email verification is enabled)", example = "482913")
    private String otp;

    @Schema(description = "Preferred display currency (ISO 4217 3-letter code). Defaults to INR if omitted.", example = "INR")
    private String currency = "INR";

    public RegisterRequest() {}

    public String getName()                 { return name; }
    public void   setName(String name)      { this.name = name; }
    public String getEmail()                { return email; }
    public void   setEmail(String email)    { this.email = email; }
    public String getPassword()             { return password; }
    public void   setPassword(String p)     { this.password = p; }
    public String getOtp()                  { return otp; }
    public void   setOtp(String otp)        { this.otp = otp; }
    public String getCurrency()             { return currency != null ? currency : "INR"; }
    public void   setCurrency(String c)     { this.currency = c; }
}

