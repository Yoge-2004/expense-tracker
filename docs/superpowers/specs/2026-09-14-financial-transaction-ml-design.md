# Financial Transaction Intelligence ML Design

**Date:** 2026-09-14  
**Status:** Design ready for review  
**Target branch:** `refactor/modernize-codebase`

## 1. Problem

Expense Tracker should reduce manual transaction entry by understanding bank SMS messages, app notifications, imported transaction descriptions, and later receipts/statements. The ML system must identify transaction entities, transaction direction/type, merchant, category, and confidence while remaining privacy-conscious, inexpensive, fast, and suitable for eventual on-device inference.

The system must not assume that one model or one dataset can solve every financial-intelligence task. Extraction, classification, merchant resolution, and behavioral detection are separate problems with different data requirements.

## 2. Goals

- Extract structured transaction fields from financial messages.
- Categorize transactions using a global taxonomy that works across regions.
- Identify debit/credit/refund/reversal and related transaction types.
- Normalize messy merchant descriptions into canonical merchant identities where possible.
- Produce calibrated confidence and support an explicit `UNKNOWN` outcome.
- Learn from user corrections without retraining the model on every correction.
- Support India-first transaction formats while preserving global applicability.
- Prefer free/open-source training data and inference paths.
- Keep raw financial content local whenever practical.
- Establish evaluation sets that measure generalization to unseen merchants and formats.

## 3. Non-goals for the first ML release

- A general-purpose financial LLM.
- Investment advice or financial decision-making.
- Automatic payment initiation.
- Reading complete banking history through an unrestricted public UPI API.
- Training a separate giant model for every country.
- Treating synthetic data as equivalent to verified real-world data.

## 4. Proposed system

```text
SMS / Notification / Import / Receipt
                |
                v
       Transaction Extractor
                |
                +---- amount/date/reference/account
                +---- direction/type/payment method
                +---- merchant/beneficiary/bank
                |
                v
       Merchant Normalization
                |
                v
       Category Classification
                |
                v
       Confidence / Policy Engine
             /             \
      high confidence     uncertain
           |                  |
       auto-create        review inbox
                              |
                              v
                       user correction
                              |
                              v
                     personalization data
```

Behavioral models such as duplicate detection, recurring detection, and anomaly detection operate after structured transactions exist rather than attempting to parse raw messages themselves.

## 5. Model portfolio

### 5.1 Transaction Entity Extractor — highest priority

**Task:** token/sequence classification.

**Primary dataset:** `Ranjit0034/finee-dataset`.

Expected entities include:

- `AMOUNT`
- `CURRENCY`
- `MERCHANT`
- `BENEFICIARY`
- `BANK`
- `ACCOUNT`
- `REFERENCE`
- `VPA`
- `DATE`
- `TIME`
- `BALANCE`
- `TRANSACTION_TYPE`
- `STATUS`

Candidate architectures:

1. compact Transformer (MiniLM/DistilBERT family),
2. rule-assisted token classification baseline,
3. optionally an existing larger public model as a comparison baseline only.

The extractor should never invent missing fields.

### 5.2 Global Transaction Category Classifier — highest priority

**Task:** text classification.

**Training sources:**

- `mitulshah/transaction-categorization` as large-scale training/augmentation data after audit,
- `DoDataThings/us-bank-transaction-categories-v2`,
- selected regional/Indian datasets for augmentation.

Candidate models:

- TF-IDF + Logistic Regression / Linear SVM baseline,
- MiniLM classifier,
- DistilBERT classifier.

The final production option should be selected from measured accuracy, macro-F1, unseen-merchant F1, model size, RAM usage, and inference latency.

### 5.3 Transaction Type / Direction Classifier

Predict structured semantics such as:

- `DEBIT`
- `CREDIT`
- `REFUND`
- `REVERSAL`
- `TRANSFER`
- `SALARY`
- `ATM_WITHDRAWAL`
- `CASH_DEPOSIT`
- `FEE`
- `INTEREST`
- `EMI`
- `BILL_PAYMENT`
- `INVESTMENT`
- `CARD_PAYMENT`
- `UPI_PAYMENT`
- `UNKNOWN`

`direction` and `payment_method` remain separate fields. For example, a UPI transaction can be a debit.

### 5.4 Merchant Normalizer

Do not create one classifier class per merchant.

Preferred design:

```text
raw merchant text
      |
 normalization / aliases
      |
 sentence embedding
      |
 similarity search against merchant index
      |
 canonical merchant + similarity/confidence
```

New merchants can be added to the index without retraining the entire category model.

### 5.5 Duplicate Detector

A deterministic/similarity hybrid should compare:

- amount,
- timestamp proximity,
- normalized merchant,
- reference number,
- account/card source,
- transaction type,
- source channel.

This is not expected to require a large neural model.

### 5.6 Recurring Transaction Detector

Use transaction histories rather than raw text alone. Initial approach should be statistical/rule-based and later benchmark a sequence model only if needed.

### 5.7 Anomaly Detector

User-specific behavioral model using transaction amount, category, merchant, timing, and historical frequency. Initial candidates: robust statistical thresholds and Isolation Forest. The system must explain the trigger rather than present a financial conclusion as fact.

### 5.8 Personal Category Model

User corrections become feedback. Corrections should be buffered into a user feedback set and incorporated in periodic retraining or lightweight personalization. The system must not retrain the global model for every single correction.

## 6. Unified canonical schema

All source records should be normalized toward:

