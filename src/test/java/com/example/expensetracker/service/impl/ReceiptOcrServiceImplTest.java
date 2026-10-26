package com.example.expensetracker.service.impl;

import com.example.expensetracker.dto.MlClassificationRequest;
import com.example.expensetracker.dto.MlClassificationResponse;
import com.example.expensetracker.service.MlInferenceClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ReceiptOcrServiceImplTest {

    private ReceiptOcrServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new ReceiptOcrServiceImpl();
    }

    @Test
    @DisplayName("parseReceiptText extracts merchant, amounts, date, and category accurately")
    void parseReceiptText_extractsFullMetadata() {
        String receiptText = """
                STARBUCKS COFFEE
                Store #1042 - Seattle, WA
                Date: 2026-09-15
                1 Caffe Latte       $4.50
                1 Blueberry Muffin   $3.25
                Sub Total: $7.75
                Tax: $0.78
                Grand Total: $8.53
                Thank you for visiting!
                """;

        Map<String, Object> result = service.parseReceiptText(receiptText);

        assertNotNull(result);
        assertEquals(8.53, (Double) result.get("amount"), 0.001);
        assertEquals("2026-09-15", result.get("date"));
        assertEquals("STARBUCKS COFFEE", result.get("merchant"));
        assertEquals("Food & Dining", result.get("category"));

        @SuppressWarnings("unchecked")
        Map<String, Object> breakdown = (Map<String, Object>) result.get("breakdown");
        assertNotNull(breakdown);
        assertEquals(8.53, (Double) breakdown.get("grandTotal"), 0.001);
        assertEquals(7.75, (Double) breakdown.get("subtotal"), 0.001);
        assertEquals(0.78, (Double) breakdown.get("totalTax"), 0.001);
    }

    @Test
    @DisplayName("parseReceiptText handles Indian Rupee formats and integer amounts")
    void parseReceiptText_handlesRupeeAndIntegerAmounts() {
        String receiptText = """
                APOLLO PHARMACY
                Healthcare & Diagnostics
                Date: 2026-10-12
                Paracetamol 650mg       Rs. 45.00
                Cough Syrup             Rs. 115.00
                Sub Total: Rs. 160.00
                GST @ 12%: Rs. 19.20
                Net Amount Payable: Rs. 179.20
                Thank you!
                """;

        Map<String, Object> result = service.parseReceiptText(receiptText);

        assertNotNull(result);
        assertEquals(179.20, (Double) result.get("amount"), 0.001);
        assertEquals("APOLLO PHARMACY", result.get("merchant"));
        assertEquals("Health & Medical", result.get("category"));

        String integerReceipt = """
                RELIANCE DIGITAL
                Invoice Date: 2026-10-14
                Wireless Mouse: Rs 450
                Total Amount: Rs 450
                """;

        Map<String, Object> intRes = service.parseReceiptText(integerReceipt);
        assertNotNull(intRes);
        assertEquals(450.0, (Double) intRes.get("amount"), 0.001);
    }

    @Test
    @DisplayName("parseReceiptText delegates to MlInferenceClient when available")
    void parseReceiptText_usesMlInferenceWhenAvailable() {
        MlInferenceClient mockMl = Mockito.mock(MlInferenceClient.class);
        ReceiptOcrServiceImpl mlEnabledService = new ReceiptOcrServiceImpl(mockMl);

        Mockito.when(mockMl.classify(ArgumentMatchers.any(MlClassificationRequest.class)))
                .thenReturn(new MlClassificationResponse("transportation", 0.94, List.of(), "v2", "tfidf"));

        String receiptText = """
                UNKNOWN LOGISTICS TRANSIT
                Date: 2026-09-15
                Service Fare: $50.00
                Grand Total: $50.00
                """;

        Map<String, Object> result = mlEnabledService.parseReceiptText(receiptText);
        assertEquals("Transportation", result.get("category"));
        Mockito.verify(mockMl, Mockito.atLeastOnce())
                .classify(ArgumentMatchers.any(MlClassificationRequest.class));
    }

    @Test
    @DisplayName("processReceipt handles text file parsing cleanly")
    void processReceipt_textFile_returnsParsedData() {
        String receipt = """
                Trader Joe's Supermarket
                Date: 12/04/2026
                Organic Milk $4.20
                Eggs $3.50
                Total: $7.70
                """;

        MockMultipartFile file = new MockMultipartFile(
                "file", "receipt.txt", "text/plain", receipt.getBytes(StandardCharsets.UTF_8));

        Map<String, Object> res = service.processReceipt(file);

        assertTrue((Boolean) res.get("success"));
        assertEquals(7.70, (Double) res.get("amount"), 0.001);
        assertEquals("Groceries", res.get("category"));
    }

    @Test
    @DisplayName("processReceipt throws exception for null or empty file")
    void processReceipt_emptyFile_throwsException() {
        MockMultipartFile emptyFile = new MockMultipartFile("file", "empty.png", "image/png", new byte[0]);
        assertThrows(IllegalArgumentException.class, () -> service.processReceipt(emptyFile));
        assertThrows(IllegalArgumentException.class, () -> service.processReceipt(null));
    }
}
