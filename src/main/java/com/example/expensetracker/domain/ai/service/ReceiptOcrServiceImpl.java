package com.example.expensetracker.domain.ai.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileAttribute;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.*;
import java.util.concurrent.TimeUnit;



/**
 * Default {@link ReceiptOcrService} implementation combining image preprocessing, Tesseract/ML extraction, and receipt parsing.
 */
@Slf4j
@Service
public class ReceiptOcrServiceImpl implements ReceiptOcrService {

    private final ReceiptImagePreprocessor imagePreprocessor;
    private final ReceiptTextParser textParser;
    private final MlInferenceClient mlInferenceClient;

    public ReceiptOcrServiceImpl() {
        this(new ReceiptImagePreprocessor(), new ReceiptTextParser(), null);
    }

    public ReceiptOcrServiceImpl(MlInferenceClient mlInferenceClient) {
        this(new ReceiptImagePreprocessor(), new ReceiptTextParser(mlInferenceClient), mlInferenceClient);
    }

    @Autowired
    public ReceiptOcrServiceImpl(ReceiptImagePreprocessor imagePreprocessor,
                                 ReceiptTextParser textParser,
                                 @Autowired(required = false) MlInferenceClient mlInferenceClient) {
        this.imagePreprocessor = imagePreprocessor != null ? imagePreprocessor : new ReceiptImagePreprocessor();
        this.textParser = textParser != null ? textParser : new ReceiptTextParser(mlInferenceClient);
        this.mlInferenceClient = mlInferenceClient;
    }

    @Override
    public Map<String, Object> processReceipt(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Receipt file must not be empty");
        }

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase(Locale.ROOT) : "";
        String contentType = file.getContentType() != null ? file.getContentType().toLowerCase(Locale.ROOT) : "";

        String extractedText = "";
        boolean isImage = contentType.startsWith("image/") || filename.endsWith(".png") ||
                filename.endsWith(".jpg") || filename.endsWith(".jpeg") || filename.endsWith(".webp");

        if (isImage) {
            extractedText = extractTextFromImageFile(file);
        } else {
            // Text or document fallback
            try {
                extractedText = new String(file.getBytes(), StandardCharsets.UTF_8);
            } catch (Exception e) {
                log.warn("Failed to read text file directly: {}", e.getMessage());
            }
        }

        if (extractedText.isBlank()) {
            return Map.of(
                    "success", false,
                    "message", "Unable to extract readable text from receipt. Please verify image clarity.",
                    "rawText", ""
            );
        }

        Map<String, Object> parsed = parseReceiptText(extractedText);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("rawText", extractedText);
        response.putAll(parsed);
        return response;
    }

    @SuppressWarnings("java:S5443") // Temp file is restricted to owner-only permissions (POSIX rw-------) with fallback file permission restrictions
    private String extractTextFromImageFile(MultipartFile file) {
        Path tempPath = null;
        try {
            String ext = ".png";
            String orig = file.getOriginalFilename();
            if (orig != null && orig.lastIndexOf('.') != -1) {
                String sub = orig.substring(orig.lastIndexOf('.')).toLowerCase(Locale.ROOT);
                if (sub.matches("^\\.[a-z0-9]{2,5}$")) {
                    ext = sub;
                }
            }

            try {
                Set<PosixFilePermission> perms = PosixFilePermissions.fromString("rw-------");
                FileAttribute<Set<PosixFilePermission>> attr = PosixFilePermissions.asFileAttribute(perms);
                tempPath = Files.createTempFile("ocr-receipt-", ext, attr);
            } catch (UnsupportedOperationException | SecurityException e) {
                tempPath = Files.createTempFile("ocr-receipt-", ext);
            }

            imagePreprocessor.preprocessAndSaveImage(file, tempPath);
            String absPath = tempPath.toAbsolutePath().toString();

            // Attempt 1: PSM 4 (single column variable size, optimal for receipts) with 300 DPI
            String text = runTesseractCommand(List.of("tesseract", absPath, "stdout", "--dpi", "300", "--psm", "4", "-l", "eng"));
            if (text.isBlank()) {
                // Attempt 2: PSM 6 (single uniform text block)
                text = runTesseractCommand(List.of("tesseract", absPath, "stdout", "--dpi", "300", "--psm", "6", "-l", "eng"));
            }
            if (text.isBlank()) {
                // Attempt 3: Default layout
                text = runTesseractCommand(List.of("tesseract", absPath, "stdout", "-l", "eng"));
            }
            return text;
        } catch (Exception ex) {
            log.error("OCR execution failed for uploaded receipt: {}", ex.getMessage());
            return "";
        } finally {
            if (tempPath != null) {
                try {
                    Files.deleteIfExists(tempPath);
                } catch (Exception e) {
                    log.warn("Failed to delete temp OCR receipt file {}: {}", tempPath, e.getMessage());
                }
            }
        }
    }



    private String runTesseractCommand(List<String> command) {
        try {
            ProcessBuilder pb = new ProcessBuilder(command);
            // Tesseract spawns one OpenMP thread per visible core; on a shared container that oversubscribes the CPU.
            pb.environment().put("OMP_THREAD_LIMIT", "1");
            pb.redirectError(ProcessBuilder.Redirect.DISCARD);
            try (Process process = pb.start()) {
                String text;
                try (InputStream is = process.getInputStream()) {
                    text = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                }

                boolean finished = process.waitFor(15, TimeUnit.SECONDS);
                if (!finished) {
                    process.destroyForcibly();
                    log.warn("Tesseract OCR process timed out for command: {}", command);
                    return "";
                }
                return text.trim();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Tesseract command was interrupted: {}", e.getMessage());
            return "";
        } catch (Exception e) {
            log.warn("Tesseract command execution failed: {} - {}", command, e.getMessage());
            return "";
        }
    }

    @Override
    public Map<String, Object> parseReceiptText(String text) {
        return textParser.parseReceiptText(text);
    }
}
