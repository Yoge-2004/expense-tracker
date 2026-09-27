/**
 * Frontend Tesseract.js Client-Side OCR Engine for Receipts & Invoices.
 * Runs 100% on-device in Web Worker via WebAssembly. Zero backend API calls or data transmission.
 * Features multi-component breakdown extraction: Subtotal, GST (CGST, SGST, IGST), VAT, Taxes, Charges, & Grand Total.
 */
(function (global) {
    "use strict";

    let ocrWorker = null;
    let isProcessing = false;

    const CATEGORY_KEYWORDS = {
        "Food & Dining": ["restaurant", "cafe", "coffee", "bistro", "burger", "pizza", "swiggy", "zomato", "dining", "bar", "bakery", "kitchen", "grill"],
        "Groceries": ["supermarket", "grocery", "mart", "store", "provisions", "reliance", "dmart", "spencer", "nature's basket", "vegetables", "fruits", "milk", "dairy"],
        "Transportation": ["fuel", "petrol", "diesel", "gas", "shell", "hpcl", "bpcl", "ioc", "uber", "ola", "metro", "auto", "rail", "parking", "toll"],
        "Shopping": ["clothing", "apparel", "retail", "mall", "fashion", "zara", "h&m", "uniqlo", "lifestyle", "westside", "amazon", "flipkart"],
        "Utilities": ["electricity", "power", "water", "gas bill", "broadband", "wifi", "internet", "airtel", "jio", "vodafone"],
        "Health & Medical": ["pharmacy", "chemist", "drug", "hospital", "clinic", "medical", "apollo", "medplus", "healthcare", "diagnostic", "lab"],
        "Entertainment": ["cinema", "movie", "theatre", "imax", "pvr", "inox", "concert", "game", "bowling"]
    };

    function parseReceiptText(text) {
        if (!text || typeof text !== "string") return null;

        const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
        const result = {
            rawText: text,
            amount: null,
            date: null,
            merchant: "",
            category: null,
            confidence: 0,
            breakdown: {
                subtotal: null,
                cgst: null,
                sgst: null,
                igst: null,
                vat: null,
                serviceTax: null,
                totalTax: null,
                discount: null,
                charges: null,
                roundOff: null,
                grandTotal: null
            }
        };

        // Extraction helper
        function extractVal(line, regex) {
            const match = line.match(regex);
            if (!match) return null;
            const numStr = match[1].replace(/[\s,]/g, "");
            const val = parseFloat(numStr);
            return !isNaN(val) && val > 0 ? val : null;
        }

        // Multi-component Breakdown Regexes
        const subtotalRegex = /(?:sub\s*total|item\s*total|sub-total|items?\s*value|base\s*(?:amount|total)|taxable\s*value|gross\s*(?:amount|total))[\s:₹$€£]*([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{2})|[0-9]+[.,][0-9]{2})/i;
        const cgstRegex = /(?:cgst|central\s*gst)(?:\s*@?\s*\d+(?:\.\d+)?%?)?[\s:₹$€£]*([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{2})|[0-9]+[.,][0-9]{2})/i;
        const sgstRegex = /(?:sgst|state\s*gst|utgst)(?:\s*@?\s*\d+(?:\.\d+)?%?)?[\s:₹$€£]*([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{2})|[0-9]+[.,][0-9]{2})/i;
        const igstRegex = /(?:igst|integrated\s*gst)(?:\s*@?\s*\d+(?:\.\d+)?%?)?[\s:₹$€£]*([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{2})|[0-9]+[.,][0-9]{2})/i;
        const vatRegex = /(?:vat|value\s*added\s*tax)(?:\s*@?\s*\d+(?:\.\d+)?%?)?[\s:₹$€£]*([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{2})|[0-9]+[.,][0-9]{2})/i;
        const genTaxRegex = /(?:service\s*tax|cess|total\s*tax|tax\s*amount|gst(?:\s*@?\s*\d+(?:\.\d+)?%?)?|taxes)[\s:₹$€£]*([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{2})|[0-9]+[.,][0-9]{2})/i;
        const discountRegex = /(?:discount|coupon|promo|instant\s*savings?|less)[\s:₹$€£]*([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{2})|[0-9]+[.,][0-9]{2})/i;
        const chargesRegex = /(?:delivery(?:\s*fee|\s*charge)?|packing(?:\s*charge)?|service\s*charge|tip|gratuity|convenience\s*fee)[\s:₹$€£]*([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{2})|[0-9]+[.,][0-9]{2})/i;
        const roundOffRegex = /(?:round\s*off|rounding)[\s:₹$€£]*([+-]?[0-9]+(?:\.[0-9]{2})?)/i;
        const grandTotalRegex = /(?:grand\s*total|net\s*(?:amount\s*)?payable|total\s*payable|amount\s*payable|invoice\s*total|final\s*(?:amount|total)|bill\s*total|total\s*amount|amount\s*due|total\s*due|total\s*paid|paid\s*amount)[\s:₹$€£]*([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{2})|[0-9]+[.,][0-9]{2})/i;
        const genericTotalRegex = /(?:^|\s)total[\s:₹$€£]*([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{2})|[0-9]+[.,][0-9]{2})/i;

        // Scan lines for breakdown components
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (!result.breakdown.grandTotal) {
                const gt = extractVal(line, grandTotalRegex);
                if (gt) result.breakdown.grandTotal = gt;
            }
            if (!result.breakdown.subtotal) {
                const sub = extractVal(line, subtotalRegex);
                if (sub) result.breakdown.subtotal = sub;
            }
            if (!result.breakdown.cgst) {
                const cgst = extractVal(line, cgstRegex);
                if (cgst) result.breakdown.cgst = cgst;
            }
            if (!result.breakdown.sgst) {
                const sgst = extractVal(line, sgstRegex);
                if (sgst) result.breakdown.sgst = sgst;
            }
            if (!result.breakdown.igst) {
                const igst = extractVal(line, igstRegex);
                if (igst) result.breakdown.igst = igst;
            }
            if (!result.breakdown.vat) {
                const vat = extractVal(line, vatRegex);
                if (vat) result.breakdown.vat = vat;
            }
            if (!result.breakdown.totalTax) {
                const tx = extractVal(line, genTaxRegex);
                if (tx) result.breakdown.totalTax = tx;
            }
            if (!result.breakdown.discount) {
                const d = extractVal(line, discountRegex);
                if (d) result.breakdown.discount = d;
            }
            if (!result.breakdown.charges) {
                const ch = extractVal(line, chargesRegex);
                if (ch) result.breakdown.charges = ch;
            }
            if (!result.breakdown.roundOff) {
                const ro = extractVal(line, roundOffRegex);
                if (ro) result.breakdown.roundOff = ro;
            }
        }

        // Calculate combined taxes
        const itemizedTaxes = (result.breakdown.cgst || 0) + (result.breakdown.sgst || 0) + (result.breakdown.igst || 0) + (result.breakdown.vat || 0);
        if (itemizedTaxes > 0) {
            result.breakdown.totalTax = Number(itemizedTaxes.toFixed(2));
        }

        // Generic total fallback if explicit grandTotal was not labeled
        if (!result.breakdown.grandTotal) {
            for (let i = lines.length - 1; i >= 0; i--) {
                const match = lines[i].match(genericTotalRegex);
                if (match) {
                    const cleanNum = match[1].replace(/[\s,]/g, "");
                    const val = parseFloat(cleanNum);
                    if (!isNaN(val) && val > 0) {
                        result.breakdown.grandTotal = val;
                        break;
                    }
                }
            }
        }

        // Financial mathematical reconciliation
        if (!result.breakdown.grandTotal && result.breakdown.subtotal && result.breakdown.totalTax) {
            const computedTotal = result.breakdown.subtotal +
                result.breakdown.totalTax +
                (result.breakdown.charges || 0) -
                (result.breakdown.discount || 0) +
                (result.breakdown.roundOff || 0);
            result.breakdown.grandTotal = Number(computedTotal.toFixed(2));
        }

        // Final Amount Assignment: Always prioritize Grand Total (full liability)
        result.amount = result.breakdown.grandTotal || result.breakdown.subtotal;

        // Fallback: If no explicit 'total' line found, find largest decimal number with currency prefix
        if (!result.amount) {
            const currencyMatch = text.match(/[₹$€£]\s*([0-9]+(?:\.[0-9]{2})?)/g);
            if (currencyMatch && currencyMatch.length > 0) {
                const numbers = currencyMatch.map(s => parseFloat(s.replace(/[^0-9.]/g, ""))).filter(n => !isNaN(n));
                if (numbers.length > 0) {
                    result.amount = Math.max(...numbers);
                    result.breakdown.grandTotal = result.amount;
                }
            }
        }

        // 2. Date Extraction
        // Formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY, or "26 Sep 2026"
        const dateRegex = /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b|\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/i;
        for (const line of lines) {
            const match = line.match(dateRegex);
            if (match) {
                const rawDate = match[0];
                const parts = rawDate.split(/[-/]/);
                let parsedDate = null;
                if (parts[0].length === 4) {
                    // YYYY-MM-DD
                    parsedDate = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
                } else if (parts[2].length === 4 || parts[2].length === 2) {
                    // DD-MM-YYYY
                    const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                    parsedDate = `${yr}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
                }
                if (parsedDate && !isNaN(Date.parse(parsedDate))) {
                    result.date = parsedDate;
                    break;
                }
            }
        }
        if (!result.date) {
            result.date = new Date().toISOString().slice(0, 10);
        }

        // 3. Merchant / Description Extraction
        const ignoredHeaders = ["tax invoice", "retail invoice", "bill", "cash memo", "receipt", "welcome", "customer copy", "tax invoice/bill of supply"];
        for (let i = 0; i < Math.min(4, lines.length); i++) {
            const line = lines[i];
            const lower = line.toLowerCase();
            if (!ignoredHeaders.some(h => lower.includes(h)) && line.length >= 3 && !/^\d+$/.test(line)) {
                result.merchant = line.replace(/[^A-Za-z0-9\s&'-]/g, "").trim();
                break;
            }
        }
        if (!result.merchant) {
            result.merchant = "Receipt Purchase";
        }

        // 4. Category Prediction based on text scanning
        const lowerAll = text.toLowerCase();
        for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
            if (keywords.some(kw => lowerAll.includes(kw))) {
                result.category = cat;
                break;
            }
        }

        return result;
    }

    async function initOcrWorker(progressCallback) {
        if (ocrWorker) return ocrWorker;
        if (typeof Tesseract === "undefined") {
            throw new Error("Tesseract.js OCR library is not loaded. Please verify your connection.");
        }
        progressCallback("Initializing OCR Engine...", 10);
        const worker = await Tesseract.createWorker("eng", 1, {
            logger: m => {
                if (m.status === "recognizing text" && typeof m.progress === "number") {
                    const pct = Math.round(m.progress * 100);
                    progressCallback(`Scanning receipt (${pct}%)...`, pct);
                } else if (m.status) {
                    progressCallback(`${m.status.charAt(0).toUpperCase() + m.status.slice(1)}...`, 30);
                }
            }
        });
        ocrWorker = worker;
        return worker;
    }

    async function processReceiptImage(imageFile, callbacks) {
        if (isProcessing) return;
        isProcessing = true;

        try {
            callbacks.onStart?.();
            callbacks.onProgress?.("Initializing OCR worker...", 15);

            const worker = await initOcrWorker((msg, pct) => {
                callbacks.onProgress?.(msg, pct);
            });

            callbacks.onProgress?.("Recognizing character layout...", 50);
            const { data } = await worker.recognize(imageFile);

            callbacks.onProgress?.("Parsing financial metadata...", 95);
            const parsed = parseReceiptText(data.text);
            parsed.confidence = Math.round(data.confidence || 85);

            callbacks.onSuccess?.(parsed);
        } catch (err) {
            console.error("[ReceiptOCR] Recognition error:", err);
            callbacks.onError?.(err);
        } finally {
            isProcessing = false;
        }
    }

    function setupOcrWidget() {
        if (typeof document === "undefined") return;
        const dropZone = document.getElementById("receiptDropZone");
        const fileInput = document.getElementById("receiptFileInput");
        const triggerBtn = document.getElementById("triggerReceiptScanBtn");
        const progressBox = document.getElementById("receiptOcrProgress");
        const stageEl = document.getElementById("receiptOcrStage");
        const pctEl = document.getElementById("receiptOcrPct");
        const fillEl = document.getElementById("receiptOcrFill");
        const successBox = document.getElementById("receiptOcrSuccess");
        const summaryTextEl = document.getElementById("receiptOcrSummaryText");
        const breakdownBox = document.getElementById("receiptOcrBreakdown");
        const dismissBtn = document.getElementById("dismissReceiptOcrBtn");

        if (!dropZone || !fileInput) return;

        function handleFile(file) {
            if (!file || !file.type.startsWith("image/")) {
                if (typeof showToast === "function") {
                    showToast("Please upload a valid receipt image (JPG, PNG, WebP).", "error");
                }
                return;
            }

            processReceiptImage(file, {
                onStart() {
                    if (progressBox) progressBox.style.display = "block";
                    if (successBox) successBox.style.display = "none";
                    if (breakdownBox) breakdownBox.style.display = "none";
                    if (fillEl) fillEl.style.width = "5%";
                    if (pctEl) pctEl.textContent = "0%";
                    if (stageEl) stageEl.textContent = "Loading image...";
                },
                onProgress(msg, pct) {
                    if (stageEl) stageEl.textContent = msg;
                    if (pctEl) pctEl.textContent = `${pct}%`;
                    if (fillEl) fillEl.style.width = `${pct}%`;
                },
                onSuccess(parsed) {
                    if (progressBox) progressBox.style.display = "none";
                    if (successBox) {
                        successBox.style.display = "flex";
                        if (summaryTextEl) {
                            summaryTextEl.textContent = `✨ Extracted: ${parsed.merchant || "Store"} · ₹${parsed.amount || "0"} (${parsed.confidence}% OCR confidence)`;
                        }
                    }

                    // Pre-fill form fields
                    const descInput = document.getElementById("desc");
                    const amountInput = document.getElementById("amount");
                    const dateInput = document.getElementById("date");

                    const bd = parsed.breakdown || {};

                    // Render Interactive Breakdown Pills
                    if (breakdownBox) {
                        let pillsHtml = "";
                        const gt = bd.grandTotal || parsed.amount;
                        if (gt) {
                            pillsHtml += `<button type="button" class="receipt-breakdown-pill active" data-amt="${gt}" title="Click to apply Grand Total">💰 Total: ₹${gt.toFixed(2)}</button>`;
                        }
                        if (bd.subtotal && bd.subtotal !== gt) {
                            pillsHtml += `<button type="button" class="receipt-breakdown-pill" data-amt="${bd.subtotal}" title="Click to apply Subtotal (pre-tax)">📦 Subtotal: ₹${bd.subtotal.toFixed(2)}</button>`;
                        }
                        if (bd.totalTax) {
                            let taxTag = "GST/Tax";
                            if (bd.cgst && bd.sgst) taxTag = `CGST+SGST (₹${bd.cgst} + ₹${bd.sgst})`;
                            else if (bd.igst) taxTag = `IGST (₹${bd.igst})`;
                            else if (bd.vat) taxTag = `VAT (₹${bd.vat})`;
                            pillsHtml += `<span class="receipt-breakdown-pill" style="cursor:default;" title="Identified tax breakdown">🏛️ ${taxTag}: ₹${bd.totalTax.toFixed(2)}</span>`;
                        }
                        if (bd.discount) {
                            pillsHtml += `<span class="receipt-breakdown-pill" style="cursor:default;" title="Discount deducted">🏷️ Discount: -₹${bd.discount.toFixed(2)}</span>`;
                        }
                        if (bd.charges) {
                            pillsHtml += `<span class="receipt-breakdown-pill" style="cursor:default;" title="Fees and charges">🚚 Charges: ₹${bd.charges.toFixed(2)}</span>`;
                        }

                        if (pillsHtml) {
                            breakdownBox.innerHTML = pillsHtml;
                            breakdownBox.style.display = "flex";

                            // Attach click listeners to amount-switching pills
                            breakdownBox.querySelectorAll("button[data-amt]").forEach(btn => {
                                btn.addEventListener("click", (e) => {
                                    e.preventDefault();
                                    const amtVal = parseFloat(btn.dataset.amt);
                                    if (!isNaN(amtVal) && amountInput) {
                                        amountInput.value = amtVal.toFixed(2);
                                        amountInput.dispatchEvent(new Event("input", { bubbles: true }));
                                        breakdownBox.querySelectorAll("button[data-amt]").forEach(b => b.classList.remove("active"));
                                        btn.classList.add("active");
                                    }
                                });
                            });
                        } else {
                            breakdownBox.style.display = "none";
                        }
                    }

                    // Smart Description with Tax Annotation
                    if (descInput && parsed.merchant) {
                        if (bd.totalTax) {
                            descInput.value = `${parsed.merchant} (incl. ₹${bd.totalTax.toFixed(2)} Tax)`;
                        } else {
                            descInput.value = parsed.merchant;
                        }
                        descInput.dispatchEvent(new Event("input", { bubbles: true }));
                    }

                    if (amountInput && parsed.amount) {
                        amountInput.value = parsed.amount.toFixed(2);
                        amountInput.dispatchEvent(new Event("input", { bubbles: true }));
                    }

                    if (dateInput && parsed.date) {
                        dateInput.value = parsed.date;
                    }

                    // Auto-select category if matched
                    if (parsed.category) {
                        const catSelect = document.getElementById("categorySelect");
                        if (catSelect) {
                            for (let i = 0; i < catSelect.options.length; i++) {
                                if (catSelect.options[i].text.toLowerCase().includes(parsed.category.toLowerCase())) {
                                    catSelect.selectedIndex = i;
                                    catSelect.dispatchEvent(new Event("change", { bubbles: true }));
                                    break;
                                }
                            }
                        }
                    }

                    if (typeof showToast === "function") {
                        showToast("Receipt details extracted and pre-filled with breakdown!", "success");
                    }
                },
                onError(err) {
                    if (progressBox) progressBox.style.display = "none";
                    if (typeof showToast === "function") {
                        showToast(err.message || "Failed to process receipt image.", "error");
                    }
                }
            });
        }

        triggerBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            fileInput.click();
        });

        dropZone.addEventListener("click", () => {
            fileInput.click();
        });

        fileInput.addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) handleFile(file);
            fileInput.value = "";
        });

        dropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropZone.classList.add("dragover");
        });

        dropZone.addEventListener("dragleave", () => {
            dropZone.classList.remove("dragover");
        });

        dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropZone.classList.remove("dragover");
            const file = e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) handleFile(file);
        });

        dismissBtn?.addEventListener("click", () => {
            if (successBox) successBox.style.display = "none";
        });
    }

    if (typeof document !== "undefined" && document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupOcrWidget);
    } else {
        setupOcrWidget();
    }

    global.ReceiptOcr = {
        processReceiptImage,
        parseReceiptText
    };

})(typeof window !== "undefined" ? window : globalThis);
