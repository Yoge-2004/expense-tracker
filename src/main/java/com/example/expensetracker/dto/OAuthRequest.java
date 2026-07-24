package com.example.expensetracker.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OAuthRequest {
    @NotBlank(message = "Token or code is required")
    private String idToken;
    private String email;
    private String name;
}
