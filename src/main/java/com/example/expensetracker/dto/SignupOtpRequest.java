package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/** Request body for POST /api/auth/signup/send-otp. */
@Schema(description = "Email and name for the signup OTP verification step")
public class SignupOtpRequest {

    @Schema(description = "Email address to send the 6-digit verification code to",
            example = "john.doe@example.com", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    private String email;

    @Schema(description = "Prospective user's display name — used in the email body",
            example = "John Doe", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "Name is required")
    private String name;

    public SignupOtpRequest() {}

    public String getEmail()              { return email; }
    public void   setEmail(String email)  { this.email = email; }
    public String getName()               { return name; }
    public void   setName(String name)    { this.name = name; }
}
