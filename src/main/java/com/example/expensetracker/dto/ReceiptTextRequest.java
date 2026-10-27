package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/**
 * Text already extracted from a receipt, sent for parsing. A receipt is a few hundred
 * characters; the cap keeps a single request from tying up the parser.
 */
@Schema(description = "Receipt text to parse into merchant, amount and date")
public record ReceiptTextRequest(
        @Size(max = 20_000, message = "Receipt text is too long")
        @Schema(description = "Plain text of the receipt", example = "Big Bazaar\nTotal 540.00") String text
) {
}
