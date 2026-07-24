Feature: Authentication API
  As a user of the Expense Tracker system
  I want to register, login, and manage my credentials
  So that I can securely access my financial data

  # ─── Registration ────────────────────────────────────────────────────────

  Scenario: Register a new user successfully
    Registers a brand-new user with a valid name, unique email, and a password
    that meets the minimum length requirement. Expects HTTP 201 with the new
    user's email and enabled=true in the response body. Password must NOT
    appear in the response.

    When I register with name "John Doe", email "john.doe@example.com", and password "secret123"
    Then the response status code should be 201
    And the response should contain field "email" with value "john.doe@example.com"
    And the response should contain field "enabled" with value "true"

  Scenario: Register fails when email is already taken
    Attempts to register a second account using an email address that already
    exists in the system. The service throws IllegalArgumentException("Email
    already registered") which the GlobalExceptionHandler maps to HTTP 400.

    Given a user is registered with email "duplicate@example.com" and password "pass123"
    When I register with name "Another User", email "duplicate@example.com", and password "pass123"
    Then the response status code should be 400

  Scenario: Register fails when email format is invalid
    Submits a registration request with a malformed email address that does not
    contain an @ symbol. Bean validation ("@Email" on RegisterRequest) rejects
    the request before it reaches the service layer, returning HTTP 400.

    When I register with name "Bad User", email "not-an-email", and password "pass123"
    Then the response status code should be 400

  Scenario: Register fails when password is too short
    Submits a registration request with a 3-character password. The "@Size(min=6)"
    constraint on RegisterRequest.password triggers a MethodArgumentNotValidException
    which is translated to HTTP 400 by the GlobalExceptionHandler.

    When I register with name "Weak Pass", email "weakpass@example.com", and password "abc"
    Then the response status code should be 400

  Scenario: Register fails when name is blank
    Submits a registration request with an empty string as the name.
    The "@NotBlank" constraint on RegisterRequest.name triggers validation failure
    and returns HTTP 400 before the business logic is invoked.

    When I register with name "", email "noname@example.com", and password "pass123"
    Then the response status code should be 400

  # ─── Login ───────────────────────────────────────────────────────────────

  Scenario: Login with valid credentials returns JWT token
    Authenticates a previously registered user with the correct password.
    Expects HTTP 200 and a response body containing a non-blank JWT token,
    the user's database ID (userId), and their display name. The token must
    be passed as "Authorization: Bearer <token>" on subsequent requests.

    Given a user is registered with email "login.success@example.com" and password "pass1234"
    When I login with email "login.success@example.com" and password "pass1234"
    Then the response status code should be 200
    And the response should contain a JWT token
    And the response should contain a userId
    And the response should contain a name

  Scenario: Login fails with wrong password
    Attempts to login with a registered email but an incorrect password.
    Spring Security throws BadCredentialsException which the handler maps
    to HTTP 401. The response message is intentionally generic to avoid
    revealing whether the email exists.

    Given a user is registered with email "login.fail@example.com" and password "correctPass"
    When I login with email "login.fail@example.com" and password "wrongPass"
    Then the response status code should be 401

  Scenario: Login fails with unregistered email
    Attempts to login using an email address that has never been registered.
    Spring Security's UserDetailsService throws UsernameNotFoundException,
    wrapped as InternalAuthenticationServiceException, which maps to HTTP 401.

    When I login with email "nobody@example.com" and password "pass123"
    Then the response status code should be 401

  Scenario: Login fails when email field is blank
    Submits a login request with an empty email string. The "@NotBlank"
    constraint on LoginRequest.email triggers bean validation failure and
    returns HTTP 400 before authentication is attempted.

    When I login with email "" and password "pass123"
    Then the response status code should be 400

  # ─── Password Reset ───────────────────────────────────────────────────────

  Scenario: Reset password successfully
    Resets the password of an existing account and verifies the change takes
    effect by immediately logging in with the new password. The old password
    is no longer valid after the reset. The new password is BCrypt-encoded
    before being stored.

    Given a user is registered with email "reset.me@example.com" and password "oldPass123"
    When I reset the password for "reset.me@example.com" to "newPass456"
    Then the response status code should be 200
    And I can login with email "reset.me@example.com" and new password "newPass456"

  Scenario: Reset password fails when email does not exist
    Attempts to reset the password for an email that has never been registered.
    UserServiceImpl.updatePassword throws IllegalArgumentException("User not found")
    which GlobalExceptionHandler maps to HTTP 400 Bad Request (not 404, because
    the controller uses IllegalArgumentException rather than NoSuchElementException).

    When I reset the password for "ghost@example.com" to "newPass456"
    Then the response status code should be 400

  Scenario: Reset password fails when email field is missing
    Submits a reset-password request with a null email field. The controller
    explicitly checks for null email/newPassword and returns HTTP 400 before
    calling the service layer.

    When I send a reset password request without an email
    Then the response status code should be 400
