Feature: Authentication API
  As a user of the Expense Tracker system
  I want to register, login, and manage my credentials
  So that I can securely access my financial data

  # ─── Registration ────────────────────────────────────────────────────────
  # Organized by what's under test: happy path & response shape, name field,
  # email field, password field, malformed requests, then cross-field cases.

  # -- Happy path & response shape --

  Scenario: Register a new user successfully
    Registers a brand-new user with a valid name, unique email, and a password
    that meets the minimum length requirement. Expects HTTP 201 with the new
    user's email and enabled=true in the response body.

    When I register with name "John Doe", email "john.doe@example.com", and password "secret123"
    Then the response status code should be 201
    And the response should contain field "email" with value "john.doe@example.com"
    And the response should contain field "enabled" with value "true"

  Scenario: Successful registration never echoes the password back
    Regardless of how the password is stored (BCrypt-encoded) or represented
    internally, the API response must never include it in any form —
    plaintext or hashed.

    When I register with name "Privacy Check", email "privacy.check@example.com", and password "secret123"
    Then the response status code should be 201
    And the response should not contain field "password"

  Scenario: Successful registration returns a database id
    The response should include the newly assigned numeric id so the client
    can reference the account without a follow-up lookup.

    When I register with name "Id Check", email "id.check@example.com", and password "secret123"
    Then the response status code should be 201
    And the response should contain an id

  # -- Name field --

  Scenario: Register fails when name is blank
    Submits a registration request with an empty string as the name.
    The "@NotBlank" constraint on RegisterRequest.name triggers validation
    failure and returns HTTP 400 before the business logic is invoked.

    When I register with name "", email "noname@example.com", and password "pass123"
    Then the response status code should be 400

  Scenario: Register fails when the name field is entirely missing
    Omits the "name" key from the JSON body altogether (not just an empty
    string). Jackson deserializes the missing field as null, which
    "@NotBlank" also rejects — same 400 outcome via a different code path.

    When I register without a name field, with email "missingname@example.com" and password "pass123"
    Then the response status code should be 400

  Scenario: Register fails when name is whitespace-only
    A name of only spaces is not "blank" in the naive sense but "@NotBlank"
    trims before checking, so this is rejected the same as an empty string.

    When I register with name "   ", email "whitespace.name@example.com", and password "pass123"
    Then the response status code should be 400

  Scenario: Register succeeds with a name containing unicode characters
    Names aren't restricted to ASCII — accented and non-Latin characters
    must be accepted.

    When I register with name "José Müller 田中", email "unicode.name@example.com", and password "pass123"
    Then the response status code should be 201
    And the response should contain field "email" with value "unicode.name@example.com"

  Scenario: Register succeeds with a very long name
    There is no "@Size(max=...)" constraint on the name field, so a long
    (but not absurd) name should be accepted rather than silently truncated
    or rejected.

    When I register with name "Alexandria Bartholomew Fitzgerald Montgomery Wellington Chesterfield the Third of Northumberland", email "longname@example.com", and password "pass123"
    Then the response status code should be 201

  Scenario: Register stores a name containing markup verbatim
    The registration endpoint does not sanitize or reject HTML-like content
    in the name — output escaping is a rendering-layer concern, not a
    storage-layer one. This documents that expectation rather than assuming
    the backend strips it.

    When I register with name "<script>alert(1)</script>", email "markup.name@example.com", and password "pass123"
    Then the response status code should be 201
    And the response should contain field "name" with value "<script>alert(1)</script>"

  # -- Email field --

  Scenario: Register fails when email format is invalid (missing @ symbol)
    Bean validation ("@Email" on RegisterRequest) rejects the request before
    it reaches the service layer, returning HTTP 400.

    When I register with name "Bad User", email "not-an-email", and password "pass123"
    Then the response status code should be 400

  Scenario: Register fails when email is missing the domain
    An email like "user@" has an @ but nothing after it — still invalid.

    When I register with name "Bad Domain", email "user@", and password "pass123"
    Then the response status code should be 400

  Scenario: Register fails when email contains spaces
    Whitespace inside the local or domain part is never a valid email.

    When I register with name "Spacey", email "us er@example.com", and password "pass123"
    Then the response status code should be 400

  Scenario: Register fails when email is blank
    An empty string fails "@NotBlank" before "@Email" is even evaluated.

    When I register with name "No Email", email "", and password "pass123"
    Then the response status code should be 400

  Scenario: Register fails when the email field is entirely missing
    Omits the "email" key from the JSON body altogether.

    When I register with name "No Email Field", without an email field, and password "pass123"
    Then the response status code should be 400

  Scenario: Register fails when email is already taken
    Attempts to register a second account using an email address that
    already exists in the system. The service throws
    IllegalArgumentException("Email already registered") which the
    GlobalExceptionHandler maps to HTTP 400.

    Given a user is registered with email "duplicate@example.com" and password "pass123"
    When I register with name "Another User", email "duplicate@example.com", and password "pass123"
    Then the response status code should be 400

  Scenario: Email uniqueness is case-sensitive, not case-insensitive
    Documents actual current behavior: UserRepository's email lookup is
    case-sensitive (see its Javadoc), so "Case@Example.com" and
    "case@example.com" are treated as two different accounts rather than
    a duplicate. This may or may not be the intended product behavior, but
    the test should reflect what the system actually does today.

    Given a user is registered with email "case@example.com" and password "pass123"
    When I register with name "Different Case", email "Case@Example.com", and password "pass123"
    Then the response status code should be 201

  Scenario: Register succeeds with a plus-addressed email
    "+tag" addressing is valid email syntax and a common real-world pattern
    (e.g. Gmail filters) — must not be rejected.

    When I register with name "Plus Tag", email "user+expenses@example.com", and password "pass123"
    Then the response status code should be 201

  Scenario: Register succeeds with a subdomain email
    When I register with name "Subdomain", email "user@mail.example.co.uk", and password "pass123"
    Then the response status code should be 201

  # -- Password field --

  Scenario: Register fails when password is too short
    Submits a registration request with a 3-character password. The
    "@Size(min=6)" constraint on RegisterRequest.password triggers a
    MethodArgumentNotValidException, translated to HTTP 400.

    When I register with name "Weak Pass", email "weakpass@example.com", and password "abc"
    Then the response status code should be 400

  Scenario: Register fails when password is one character short of the minimum
    Boundary test: exactly 5 characters, one below the 6-character minimum.

    When I register with name "Boundary Low", email "boundary.low@example.com", and password "abcde"
    Then the response status code should be 400

  Scenario: Register succeeds at exactly the minimum password length
    Boundary test: exactly 6 characters, the minimum allowed.

    When I register with name "Boundary Exact", email "boundary.exact@example.com", and password "abcdef"
    Then the response status code should be 201

  Scenario: Register fails when password is blank
    When I register with name "Blank Pass", email "blankpass@example.com", and password ""
    Then the response status code should be 400

  Scenario: Register fails when the password field is entirely missing
    Omits the "password" key from the JSON body altogether.

    When I register with name "No Pass Field", email "nopassfield@example.com", and without a password field
    Then the response status code should be 400

  Scenario: Register succeeds with a long, high-entropy password
    No maximum length is enforced — a long passphrase should work fine.

    When I register with name "Long Pass", email "longpass@example.com", and password "correct-horse-battery-staple-and-a-few-more-words-for-good-measure"
    Then the response status code should be 201

  Scenario: Register succeeds with special characters and unicode in the password
    When I register with name "Special Pass", email "specialpass@example.com", and password "p@$$wörd!123"
    Then the response status code should be 201

  # -- Malformed requests --

  Scenario: Register fails on malformed JSON
    A syntactically broken request body should be rejected with 400, not
    surfaced as a 500 — Spring's message converter fails before the
    controller method (and its @Valid) is ever invoked.

    When I send a registration request with malformed JSON
    Then the response status code should be 400

  # -- Cross-field --

  Scenario: Register with multiple invalid fields still returns a single clear 400
    Both name and email are invalid at the same time here. The request is
    still rejected with 400 — the exact field reported first is an
    implementation detail (GlobalExceptionHandler reports the first
    binding error found), so this only asserts the outcome, not which
    field is named.

    When I register with name "", email "not-an-email", and password "pass123"
    Then the response status code should be 400

  Scenario: Registering twice with the same valid data fails the second time
    A sanity check that registration isn't accidentally idempotent —
    the same request replayed must fail on the second attempt.

    When I register with name "Repeat User", email "repeat.user@example.com", and password "pass123"
    Then the response status code should be 201
    When I register with name "Repeat User", email "repeat.user@example.com", and password "pass123"
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

  Scenario: Login response never echoes the password back
    Given a user is registered with email "login.privacy@example.com" and password "pass1234"
    When I login with email "login.privacy@example.com" and password "pass1234"
    Then the response status code should be 200
    And the response should not contain field "password"

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

  Scenario: Login fails when email is different case from how it was registered
    Documents the same case-sensitivity as registration, from the other
    direction: UserRepository's email lookup is case-sensitive, so logging
    in with different capitalization than what was actually stored fails
    as if the account didn't exist — not as a "wrong password."

    Given a user is registered with email "casesensitive@example.com" and password "pass1234"
    When I login with email "CaseSensitive@example.com" and password "pass1234"
    Then the response status code should be 401

  Scenario: Login fails when email field is blank
    Submits a login request with an empty email string. The "@NotBlank"
    constraint on LoginRequest.email triggers bean validation failure and
    returns HTTP 400 before authentication is attempted.

    When I login with email "" and password "pass123"
    Then the response status code should be 400

  Scenario: Login fails when the email field is entirely missing
    When I login without an email field, with password "pass123"
    Then the response status code should be 400

  Scenario: Login fails when email format is invalid
    LoginRequest.email also carries "@Email", not just "@NotBlank" — a
    syntactically invalid address is rejected by bean validation before
    any authentication attempt, the same as registration.

    When I login with email "not-an-email" and password "pass123"
    Then the response status code should be 400

  Scenario: Login fails when password is blank
    Given a user is registered with email "blankpwtest@example.com" and password "pass1234"
    When I login with email "blankpwtest@example.com" and password ""
    Then the response status code should be 400

  Scenario: Login fails when the password field is entirely missing
    Given a user is registered with email "nopwfieldtest@example.com" and password "pass1234"
    When I login with email "nopwfieldtest@example.com", without a password field
    Then the response status code should be 400

  Scenario: Login fails on malformed JSON
    When I send a login request with malformed JSON
    Then the response status code should be 400

  # ─── Password Reset ───────────────────────────────────────────────────────

  Scenario: Reset password successfully
    Requests a one-time code for a registered account, then uses that exact
    code to set a new password, and verifies the change takes effect by
    immediately logging in with the new password. The old password is no
    longer valid after the reset. The new password is BCrypt-encoded before
    being stored, and the OTP itself is never stored or transmitted in
    plaintext except in the original email.

    Given a user is registered with email "reset.me@example.com" and password "oldPass123"
    When I request a password reset code for "reset.me@example.com"
    And I reset the password for "reset.me@example.com" to "newPass456" using the issued code
    Then the response status code should be 200
    And I can login with email "reset.me@example.com" and new password "newPass456"

  Scenario: Reset password fails with an incorrect code
    Even for a registered account with a code genuinely in flight, submitting
    the wrong 6-digit value is rejected — proving the endpoint no longer
    trusts an email address alone, unlike before this fix.

    Given a user is registered with email "wrongcode@example.com" and password "oldPass123"
    When I request a password reset code for "wrongcode@example.com"
    And I submit reset password for "wrongcode@example.com" with code "000000" and new password "newPass456"
    Then the response status code should be 401

  Scenario: Requesting a reset code for an unknown email still returns 200
    The forgot-password endpoint must not reveal which emails are registered,
    so an email with no account behind it gets the same response as one that
    exists.

    When I request a password reset code for "ghost@example.com"
    Then the response status code should be 200

  Scenario: Reset password fails when email field is missing
    Submits a reset-password request with a null email field. Bean validation
    (@NotBlank on ResetPasswordRequest.email) rejects it with HTTP 400 before
    the service layer is ever reached.

    When I send a reset password request without an email
    Then the response status code should be 400
