# ML Local Validation and Training Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate the Expense Tracker ML pipeline before any large training run, fix correctness defects, and make data ingestion and evaluation safe for multi-million-row datasets.

**Architecture:** Keep training offline in Python. First make the existing contract and test suite reliable, then harden Hugging Face ingestion and canonicalize training labels so multiple source taxonomies can be combined safely. Large-scale model training remains separate from application runtime.

**Tech Stack:** Python 3.11+, pandas, PyArrow/Parquet, Hugging Face Datasets, scikit-learn, PyTorch, Transformers, pytest, tqdm.

**Spec:** `docs/superpowers/specs/2026-09-16-ml-expense-intelligence-design.md`

## Global Constraints

- Keep ML training outside the Spring Boot runtime.
- Preserve tqdm progress reporting for large operations.
- Preserve configurable CPU/GPU resource usage.
- Do not commit raw public datasets or trained model binaries to the repository.
- Validate with pytest and Ruff before declaring the branch ready.

---

### Task 1: Restore the split-data contract

**Files:**
- Modify: `ml/src/expense_ml/data/split.py`
- Test: `ml/tests/test_master_pipeline.py`

**Interfaces:**
- Consumes prepared frames containing at least `text` and `label`.
- Produces `SplitResult` with stable source information when available.

- [x] **Step 1: Reproduce the existing failure**

Run: GitHub Actions ML Validation for the current branch.
Expected: the existing master-pipeline test fails with `KeyError: 'source'`.

- [ ] **Step 2: Write the minimal contract test if needed**

Ensure a master-pipeline frame without `source` does not crash during splitting.

- [ ] **Step 3: Implement the minimal fix**

Treat missing `source` as `unknown` inside `split_dataset` rather than requiring callers that only exercise the model pipeline to manufacture a source column.

- [ ] **Step 4: Verify the targeted test passes**

Run: `pytest tests/test_master_pipeline.py::test_master_manifest_has_pipeline_version -v`

- [ ] **Step 5: Run the complete ML test suite**

Run: `pytest -q`

### Task 2: Audit large-dataset ingestion

**Files:**
- Modify: `ml/src/expense_ml/data/fetch.py`
- Test: `ml/tests/test_fetch.py`
- Modify: `ml/src/expense_ml/data/normalize.py` only if required by the ingestion design

**Interfaces:**
- `fetch_huggingface_dataset(...)` continues returning a normalized frame and `FetchedDataset` manifest.
- `fetch_configured_datasets(...)` continues returning the combined prepared frame and source manifests.

- [ ] **Step 1: Add a regression test for bounded materialization**

Verify that ingestion uses batch/Arrow-oriented conversion rather than first constructing one Python dict per source row.

- [ ] **Step 2: Verify the new test fails against the current implementation**

Expected: the test identifies the eager `rows.append(...)` materialization path.

- [ ] **Step 3: Implement batch-safe ingestion**

Use Hugging Face/Arrow column operations or bounded batches and write Parquet without a giant Python list. Preserve nested label extraction and tqdm.

- [ ] **Step 4: Verify targeted fetch tests pass**

Run: `pytest tests/test_fetch.py -v`

- [ ] **Step 5: Run the complete test suite and static checks**

Run: `pytest -q` and `ruff check src tests --select E9,F`

### Task 3: Canonical category taxonomy

**Files:**
- Modify: `ml/config/datasets.yaml`
- Modify/Create: `ml/src/expense_ml/data/normalize.py` and/or a dedicated taxonomy module
- Test: `ml/tests/test_normalize.py`

**Interfaces:**
- Dataset-specific source labels map deterministically to the Expense Tracker canonical categories.
- Unknown labels are handled explicitly rather than silently becoming incorrect categories.

- [ ] **Step 1: Add taxonomy mapping tests**

Cover representative labels from every configured dataset and explicit unknown-label behavior.

- [ ] **Step 2: Verify tests fail before taxonomy mapping exists**

Expected: source labels remain dataset-specific.

- [ ] **Step 3: Implement configurable canonical mapping**

Keep mappings in configuration where practical and ensure normalization remains deterministic and testable.

- [ ] **Step 4: Verify targeted normalization tests pass**

Run: `pytest tests/test_normalize.py -v`

- [ ] **Step 5: Re-run the full ML suite**

Run: `pytest -q`

### Task 4: End-to-end smoke run

**Files:**
- Existing ML pipeline files only; no new production interface unless required.
- Test/fixture data: small synthetic dataset generated at runtime.

**Interfaces:**
- Master pipeline must complete with the Transformer disabled on a small dataset and produce manifest, reports, model artifacts, and figures.

- [ ] **Step 1: Run a small smoke dataset through every non-Transformer stage**

- [ ] **Step 2: Inspect generated manifest and report files**

- [ ] **Step 3: Verify all expected PNG figures are readable and non-empty**

- [ ] **Step 4: Run final tests and Ruff**

- [ ] **Step 5: Report remaining limitations, including anything that genuinely requires GPU-scale compute**
