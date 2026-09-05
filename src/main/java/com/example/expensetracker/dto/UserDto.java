package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Public user profile returned after registration (password is never included). */
@Schema(description = "Public profile of a registered user. Password is intentionally excluded.")
public class UserDto {

    @Schema(description = "Unique database identifier of the user", example = "1")
    private Long id;

    @Schema(description = "Full display name of the user", example = "John Doe")
    private String name;

    @Schema(description = "Unique handle/username of the user", example = "johndoe")
    private String username;

    @Schema(description = "Email address associated with the user account", example = "john.doe@example.com")
    private String email;

    @Schema(description = "Whether the account is active and permitted to authenticate", example = "true")
    private boolean enabled;

    @Schema(description = "Preferred display currency (ISO 4217 3-letter code)", example = "INR")
    private String currency;

    public UserDto() {}

    public UserDto(Long id, String name, String username, String email, boolean enabled, String currency) {
        this.id       = id;
        this.name     = name;
        this.username = username;
        this.email    = email;
        this.enabled  = enabled;
        this.currency = currency;
    }

    public Long    getId()                  { return id; }
    public void    setId(Long id)           { this.id = id; }
    public String  getName()                { return name; }
    public void    setName(String name)     { this.name = name; }
    public String  getUsername()            { return username; }
    public void    setUsername(String u)    { this.username = u; }
    public String  getEmail()               { return email; }
    public void    setEmail(String email)   { this.email = email; }
    public boolean isEnabled()              { return enabled; }
    public void    setEnabled(boolean e)    { this.enabled = e; }
    public String  getCurrency()            { return currency; }
    public void    setCurrency(String c)    { this.currency = c; }
}
