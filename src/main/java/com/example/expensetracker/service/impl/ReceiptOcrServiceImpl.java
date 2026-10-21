package com.example.expensetracker.service.impl;

import com.example.expensetracker.service.ReceiptOcrService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
public class ReceiptOcrServiceImpl implements ReceiptOcrService {

    private static final Map<String, List<String>> CATEGORY_KEYWORDS;
    static {
        Map<String, List<String>> map = new LinkedHashMap<>();
        map.put("Food & Dining", List.of("restaurant", "cafe", "coffee", "bistro", "burger", "pizza", "swiggy", "zomato", "dining", "bar", "bakery", "kitchen", "grill", "starbucks", "subway", "mcdonald"));
        map.put("Groceries", List.of("supermarket", "grocery", "mart", "store", "provisions", "reliance", "dmart", "spencer", "vegetables", "fruits", "milk", "dairy", "trader joe", "whole foods", "walmart", "costco"));
        map.put("Transportation", List.of("fuel", "petrol", "diesel", "gas", "shell", "hpcl", "bpcl", "ioc", "uber", "ola", "metro", "auto", "rail", "parking", "toll", "chevron", "exxon"));
        map.put("Shopping", List.of("clothing", "apparel", "retail", "mall", "fashion", "zara", "h&m", "uniqlo", "lifestyle", "westside", "amazon", "flipkart", "target", "nike", "adidas"));
        map.put("Utilities", List.of("electricity", "power", "water", "gas bill", "broadband", "wifi", "internet", "airtel", "jio", "vodafone", "telecom", "utility"));
        map.put("Health & Medical", List.of("pharmacy", "chemist", "drug", "hospital", "clinic", "medical", "apollo", "medplus", "healthcare", "diagnostic", "lab", "walgreens", "cvs"));
        map.put("Entertainment", List.of("cinema", "movie", "theatre", "imax", "pvr", "inox", "concert", "game", "bowling", "netflix", "spotify"));
        CATEGORY_KEYWORDS = Collections.unmodifiableMap(map);
    }

    private static final String CURRENCY_SYMBOLS = "[\\s:₹$€£]*(?:rs\\.?|inr)?[\\s]*";
    private static final String AMOUNT_PATTERN = "([0-9]{1,3}(?:[,\\s][0-9]{3})*(?:\\.[0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)";

