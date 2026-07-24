Feature: Simple Test
  Scenario: Simple Scenario
    Given I diagnostic check
    When I register with name "Simple", email "simple@test.com", and password "Pass1234"
    Then the response status code should be 201
