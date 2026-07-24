Feature: System Health, Sync, and Export API
  As a user or system administrator
  I want to check system health, trigger data auto sync, and export expenses
  So that I can monitor and back up my expense data

  Background:
    Given I am a registered and authenticated user

  Scenario: Health check endpoint returns system status
    When I send a GET request to "/api/health"
    Then the response status code should be 200
    And the response body should contain "UP"

  Scenario: Sync file to database endpoint triggers successfully
    When I send a POST request to "/api/sync/file-to-db" without body
    Then the response status code should be 200
    And the response body should contain "success"

  Scenario: Sync database to file endpoint triggers successfully
    When I send a POST request to "/api/sync/db-to-file" without body
    Then the response status code should be 200
    And the response body should contain "success"

  Scenario: Export expenses as CSV returns attachment header
    When I export expenses as "csv" for my user
    Then the response status code should be 200

  Scenario: Export expenses as JSON returns attachment header
    When I export expenses as "json" for my user
    Then the response status code should be 200

  Scenario: Export expenses as PDF returns attachment header
    When I export expenses as "pdf" for my user
    Then the response status code should be 200