```json
{
  "raw_text": "...",
  "amount": 850.00,
  "currency": "INR",
  "transaction_type": "DEBIT",
  "merchant": "Swiggy",
  "beneficiary": null,
  "category": "FOOD_DINING",
  "subcategory": "FOOD_DELIVERY",
  "payment_method": "UPI",
  "bank": "HDFC",
  "account_last4": "1234",
  "reference": "...",
  "transaction_date": "...",
  "transaction_time": "...",
  "balance": null,
  "status": "SUCCESS",
  "country": "IN",
  "language": "en"
}
```

Source-specific fields must be retained in provenance metadata rather than discarded during normalization.

## 7. Canonical category hierarchy

Top-level categories:

- `FOOD_DINING`
- `TRANSPORTATION`
- `SHOPPING`
- `ENTERTAINMENT`
- `HEALTHCARE`
- `BILLS_UTILITIES`
- `TRAVEL`
- `FINANCIAL`
- `PERSONAL`
- `GOVERNMENT`
- `INCOME`
- `TRANSFERS`
- `CASH`
- `OTHER`
- `UNKNOWN`

Subcategories are versioned beneath these categories. Source labels are retained so mappings can be revised without losing provenance.

## 8. Dataset strategy

### 8.1 FinEE

Use primarily for extraction and transaction semantics. The dataset has 152K+ examples, multilingual Indian banking messages, and an explicitly identified manually verified real-SMS subset. The verified subset should be treated as high-value evaluation material unless a later audit proves it is safe to consume for training.

### 8.2 Global 4.5M transaction categorization

Use for large-scale category training only after schema, duplication, label-quality, and access review. It is gated and uses machine-generated annotations, so it must not be treated as the sole ground truth.

### 8.3 US Bank Categories v2

Use for messy bank-description patterns and category training. It is synthetic and should be combined with other sources rather than treated as real transaction ground truth.

### 8.4 Indian synthetic categorization

Use for Indian narration augmentation, rare-category coverage, and test cases. Do not use as the primary training source because of its small size and synthetic nature.

### 8.5 Indian bank statements

Reserve for document/statement parsing work. Do not merge it into the SMS category dataset.

## 9. Provenance requirements

Each normalized record must carry at least:

- source dataset,
- source type (`real_verified`, `real_unverified`, `synthetic`, `mixed`),
- source country,
- source language,
- source license,
- original label/category,
- canonical label/category,
- label quality indicator.

Synthetic and verified-real records must remain distinguishable throughout training and evaluation.

## 10. Evaluation design

A single random train/test split is insufficient.

Required evaluation suites:

### Random holdout

Normal benchmark for aggregate metrics.

### Unseen merchant

Merchants in the evaluation set must not occur in training where the test is intended to measure generalization.

### Unseen format

Hold out notification/narration patterns to test robustness to new bank formatting.

### Regional

Report results by country/region rather than only a global aggregate.

### Multilingual

Report results by language where data volume permits, particularly Indian languages represented in FinEE.

### Real-SMS gold set

Preserve the manually verified real-SMS subset as a high-value benchmark where licensing and access permit.

Metrics:

- accuracy,
- macro-F1,
- per-class precision/recall/F1,
- unseen-merchant F1,
- unknown/rejection quality,
- calibration/confidence quality,
- model size,
- peak RAM,
- inference latency.

## 11. Unknown and confidence policy

The system must explicitly allow `UNKNOWN`.

Initial policy targets are:

```text
high confidence   -> automatic transaction creation
medium confidence -> suggested transaction / review
low confidence    -> review only
```

Exact thresholds are to be learned from validation data and calibrated after observing false-positive and false-negative costs. The initial numeric values must not be hard-coded as production truth before calibration.

## 12. Privacy and deployment

Preferred deployment direction is local/on-device inference where feasible.

Potential runtime:

- ONNX Runtime for compact Transformer models,
- platform-native alternatives if later benchmarked superior.

The backend may perform synchronization and heavier analytics, but raw SMS/notification text should not leave the device merely to obtain categorization unless the user explicitly opts into such a flow.

## 13. Training sequence

1. Audit and normalize datasets.
2. Build the unified taxonomy and provenance pipeline.
3. Freeze evaluation sets.
4. Train TF-IDF + linear baselines.
5. Train MiniLM classifiers.
6. Train DistilBERT classifiers.
7. Train/evaluate FinEE extraction model.
8. Benchmark merchant normalization approaches.
9. Build hybrid rules + ML engine.
10. Calibrate confidence/rejection behavior.
11. Export the best compact model to mobile runtime.
12. Add privacy-preserving user feedback/personalization.

## 14. Success criteria

The first production candidate is successful only if it demonstrates all of the following in measured experiments:

- useful extraction accuracy on realistic transaction messages,
- strong category macro-F1 without relying on merchant memorization,
- acceptable performance on unseen merchants and unseen formats,
- predictable behavior on out-of-domain messages,
- a useful `UNKNOWN`/review path,
- mobile-feasible latency and memory usage,
- reproducible training and evaluation,
- provenance and licensing records for every training source.

## 15. Explicit constraints

- No paid AI API is a required component of the core transaction pipeline.
- No claim of universal/global performance may be made from a single-region benchmark.
- No model should be deployed solely because of random-split accuracy.
- No synthetic dataset should be described as real-world ground truth.
- No implementation should begin until this design/spec has been reviewed and approved.

## 16. Open decisions for implementation planning

- exact final subcategory taxonomy,
- exact FinEE entity label mapping after row-level inspection,
- model max sequence length,
- ONNX quantization strategy,
- merchant-index technology,
- confidence calibration method,
- user-feedback retention policy,
- CI training/evaluation workflow and artifact versioning.
