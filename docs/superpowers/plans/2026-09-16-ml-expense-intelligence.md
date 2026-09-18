# ML Expense Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reproducible Python training pipeline that prepares transaction-category data, trains a TF-IDF baseline and compact Transformer classifier, evaluates them safely, and exports the selected model artifacts.

**Architecture:** `ml/` is isolated from the Spring Boot runtime. Dataset adapters produce a common dataframe schema; preprocessing and splitting are shared by both models; training and evaluation are separate commands; exported artifacts contain the model plus label/preprocessing metadata. Application inference is intentionally a later phase.

**Tech Stack:** Python 3.11+, pandas, scikit-learn, PyTorch, Hugging Face Transformers/Datasets, PyYAML, joblib, pytest.

**Spec:** `docs/superpowers/specs/2026-09-16-ml-expense-intelligence-design.md`

## Global Constraints

- Do not commit raw datasets.
- Do not commit personal financial records or secrets.
- Use a deterministic seed for preparation and training.
- Keep an untouched test set and an India-focused holdout when source metadata permits it.
- Keep model training outside Spring Boot.
- Store reproducibility metadata with every training run.

---

### Task 1: Python ML project foundation

**Files:**
- Create: `ml/pyproject.toml`
- Create: `ml/README.md`
- Create: `ml/.gitignore`
- Create: `ml/src/expense_ml/__init__.py`
- Create: `ml/src/expense_ml/config.py`
- Test: `ml/tests/test_config.py`

**Interfaces:**
- Produces a Python package importable as `expense_ml`.
- `TrainingConfig` contains seed, paths, model name, max sequence length, test/validation fractions, and confidence threshold.

- [ ] Add package metadata and pinned minimum dependency versions.
- [ ] Add config loading from YAML plus environment overrides for dataset/model paths.
- [ ] Add tests for defaults and YAML overrides.
- [ ] Run `cd ml && python -m pytest -q` and verify PASS.

### Task 2: Dataset normalization

**Files:**
- Create: `ml/config/datasets.yaml`
- Create: `ml/src/expense_ml/data/schema.py`
- Create: `ml/src/expense_ml/data/loaders.py`
- Create: `ml/src/expense_ml/data/normalize.py`
- Create: `ml/src/expense_ml/data/prepare.py`
- Test: `ml/tests/test_normalize.py`
- Test: `ml/tests/test_prepare.py`

**Interfaces:**
- `normalize_text(text: str) -> str`
- `normalize_category(label: str) -> str`
- `prepare_dataframe(frame) -> dataframe` with columns `text`, `label`, `source`.

- [ ] Define canonical schema and label normalization rules.
- [ ] Implement whitespace/case/punctuation normalization without destroying merchant semantics.
- [ ] Implement configurable local CSV/Parquet and Hugging Face dataset adapters.
- [ ] Deduplicate normalized `(text, label)` pairs while preserving source metadata.
- [ ] Add dataset statistics output.
- [ ] Test noisy narrations, empty values, duplicate rows, and category normalization.
- [ ] Run the focused tests and verify PASS.

### Task 3: Leakage-safe dataset splitting

**Files:**
- Create: `ml/src/expense_ml/data/split.py`
- Test: `ml/tests/test_split.py`

**Interfaces:**
- `split_dataset(frame, seed, test_size, validation_size) -> SplitResult`
- `SplitResult.train`, `.validation`, `.test`, and optional `.india_holdout`.

- [ ] Split deterministically with stratification where class counts allow it.
- [ ] Prevent exact normalized-text duplicates crossing train/test boundaries.
- [ ] Reserve an India-focused slice by source metadata when available.
- [ ] Persist split manifests containing row hashes, counts, class distributions, and seed.
- [ ] Test determinism and leakage prevention.
- [ ] Run focused tests and verify PASS.

### Task 4: TF-IDF baseline

**Files:**
- Create: `ml/src/expense_ml/models/tfidf.py`
- Create: `ml/src/expense_ml/train_baseline.py`
- Test: `ml/tests/test_tfidf.py`