    private static final Pattern SUBTOTAL_REGEX = Pattern.compile(
            "(?:sub\\s*total|item\\s*total|sub-total|items?\\s*value|base\\s*(?:amount|total)|taxable\\s*value|gross\\s*(?:amount|total))" + CURRENCY_SYMBOLS + AMOUNT_PATTERN, Pattern.CASE_INSENSITIVE);
    private static final Pattern CGST_REGEX = Pattern.compile(
            "(?:cgst|central\\s*gst)(?:\\s*@?\\s*\\d+(?:\\.\\d+)?%?)?" + CURRENCY_SYMBOLS + AMOUNT_PATTERN, Pattern.CASE_INSENSITIVE);
    private static final Pattern SGST_REGEX = Pattern.compile(
            "(?:sgst|state\\s*gst|utgst)(?:\\s*@?\\s*\\d+(?:\\.\\d+)?%?)?" + CURRENCY_SYMBOLS + AMOUNT_PATTERN, Pattern.CASE_INSENSITIVE);
    private static final Pattern IGST_REGEX = Pattern.compile(
            "(?:igst|integrated\\s*gst)(?:\\s*@?\\s*\\d+(?:\\.\\d+)?%?)?" + CURRENCY_SYMBOLS + AMOUNT_PATTERN, Pattern.CASE_INSENSITIVE);
    private static final Pattern VAT_REGEX = Pattern.compile(
            "(?:vat|value\\s*added\\s*tax)(?:\\s*@?\\s*\\d+(?:\\.\\d+)?%?)?" + CURRENCY_SYMBOLS + AMOUNT_PATTERN, Pattern.CASE_INSENSITIVE);
    private static final Pattern GEN_TAX_REGEX = Pattern.compile(
            "(?:service\\s*tax|cess|total\\s*tax|tax\\s*amount|\\btax(?:es)?(?:\\s*@?\\s*\\d+(?:\\.\\d+)?%?)?|\\bgst(?:\\s*@?\\s*\\d+(?:\\.\\d+)?%?)?)" + CURRENCY_SYMBOLS + AMOUNT_PATTERN, Pattern.CASE_INSENSITIVE);
    private static final Pattern DISCOUNT_REGEX = Pattern.compile(
            "(?:discount|coupon|promo|instant\\s*savings?|less)(?:\\s*\\([^)]*\\))?[\\s:₹$€£\\-]*(?:rs\\.?|inr)?[\\s]*" + AMOUNT_PATTERN, Pattern.CASE_INSENSITIVE);
    private static final Pattern CHARGES_REGEX = Pattern.compile(
            "(?:delivery(?:\\s*fee|\\s*charge)?|packing(?:\\s*charge)?|service\\s*charge|tip|gratuity|convenience\\s*fee)(?:\\s*\\([^)]*\\))?[\\s:₹$€£+]*([0-9]{1,3}(?:[,\\s][0-9]{3})*(?:\\.[0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)", Pattern.CASE_INSENSITIVE);
    private static final Pattern GRAND_TOTAL_REGEX = Pattern.compile(
            "(?:grand\\s*total|net\\s*(?:amount\\s*)?payable|total\\s*payable|amount\\s*payable|invoice\\s*total|final\\s*(?:amount|total)|bill\\s*total|total\\s*amount|amount\\s*due|total\\s*due|total\\s*paid|paid\\s*amount)" + CURRENCY_SYMBOLS + AMOUNT_PATTERN, Pattern.CASE_INSENSITIVE);
    private static final Pattern GENERIC_TOTAL_REGEX = Pattern.compile(
            "(?:^|\\s)total" + CURRENCY_SYMBOLS + AMOUNT_PATTERN, Pattern.CASE_INSENSITIVE);
    private static final Pattern CURRENCY_PREFIX_REGEX = Pattern.compile(
            "(?:[₹$€£]|\\brs\\.?|\\binr)\\s*([0-9]{1,3}(?:[,\\s][0-9]{3})*(?:\\.[0-9]{1,2})?|[0-9]+(?:\\.[0-9]{1,2})?)", Pattern.CASE_INSENSITIVE);
    private static final Pattern DATE_REGEX = Pattern.compile(
            "\\b(\\d{4}[-/]\\d{1,2}[-/]\\d{1,2})\\b|\\b(\\d{1,2}[-/]\\d{1,2}[-/]\\d{2,4})\\b");

    private static final List<String> IGNORED_HEADERS = List.of(
            "tax invoice", "retail invoice", "bill", "cash memo", "receipt", "welcome",
            "customer copy", "tax invoice/bill of supply", "original for recipient"
    );

    @Override
    public Map<String, Object> processReceipt(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Receipt file must not be empty");
        }

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        String contentType = file.getContentType() != null ? file.getContentType().toLowerCase() : "";

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

