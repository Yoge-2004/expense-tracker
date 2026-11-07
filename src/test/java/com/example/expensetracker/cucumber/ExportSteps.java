package com.example.expensetracker.cucumber;

import com.example.expensetracker.cucumber.CucumberSpringConfig.TestContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Step definitions for the financial report export feature.
 *
 * <p>These steps exercise the CSV, Excel, and PDF export endpoints and verify the
 * response content type, content disposition header, and actual transaction contents.</p>
 */
@SuppressWarnings("unused")
public class ExportSteps {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private TestContext ctx;

    @Given("I have expenses and incomes recorded")
    public void haveExpensesAndIncomes() throws Exception {
        haveRecordedExpensesAndIncomes();
    }

    @Given("I have recorded expenses and incomes for export")
    public void haveRecordedExpensesAndIncomes() throws Exception {
        assertNotNull(ctx.userId, "Must be logged in before recording export data");
        assertNotNull(ctx.authToken, "Must have an auth token before recording export data");

        // 1. Create a category
        Map<String, Object> catBody = Map.of("name", "Office Supplies");
        MvcResult catRes = mockMvc.perform(post("/api/categories/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(catBody)))
                .andReturn();
        Long catId = objectMapper.readTree(catRes.getResponse().getContentAsString()).get("id").asLong();

        // 2. Create an expense under this category
        Map<String, Object> expBody = Map.of(
                "amount", BigDecimal.valueOf(1200.00),
                "description", "Office Laptop",
                "expenseDate", "2026-09-01",
                "categoryId", catId
        );
        mockMvc.perform(post("/api/expenses/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(expBody)))
                .andExpect(status().isCreated());

        // 3. Create an income
        Map<String, Object> incBody = Map.of(
                "amount", BigDecimal.valueOf(3500.00),
                "source", "Consulting Retainer",
                "description", "Retainer for September",
                "incomeDate", "2026-09-02",
                "isRecurring", false
        );
        mockMvc.perform(post("/api/incomes/user/" + ctx.userId)
                        .header("Authorization", "Bearer " + ctx.authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(incBody)))
                .andExpect(status().isCreated());
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

    @Then("the content type should be {string}")
    public void verifyContentType(String expected) {
        assertNotNull(ctx.lastResponse, "No response captured");
        String contentType = ctx.lastResponse.getResponse().getContentType();
        assertNotNull(contentType, "Content-Type header is null");
        assertTrue(contentType.contains(expected),
                "Expected " + expected + " but was: " + contentType);
    }

    @Then("^the content type should be text/csv$")
    public void verifyContentTypeCsv() {
        verifyContentType("text/csv");
    }

    @Then("^the content type should be application/pdf$")
    public void verifyContentTypePdf() {
        verifyContentType("application/pdf");
    }

    @Then("the content type should be an Excel spreadsheet")
    public void verifyContentTypeExcel() {
        assertNotNull(ctx.lastResponse, "No response captured");
        String contentType = ctx.lastResponse.getResponse().getContentType();
        assertNotNull(contentType, "Content-Type header is null");
        assertTrue(contentType.contains("spreadsheetml") || contentType.contains("excel")
                || contentType.contains("xlsx"),
                "Expected Excel content type but was: " + contentType);
    }

    @Then("the content disposition should be {string}")
    public void verifyContentDisposition(String expected) {
        assertNotNull(ctx.lastResponse, "No response captured");
        String cd = ctx.lastResponse.getResponse().getHeader("Content-Disposition");
        assertNotNull(cd, "Content-Disposition header is null");
        assertEquals(expected, cd, "Content-Disposition mismatch");
    }

    @Then("the CSV should contain a header row with {string}")
    public void verifyCsvHeader(String expectedHeader) {
        assertNotNull(ctx.lastResponseBody, "No response body captured");
        String csv = new String(ctx.lastResponseBody, java.nio.charset.StandardCharsets.UTF_8);
        String firstLine = csv.split("\n", 2)[0].trim();
        assertEquals(expectedHeader, firstLine,
                "CSV header row mismatch. Full CSV:\n" + csv.substring(0, Math.min(csv.length(), 500)));
    }

    @Then("the CSV body should contain an expense with description {string} and amount {string}")
    public void verifyCsvExpenseContent(String description, String amount) {
        assertNotNull(ctx.lastResponseBody, "No response body captured");
        String csv = new String(ctx.lastResponseBody, java.nio.charset.StandardCharsets.UTF_8);
        assertTrue(csv.contains(description), "CSV missing description '" + description + "'. Full CSV:\n" + csv);
        assertTrue(csv.contains(amount), "CSV missing amount '" + amount + "'. Full CSV:\n" + csv);
    }

    @Then("the CSV body should contain an income with source {string} and amount {string}")
    public void verifyCsvIncomeContent(String source, String amount) {
        assertNotNull(ctx.lastResponseBody, "No response body captured");
        String csv = new String(ctx.lastResponseBody, java.nio.charset.StandardCharsets.UTF_8);
        assertTrue(csv.contains(source), "CSV missing source '" + source + "'. Full CSV:\n" + csv);
        assertTrue(csv.contains(amount), "CSV missing amount '" + amount + "'. Full CSV:\n" + csv);
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

    @Then("the PDF file should be larger than {int} bytes")
    public void verifyPdfMinSize(int minBytes) {
        assertNotNull(ctx.lastResponseBody);
        assertTrue(ctx.lastResponseBody.length > minBytes,
                "PDF file is only " + ctx.lastResponseBody.length + " bytes, expected > " + minBytes);
    }

    @Then("the Excel file should be larger than {int} bytes")
    public void verifyExcelMinSize(int minBytes) {
        assertNotNull(ctx.lastResponseBody);
        assertTrue(ctx.lastResponseBody.length > minBytes,
                "Excel file is only " + ctx.lastResponseBody.length + " bytes, expected > " + minBytes);
    }
}