**Interfaces:**
- `train_tfidf(train_frame, config) -> BaselineModel`
- `BaselineModel.predict(texts) -> PredictionBatch`
- `BaselineModel.save(path)`

- [ ] Build word and character TF-IDF features.
- [ ] Train Logistic Regression with class weighting.
- [ ] Expose probabilities and top predicted label.
- [ ] Save the fitted vectorizer, classifier, labels, and metadata with joblib.
- [ ] Test fit/predict/save-load round trip.
- [ ] Run focused tests and verify PASS.

### Task 5: Transformer classifier

**Files:**
- Create: `ml/src/expense_ml/models/transformer.py`
- Create: `ml/src/expense_ml/train_transformer.py`
- Test: `ml/tests/test_transformer.py`

**Interfaces:**
- `train_transformer(train_frame, validation_frame, config) -> TransformerModel`
- `TransformerModel.predict(texts) -> PredictionBatch`
- `TransformerModel.save(path)`

- [ ] Use a compact configurable Hugging Face sequence-classification checkpoint.
- [ ] Tokenize normalized transaction text with a configurable max length.
- [ ] Encode labels through a persisted label mapping.
- [ ] Train with deterministic seed, early stopping, and class-aware metrics.
- [ ] Save tokenizer, model, labels, and preprocessing metadata.
- [ ] Test tokenizer/model wiring without requiring a large training run.
- [ ] Run focused tests and verify PASS.

### Task 6: Unified evaluation and model selection report

**Files:**
- Create: `ml/src/expense_ml/evaluate.py`
- Create: `ml/src/expense_ml/report.py`
- Test: `ml/tests/test_evaluate.py`

**Interfaces:**
- `evaluate_model(model, frame) -> EvaluationResult`
- `compare_models(results) -> ComparisonReport`

- [ ] Compute accuracy, macro F1, weighted F1, per-class precision/recall/F1, and confusion matrix.
- [ ] Report India-focused metrics separately.
- [ ] Add confidence coverage at configurable thresholds.
- [ ] Produce JSON and human-readable Markdown reports.
- [ ] Select a model only according to configured metric criteria; never hard-code a winner.
- [ ] Test metrics against a small known dataset.
- [ ] Run focused tests and verify PASS.

### Task 7: Reproducible training CLI and artifact manifest

**Files:**
- Create: `ml/src/expense_ml/cli.py`
- Create: `ml/scripts/prepare_data.py`
- Create: `ml/scripts/train.py`
- Create: `ml/scripts/evaluate.py`
- Create: `ml/artifacts/.gitkeep`
- Modify: `ml/README.md`

**Interfaces:**
- `python -m expense_ml.cli prepare`
- `python -m expense_ml.cli train --model tfidf|transformer|both`
- `python -m expense_ml.cli evaluate`

- [ ] Add commands that orchestrate preparation, training, and evaluation.
- [ ] Generate timestamped run directories with config, dataset fingerprints, git revision, metrics, and model metadata.
- [ ] Ensure raw data and trained weights are ignored by Git.
- [ ] Document exact local commands and expected outputs.
- [ ] Run `python -m expense_ml.cli --help` and smoke-test `prepare` with a tiny fixture dataset.

### Task 8: CI validation

**Files:**
- Create: `.github/workflows/ml-validation.yml`
- Create: `ml/tests/fixtures/transactions.csv`

- [ ] Run Python formatting/linting and unit tests on the fixture only in CI.
- [ ] Do not download large datasets or train a Transformer in ordinary PR CI.
- [ ] Add a lightweight baseline smoke test.
- [ ] Verify workflow YAML and local test command.

### Task 9: Review and integration boundary

**Files:**
- Modify: `README.md`
- Create: `ml/docs/inference-contract.md`

- [ ] Document that training is offline and that application inference will consume exported artifacts.
- [ ] Define a future inference contract: input narration, predicted category, confidence, model version, and optional top-k predictions.
- [ ] Do not modify Spring Boot expense creation behavior in this phase.
- [ ] Run the repository's existing backend test suite plus ML tests where available.
