package com.example.expensetracker.cucumber;

import com.example.expensetracker.cucumber.CucumberSpringConfig.TestContext;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * Step definitions for the financial report export feature.
 *
 * <p>These steps exercise the CSV, Excel, and PDF export endpoints and verify the
 * response content type, content disposition header, and basic payload structure.</p>
 */
public class ExportSteps {

    @Autowired private MockMvc mockMvc;
    @Autowired private TestContext ctx;

    @Given("I have expenses and incomes recorded")
    public void haveExpensesAndIncomes() throws Exception {
        // The background step "I am logged in" already created a user. We rely on
        // DataInitializer or the test's own data. For a robust test, we just ensure
        // the user exists — the export endpoints handle empty data gracefully.
        assertNotNull(ctx.userId, "Must be logged in before exporting");
        assertNotNull(ctx.authToken, "Must have an auth token before exporting");
    }

    @When("I export expenses to CSV")
    public void exportExpensesCsv() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/expenses/user/" + ctx.userId + "/export/csv")
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        ctx.lastResponse = result;
        ctx.lastResponseBody = result.getResponse().getContentAsByteArray();
    }

    @When("I export expenses to Excel")
    public void exportExpensesExcel() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/expenses/user/" + ctx.userId + "/export/excel")
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        ctx.lastResponse = result;
        ctx.lastResponseBody = result.getResponse().getContentAsByteArray();
    }

    @When("I export expenses to PDF")
    public void exportExpensesPdf() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/expenses/user/" + ctx.userId + "/export/pdf")
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        ctx.lastResponse = result;
        ctx.lastResponseBody = result.getResponse().getContentAsByteArray();
    }

    @When("I export the financial statement to Excel with currency {string}")
    public void exportFinancialStatementExcel(String currency) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/reports/user/" + ctx.userId + "/export/excel")
                        .param("currency", currency)
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        ctx.lastResponse = result;
        ctx.lastResponseBody = result.getResponse().getContentAsByteArray();
    }

    @When("I export the financial statement to PDF with currency {string}")
    public void exportFinancialStatementPdf(String currency) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/reports/user/" + ctx.userId + "/export/pdf")
                        .param("currency", currency)
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        ctx.lastResponse = result;
        ctx.lastResponseBody = result.getResponse().getContentAsByteArray();
    }

    @When("I export incomes to CSV")
    public void exportIncomesCsv() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/incomes/user/" + ctx.userId + "/export/csv")
                        .header("Authorization", "Bearer " + ctx.authToken))
                .andReturn();
        ctx.lastResponse = result;
        ctx.lastResponseBody = result.getResponse().getContentAsByteArray();
    }

    // ─── Verification steps ───────────────────────────────────────────────────

    @Then("the content type should be text/csv")
    public void verifyContentTypeCsv() {
        assertNotNull(ctx.lastResponse, "No response captured");
        String contentType = ctx.lastResponse.getResponse().getContentType();
        assertNotNull(contentType, "Content-Type header is null");
        assertTrue(contentType.contains("text/csv"),
                "Expected text/csv but was: " + contentType);
    }

    @Then("the content type should be application/pdf")
    public void verifyContentTypePdf() {
        assertNotNull(ctx.lastResponse, "No response captured");
        String contentType = ctx.lastResponse.getResponse().getContentType();
        assertNotNull(contentType, "Content-Type header is null");
        assertTrue(contentType.contains("application/pdf"),
                "Expected application/pdf but was: " + contentType);
    }

    @Then("the content type should be an Excel spreadsheet")
    public void verifyContentTypeExcel() {
        assertNotNull(ctx.lastResponse, "No response captured");
        String contentType = ctx.lastResponse.getResponse().getContentType();
        assertNotNull(contentType, "Content-Type header is null");
        assertTrue(contentType.contains("spreadsheetml") || contentType.contains("excel") || contentType.contains("xlsx"),
                "Expected Excel content type but was: " + contentType);
    }

    @Then("the content disposition should be {string}")
    public void verifyContentDisposition(String expected) {
        assertNotNull(ctx.lastResponse, "No response captured");
        String cd = ctx.lastResponse.getResponse().getHeader("Content-Disposition");
        assertNotNull(cd, "Content-Disposition header is null");
        assertEquals(expected, cd,
                "Content-Disposition mismatch");
    }

    @Then("the CSV should contain a header row with {string}")
    public void verifyCsvHeader(String expectedHeader) throws Exception {
        assertNotNull(ctx.lastResponseBody, "No response body captured");
        String csv = new String(ctx.lastResponseBody, java.nio.charset.StandardCharsets.UTF_8);
        String firstLine = csv.split("\n", 2)[0].trim();
        assertEquals(expectedHeader, firstLine,
                "CSV header row mismatch. Full CSV:\n" + csv.substring(0, Math.min(csv.length(), 500)));
    }

    @Then("the PDF should start with {string}")
    public void verifyPdfMagicBytes(String magic) {
        assertNotNull(ctx.lastResponseBody, "No response body captured");
        byte[] expected = magic.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        assertTrue(ctx.lastResponseBody.length >= expected.length,
                "PDF body too short: " + ctx.lastResponseBody.length + " bytes");
        for (int i = 0; i < expected.length; i++) {
            assertEquals(expected[i], ctx.lastResponseBody[i],
                    "PDF magic byte mismatch at position " + i);
        }
    }

    @Then("the Excel file should be larger than {int} bytes")
    public void verifyExcelMinSize(int minBytes) {
        assertNotNull(ctx.lastResponseBody, "No response body captured");
        assertTrue(ctx.lastResponseBody.length > minBytes,
                "Excel file is only " + ctx.lastResponseBody.length + " bytes, expected > " + minBytes);
    }
}
