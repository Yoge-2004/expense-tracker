Feature: Authentication
  As a user
  I want to register and log in
  So that I can securely access my financial data

  Background:
    Given the application is running with a test database

  Scenario: Register a new user successfully
    When I register with name "Alice" username "alice123" email "alice@test.com" password "SecurePass123" and currency "USD"
    Then the response status should be 200
    And the response should contain a token
    And the response should contain userId

  Scenario: Register with a duplicate email fails
    Given a user with email "bob@test.com" already exists
    When I register with name "Bob" username "bob456" email "bob@test.com" password "SecurePass123" and currency "INR"
    Then the response status should be 400
    And the response message should contain "already exists"

  Scenario: Register with an invalid currency code fails
    When I register with name "Charlie" username "charlie" email "charlie@test.com" password "SecurePass123" and currency "US DOLLARS"
    Then the response status should be 400

  Scenario: Login with valid credentials succeeds
    Given a user with email "login@test.com" and password "ValidPass123" already exists
    When I log in with email "login@test.com" and password "ValidPass123"
    Then the response status should be 200
    And the response should contain a token

  Scenario: Login with invalid credentials fails
    Given a user with email "login2@test.com" and password "ValidPass123" already exists
    When I log in with email "login2@test.com" and password "WrongPassword"
    Then the response status should be 401

  Scenario: Accessing a protected endpoint without a token fails
    When I request expenses for user 1 without authentication
    Then the response status should be 401
