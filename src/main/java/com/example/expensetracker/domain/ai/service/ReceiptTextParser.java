package com.example.expensetracker.domain.ai.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.example.expensetracker.domain.ai.dto.MlClassificationRequest;
import com.example.expensetracker.domain.ai.dto.MlClassificationResponse;

/**
 * High-cohesion heuristic and machine-learning text parser for physical & digital receipts.
 * Satisfies the Single Responsibility Principle (SRP) by decoupling text pattern recognition,
 * mathematical reconciliation, and NLP categorization from image preprocessing and OCR runners.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Component
public class ReceiptTextParser {

    private final MlInferenceClient mlInferenceClient;

    public ReceiptTextParser() {
        this(null);
    }

    @Autowired
    public ReceiptTextParser(@Autowired(required = false) MlInferenceClient mlInferenceClient) {
        this.mlInferenceClient = mlInferenceClient;
    }

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
        CATEGORY_KEYWORDS = Map.copyOf(map);
    }

    private static final String CURRENCY_SYMBOLS = "[\\s:₹$€£]*(?:rs\\.?|inr)?\\s*";
    private static final String AMOUNT_PATTERN = "((?:[0-9]{1,3}(?:[,\\s][0-9]{3})*|[0-9]+)(?:[.,][0-9]{1,2})?)";

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
            "(?:discount|coupon|promo|instant\\s*savings?|less)(?:\\s*\\([^)]*\\))?[\\s:₹$€£\\-]*(?:rs\\.?|inr)?\\s*" + AMOUNT_PATTERN, Pattern.CASE_INSENSITIVE);
    private static final Pattern CHARGES_REGEX = Pattern.compile(
            "(?:delivery(?:\\s*fee|\\s*charge)?|packing(?:\\s*charge)?|service\\s*charge|tip|gratuity|convenience\\s*fee)(?:\\s*\\([^)]*\\))?[\\s:₹$€£+]*" + AMOUNT_PATTERN, Pattern.CASE_INSENSITIVE);
    private static final Pattern GRAND_TOTAL_REGEX = Pattern.compile(
            "(?:grand\\s*total|net\\s*(?:amount\\s*)?payable|total\\s*payable|amount\\s*payable|invoice\\s*total|final\\s*(?:amount|total)|bill\\s*total|total\\s*amount|amount\\s*due|total\\s*due|total\\s*paid|paid\\s*amount)" + CURRENCY_SYMBOLS + AMOUNT_PATTERN, Pattern.CASE_INSENSITIVE);
    private static final Pattern GENERIC_TOTAL_REGEX = Pattern.compile(
            "(?:^|\\s)total" + CURRENCY_SYMBOLS + AMOUNT_PATTERN, Pattern.CASE_INSENSITIVE);
    private static final Pattern CURRENCY_PREFIX_REGEX = Pattern.compile(
            "(?:[₹$€£]|\\brs\\.?|\\binr)\\s*" + AMOUNT_PATTERN, Pattern.CASE_INSENSITIVE);
    private static final Pattern DATE_REGEX = Pattern.compile(
            "\\b(\\d{4}[-/]\\d{1,2}[-/]\\d{1,2})\\b|\\b(\\d{1,2}[-/]\\d{1,2}[-/]\\d{2,4})\\b");
    private static final Pattern TEXT_DATE_REGEX = Pattern.compile(
            "\\b(\\d{1,2})[-/\\s]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/\\s]+(\\d{2,4})\\b", Pattern.CASE_INSENSITIVE);
    private static final Map<String, Integer> MONTH_NAMES = Map.ofEntries(
            Map.entry("jan", 1), Map.entry("feb", 2), Map.entry("mar", 3), Map.entry("apr", 4),
            Map.entry("may", 5), Map.entry("jun", 6), Map.entry("jul", 7), Map.entry("aug", 8),
            Map.entry("sep", 9), Map.entry("oct", 10), Map.entry("nov", 11), Map.entry("dec", 12)
    );

    private static final List<String> IGNORED_HEADERS = List.of(
            "tax invoice", "retail invoice", "bill", "cash memo", "receipt", "welcome",
            "customer copy", "tax invoice/bill of supply", "original for recipient"
    );

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
                } catch (Exception ex) {
                    log.debug("Notice parsing currency pattern: {}", ex.getMessage());
                }
            }
            if (maxVal > 0) {
                amount = maxVal;
                grandTotal = amount;
            }
        }

        // 2. Date parsing (numeric and textual month support)
        String parsedDate = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
        for (String line : lines) {
            Matcher tm = TEXT_DATE_REGEX.matcher(line);
            if (tm.find()) {
                try {
                    int day = Integer.parseInt(tm.group(1));
                    String mStr = tm.group(2).toLowerCase(Locale.ROOT).substring(0, 3);
                    Integer mNum = MONTH_NAMES.get(mStr);
                    String yrStr = tm.group(3);
                    int yr = yrStr.length() == 2 ? 2000 + Integer.parseInt(yrStr) : Integer.parseInt(yrStr);
                    if (mNum != null && day >= 1 && day <= 31) {
                        parsedDate = String.format("%04d-%02d-%02d", yr, mNum, day);
                        break;
                    }
                } catch (Exception ex) {
                    log.debug("Notice parsing textual date in line: {}", ex.getMessage());
                }
            }
            Matcher dm = DATE_REGEX.matcher(line);
            if (dm.find()) {
                String rawDate = dm.group(0);
                String[] parts = rawDate.split("[-/]");
                try {
                    if (parts.length == 3) {
                        if (parts[0].length() == 4) {
                            int y = Integer.parseInt(parts[0]);
                            int m = Integer.parseInt(parts[1]);
                            int d = Integer.parseInt(parts[2]);
                            if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                                parsedDate = String.format("%04d-%02d-%02d", y, m, d);
                                break;
                            }
                        } else if (parts[2].length() == 4 || parts[2].length() == 2) {
                            int yr = parts[2].length() == 2 ? 2000 + Integer.parseInt(parts[2]) : Integer.parseInt(parts[2]);
                            int first = Integer.parseInt(parts[0]);
                            int second = Integer.parseInt(parts[1]);
                            int d = first;
                            int m = second;
                            if (second > 12 && first <= 12) {
                                m = first;
                                d = second;
                            }
                            if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                                parsedDate = String.format("%04d-%02d-%02d", yr, m, d);
                                break;
                            }
                        }
                    }
                } catch (Exception ex) {
                    log.debug("Notice parsing numeric date pattern: {}", ex.getMessage());
                }
            }
        }

        // 3. Merchant detection
        String merchant = "Receipt Purchase";
        for (int i = 0; i < Math.min(5, lines.length); i++) {
            String candidate = lines[i].trim();
            String lower = candidate.toLowerCase(Locale.ROOT);
            boolean isHeader = IGNORED_HEADERS.stream().anyMatch(lower::contains);
            if (!isHeader && candidate.length() >= 3 && !candidate.matches("^\\d+$")) {
                merchant = candidate.replaceAll("[^A-Za-z0-9\\s&'-]", "").trim();
                if (!merchant.isEmpty()) break;
            }
        }

        // 4. Category prediction
        String category = "Miscellaneous";
        String lowerAll = text.toLowerCase(Locale.ROOT);
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

        // Delegate to high-performance ML inference client if available and heuristic confidence is low
        if (mlInferenceClient != null && maxMatches <= 1) {
            try {
                String candidateText = merchant + " " + text.substring(0, Math.min(text.length(), 200));
                MlClassificationResponse mlRes = mlInferenceClient.classify(new MlClassificationRequest(candidateText, 1));
                if (mlRes != null && mlRes.category() != null && mlRes.confidence() >= 0.45) {
                    String norm = normalizeMlCategory(mlRes.category());
                    if (norm != null) {
                        category = norm;
                    }
                }
            } catch (Exception ex) {
                log.debug("ML category prediction fallback to heuristic: {}", ex.getMessage());
            }
        }

        // 5. Line items parsing
        List<Map<String, Object>> items = new ArrayList<>();
        Pattern itemPattern = Pattern.compile("^(.*?)(?:\\s{2,}|\\t|\\s+[$₹€£])(\\d+(?:\\.\\d{1,2})?)$");
        for (String line : lines) {
            Matcher m = itemPattern.matcher(line.trim());
            if (m.find()) {
                String desc = m.group(1).trim();
                if (!desc.equalsIgnoreCase("total") && !desc.equalsIgnoreCase("subtotal") && desc.length() > 2) {
                    try {
                        double itemPrice = Double.parseDouble(m.group(2));
                        items.add(Map.of("name", desc, "price", itemPrice));
                    } catch (NumberFormatException _) {
                        // ignore unparseable row
                    }
                }
            }
        }

        // Detailed tax breakdown map
        Map<String, Object> breakdown = new LinkedHashMap<>();
        breakdown.put("subtotal", subtotal);
        breakdown.put("cgst", cgst);
        breakdown.put("sgst", sgst);
        breakdown.put("igst", igst);
        breakdown.put("vat", vat);
        breakdown.put("totalTax", totalTax);
        breakdown.put("discount", discount);
        breakdown.put("charges", charges);
        breakdown.put("grandTotal", grandTotal != null ? grandTotal : amount);

        result.put("amount", amount);
        result.put("date", parsedDate);
        result.put("merchant", merchant);
        result.put("category", category);
        result.put("breakdown", breakdown);
        result.put("items", items);

        return result;
    }

    private static Double extractVal(String line, Pattern pattern) {
        Matcher m = pattern.matcher(line);
        if (m.find()) {
            try {
                String raw = m.group(1).replaceAll("[\\s,]", "");
                return Double.parseDouble(raw);
            } catch (Exception _) {
                return null;
            }
        }
        return null;
    }

    private static String normalizeMlCategory(String raw) {
        if (raw == null) return null;
        String lower = raw.trim().toLowerCase(Locale.ROOT);
        return switch (lower) {
            case "food", "dining", "restaurant", "food & dining" -> "Food & Dining";
            case "groceries", "grocery", "supermarket" -> "Groceries";
            case "transport", "transportation", "travel", "fuel" -> "Transportation";
            case "shopping", "retail", "apparel" -> "Shopping";
            case "utilities", "bills", "utility" -> "Utilities";
            case "health", "medical", "healthcare" -> "Health & Medical";
            case "entertainment", "leisure", "movies" -> "Entertainment";
            default -> null;
        };
    }
}
