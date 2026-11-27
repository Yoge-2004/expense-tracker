package com.example.expensetracker.domain.ai.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.Map;

import com.example.expensetracker.domain.ai.dto.ReceiptTextRequest;
import com.example.expensetracker.domain.ai.service.ReceiptOcrService;

/**
 * REST controller for receipt OCR scanning and structured text extraction.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@SecurityRequirement(name = "BearerAuth")
@Tag(name = "Receipt OCR", description = "Endpoints for scanning and extracting receipt / bill transaction details")
public class ReceiptOcrController {

    private final ReceiptOcrService receiptOcrService;

    @Operation(summary = "Scan receipt image or document with OCR and parse financial metadata")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Extracted receipt metadata returned"),
        @ApiResponse(responseCode = "400", description = "Unsupported or unreadable receipt upload"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PostMapping(value = {"/api/expenses/ocr", "/api/receipts/ocr"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> scanReceipt(
            @RequestParam("file") MultipartFile file) {
        log.info("Received receipt OCR scan request: filename={}, size={}",
                file.getOriginalFilename(), file.getSize());
        Map<String, Object> result = receiptOcrService.processReceipt(file);
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Parse receipt text directly to extract financial metadata")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Parsed receipt metadata returned"),
        @ApiResponse(responseCode = "400", description = "Invalid receipt text payload"),
        @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @PostMapping(value = {"/api/expenses/ocr/parse-text", "/api/receipts/parse-text"})
    public ResponseEntity<Map<String, Object>> parseText(
            @Valid @RequestBody(required = false) ReceiptTextRequest body) {
        String text = body != null && body.text() != null ? body.text() : "";
        Map<String, Object> result = receiptOcrService.parseReceiptText(text);
        return ResponseEntity.ok(result);
    }
}