        if (extractedText == null || extractedText.isBlank()) {
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

    private String extractTextFromImageFile(MultipartFile file) {
        File tempFile = null;
        try {
            String ext = ".png";
            String orig = file.getOriginalFilename();
            if (orig != null && orig.lastIndexOf('.') != -1) {
                String sub = orig.substring(orig.lastIndexOf('.')).toLowerCase();
                if (sub.matches("^\\.[a-z0-9]{2,5}$")) {
                    ext = sub;
                }
            }
            tempFile = File.createTempFile("ocr-receipt-", ext);
            try (FileOutputStream fos = new FileOutputStream(tempFile);
                 InputStream is = file.getInputStream()) {
                is.transferTo(fos);
            }

            // Attempt 1: Standard Tesseract invocation with LSTM eng
            String text = runTesseractCommand(tempFile, List.of("tesseract", tempFile.getAbsolutePath(), "stdout", "-l", "eng"));
            if (text.isBlank()) {
                // Attempt 2: Explicit OEM 1 (LSTM) with PSM 6
                text = runTesseractCommand(tempFile, List.of("tesseract", tempFile.getAbsolutePath(), "stdout", "--oem", "1", "--psm", "6", "-l", "eng"));
            }
            if (text.isBlank()) {
                // Attempt 3: Default OEM 3
                text = runTesseractCommand(tempFile, List.of("tesseract", tempFile.getAbsolutePath(), "stdout", "--oem", "3", "-l", "eng"));
            }
            return text;
        } catch (Exception ex) {
            log.error("OCR execution failed for uploaded receipt: {}", ex.getMessage());
            return "";
        } finally {
            if (tempFile != null && tempFile.exists()) {
                tempFile.delete();
            }
        }
    }

    private String runTesseractCommand(File imageFile, List<String> command) {
        try {
            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectError(ProcessBuilder.Redirect.DISCARD);
            Process process = pb.start();

            String text = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            boolean finished = process.waitFor(15, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                log.warn("Tesseract OCR process timed out for command: {}", command);
                return "";
            }
            return text.trim();
        } catch (Exception e) {
            log.warn("Tesseract command execution failed: {} - {}", command, e.getMessage());
            return "";
        }
    }

    @Override
    public Map<String, Object> parseReceiptText(String text) {
        Map<String, Object> result = new LinkedHashMap<>();
        if (text == null || text.isBlank()) {
            return result;
        }

        String[] lines = text.split("\\r?\\n");
        Double subtotal = null;
        Double cgst = null;
        Double sgst = null;
        Double igst = null;
        Double vat = null;
        Double totalTax = null;
        Double discount = null;
        Double charges = null;
        Double grandTotal = null;

        for (String line : lines) {
            line = line.trim();
            if (line.isEmpty()) continue;

            if (grandTotal == null) {
                grandTotal = extractVal(line, GRAND_TOTAL_REGEX);
            }
            if (subtotal == null) {
                subtotal = extractVal(line, SUBTOTAL_REGEX);
            }
            if (cgst == null) {
                cgst = extractVal(line, CGST_REGEX);
            }
            if (sgst == null) {
                sgst = extractVal(line, SGST_REGEX);
            }
            if (igst == null) {
                igst = extractVal(line, IGST_REGEX);
            }
            if (vat == null) {
                vat = extractVal(line, VAT_REGEX);
            }
            if (totalTax == null) {
                totalTax = extractVal(line, GEN_TAX_REGEX);
            }
            if (discount == null) {
                discount = extractVal(line, DISCOUNT_REGEX);
            }
            if (charges == null) {
                charges = extractVal(line, CHARGES_REGEX);
            }
        }

        // Calculate combined taxes if not explicitly found
        double itemizedTaxes = (cgst != null ? cgst : 0.0) + (sgst != null ? sgst : 0.0)
                + (igst != null ? igst : 0.0) + (vat != null ? vat : 0.0);
        if (itemizedTaxes > 0) {
            totalTax = Math.round(itemizedTaxes * 100.0) / 100.0;
        }

        // Fallback total search from bottom up
        if (grandTotal == null) {
            for (int i = lines.length - 1; i >= 0; i--) {
                Double val = extractVal(lines[i], GENERIC_TOTAL_REGEX);
                if (val != null) {
                    grandTotal = val;
                    break;
                }
            }
        }

        // Mathematical reconciliation if total not explicitly labeled
        if (grandTotal == null && subtotal != null && totalTax != null) {
            double calc = subtotal + totalTax + (charges != null ? charges : 0.0) - (discount != null ? discount : 0.0);
            grandTotal = Math.round(calc * 100.0) / 100.0;
        }

        // Currency prefix fallback if still missing
        Double amount = grandTotal != null ? grandTotal : subtotal;
        if (amount == null) {
            Matcher curMatcher = CURRENCY_PREFIX_REGEX.matcher(text);
            double maxVal = 0.0;
            while (curMatcher.find()) {
                try {
                    String rawNum = curMatcher.group(1).replaceAll("[\\s,]", "");
                    double val = Double.parseDouble(rawNum);
                    if (val > maxVal) maxVal = val;
                } catch (Exception ignored) {}
            }
            if (maxVal > 0) {
                amount = maxVal;
                grandTotal = amount;
            }
        }

        // 2. Date parsing
        String parsedDate = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
        for (String line : lines) {
            Matcher dm = DATE_REGEX.matcher(line);
            if (dm.find()) {
                String rawDate = dm.group(0);
                String[] parts = rawDate.split("[-/]");
                try {
                    if (parts[0].length() == 4) {
                        parsedDate = String.format("%04d-%02d-%02d",
                                Integer.parseInt(parts[0]), Integer.parseInt(parts[1]), Integer.parseInt(parts[2]));
                        break;
                    } else if (parts[2].length() == 4 || parts[2].length() == 2) {
                        int yr = parts[2].length() == 2 ? 2000 + Integer.parseInt(parts[2]) : Integer.parseInt(parts[2]);
                        parsedDate = String.format("%04d-%02d-%02d",
                                yr, Integer.parseInt(parts[1]), Integer.parseInt(parts[0]));
                        break;
                    }
                } catch (Exception ignored) {}
            }
        }

        // 3. Merchant detection
        String merchant = "Receipt Purchase";
        for (int i = 0; i < Math.min(5, lines.length); i++) {
            String candidate = lines[i].trim();
            String lower = candidate.toLowerCase();
            boolean isHeader = IGNORED_HEADERS.stream().anyMatch(lower::contains);
            if (!isHeader && candidate.length() >= 3 && !candidate.matches("^\\d+$")) {
                merchant = candidate.replaceAll("[^A-Za-z0-9\\s&'-]", "").trim();
                if (!merchant.isEmpty()) break;
            }
        }

        // 4. Category prediction
        String category = "Miscellaneous";
        String lowerAll = text.toLowerCase();
        int maxMatches = 0;
        for (Map.Entry<String, List<String>> entry : CATEGORY_KEYWORDS.entrySet()) {
            int matches = 0;
            for (String kw : entry.getValue()) {
                if (lowerAll.contains(kw)) {
                    matches++;
                }
            }
            if (matches > maxMatches) {
                maxMatches = matches;
                category = entry.getKey();
            }
        }

        Map<String, Object> breakdown = new LinkedHashMap<>();
        breakdown.put("grandTotal", grandTotal);
        breakdown.put("subtotal", subtotal);
        breakdown.put("cgst", cgst);
        breakdown.put("sgst", sgst);
        breakdown.put("igst", igst);
        breakdown.put("vat", vat);
        breakdown.put("totalTax", totalTax);
        breakdown.put("discount", discount);
        breakdown.put("charges", charges);

        result.put("amount", amount != null ? amount : 0.0);
        result.put("date", parsedDate);
        result.put("merchant", merchant);
        result.put("category", category);
        result.put("confidence", amount != null && !"Receipt Purchase".equals(merchant) ? 92 : 75);
        result.put("breakdown", breakdown);
        return result;
    }

    private Double extractVal(String line, Pattern pattern) {
        Matcher m = pattern.matcher(line);
        if (m.find()) {
            String numStr = m.group(1).replaceAll("[\\s,]", "");
            try {
                double v = Double.parseDouble(numStr);
                return v > 0 ? v : null;
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}
