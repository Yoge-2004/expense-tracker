Feature: Financial Report Exports
  As an authenticated user
  I want to export my financial data in multiple formats
  So that I can analyze it offline or share it with my accountant

  Background:
    Given the application is running with a test database
    And I am logged in as user "exportuser@test.com" with password "SecurePass123"
    And I have expenses and incomes recorded

  Scenario: Export expenses to CSV
    When I export expenses to CSV
    Then the response status should be 200
    And the content type should be text/csv
    And the content disposition should be "attachment; filename=\"expenses.csv\""
    And the CSV should contain a header row with "ID,Date,Category,Amount,Description,Recurring"

  Scenario: Export expenses to Excel
    When I export expenses to Excel
    Then the response status should be 200
    And the content type should be an Excel spreadsheet
    And the content disposition should be "attachment; filename=\"expenses.xlsx\""

  Scenario: Export expenses to PDF
    When I export expenses to PDF
    Then the response status should be 200
    And the content type should be application/pdf
    And the content disposition should be "attachment; filename=\"expenses.pdf\""
    And the PDF should start with "%PDF"

  Scenario: Export the full financial statement to Excel
    When I export the financial statement to Excel with currency "INR"
    Then the response status should be 200
    And the content type should be an Excel spreadsheet
    And the Excel file should be larger than 1000 bytes

  Scenario: Export the full financial statement to PDF
    When I export the financial statement to PDF with currency "INR"
    Then the response status should be 200
    And the content type should be application/pdf
    And the PDF should start with "%PDF"

  Scenario: Export incomes to CSV
    When I export incomes to CSV
    Then the response status should be 200
    And the content type should be text/csv
    And the content disposition should be "attachment; filename=\"incomes.csv\""
