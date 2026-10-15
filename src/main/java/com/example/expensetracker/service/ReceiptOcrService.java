package com.example.expensetracker.service;

import org.springframework.web.multipart.MultipartFile;
import java.util.Map;

/**
 * Service for scanning and parsing receipts/bills using OCR and regex metadata extraction.
 */
public interface ReceiptOcrService {

    /**
     * Processes an uploaded receipt image or document, extracting text via OCR
     * and parsing merchant, amount, breakdown, date, and category.
     *
     * @param file uploaded receipt image or text document
     * @return map containing raw text, extracted financial metadata, and confidence
     */
    Map<String, Object> processReceipt(MultipartFile file);

    /**
     * Parses raw receipt text into structured financial metadata.
     *
     * @param text raw receipt text string
     * @return map containing amount, merchant, date, category, and tax breakdown
     */
    Map<String, Object> parseReceiptText(String text);
}
