package com.example.expensetracker.controller;

import com.example.expensetracker.service.ReceiptOcrService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@Tag(name = "Receipt OCR", description = "Endpoints for scanning and extracting receipt / bill transaction details")
public class ReceiptOcrController {

    private final ReceiptOcrService receiptOcrService;

    @Operation(summary = "Scan receipt image or document with OCR and parse financial metadata")
    @PostMapping(value = {"/api/expenses/ocr", "/api/receipts/ocr"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> scanReceipt(
            @RequestParam("file") MultipartFile file) {
        log.info("Received receipt OCR scan request: filename={}, size={}",
                file.getOriginalFilename(), file.getSize());
        Map<String, Object> result = receiptOcrService.processReceipt(file);
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Parse receipt text directly to extract financial metadata")
    @PostMapping(value = {"/api/expenses/ocr/parse-text", "/api/receipts/parse-text"})
    public ResponseEntity<Map<String, Object>> parseText(@RequestBody(required = false) Map<String, String> body) {
        String text = body != null ? body.get("text") : "";
        Map<String, Object> result = receiptOcrService.parseReceiptText(text);
        return ResponseEntity.ok(result);
    }
}
