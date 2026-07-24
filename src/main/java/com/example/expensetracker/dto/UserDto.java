package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Public user profile returned after registration (password is never included). */
@Schema(description = "Public profile of a registered user. Password is intentionally excluded.")
public class UserDto {

    @Schema(description = "Unique database identifier of the user", example = "1")
    private Long id;

    @Schema(description = "Email address associated with the user account", example = "john.doe@example.com")
    private String email;

    @Schema(description = "Whether the account is active and permitted to authenticate", example = "true")
    private boolean enabled;

    public UserDto() {}

    public UserDto(Long id, String email, boolean enabled) {
        this.id      = id;
        this.email   = email;
        this.enabled = enabled;
    }

    public Long    getId()                  { return id; }
    public void    setId(Long id)           { this.id = id; }
    public String  getEmail()               { return email; }
    public void    setEmail(String email)   { this.email = email; }
    public boolean isEnabled()              { return enabled; }
    public void    setEnabled(boolean e)    { this.enabled = e; }
}
