# Expense Tracker ML Continuous-Learning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current Expense Tracker ML subsystem into an automation-ready training/inference system using `uv`, versioned model artifacts, validated feedback ingestion, FastAPI inference, and Hugging Face Job-compatible retraining while preserving the existing leakage-safe training pipeline.

**Architecture:** Heavy training runs outside production, first from the laptop and later from Hugging Face Jobs. The production Hugging Face Docker Space may run Spring Boot and Python FastAPI together, with Python inference-only; feedback remains owned by Spring Boot, candidate models are evaluated before promotion, and explicit model revisions provide rollback.

**Tech Stack:** Python 3.14 baseline, uv + uv.lock, pandas, NumPy, PyArrow, scikit-learn, PyTorch, Transformers, Datasets, FastAPI, Uvicorn, Hugging Face Hub, pytest, Ruff, Docker, Spring Boot integration over HTTP.

**Spec:** `docs/superpowers/specs/2026-09-18-ml-continuous-learning-design.md`

## Global Constraints

- Keep heavy ML training outside the production serving container.
- Support local development/training with `uv` and a modern supported Python version.
- Support automated retraining through Hugging Face Jobs.
- Serve Spring Boot and Python inference from one Hugging Face Docker Space when desired.
- Collect user corrections through the existing Spring Boot backend and database.
- Promote a newly trained model only after automated quality and regression gates pass.
- Keep model versions reproducible and rollbackable.
- Separate training dependencies from inference dependencies.
- Training is never started by the production container.
- Python does not write directly to the Spring Boot business database.
- No tokens are committed to source control.
- CI uses deterministic smoke fixtures; full training runs execute in dedicated training jobs.
- Existing normalization, taxonomy, splitting, sampling, training, evaluation, auxiliary models, and reporting implementations are reused rather than duplicated.
- Production serving references an explicit model revision rather than an unknown or mutable artifact.
- Training job failures and candidate quality failures leave the current production model unchanged.

---

### Task 1: Modernize the Python project and uv dependency model

**Files:**
- Modify: `ml/pyproject.toml`
- Create: `ml/uv.lock`
- Create: `ml/.python-version`
- Test: `ml/tests/test_project_metadata.py`

**Interfaces:**
- Consumes: existing package imports under `src/expense_ml`.
- Produces: a reproducible Python 3.14 project with installable `train`, `serve`, and `dev` dependency extras and a generated lockfile.

- [ ] **Step 1: Write the failing metadata test**

```python
from pathlib import Path
import tomllib


def test_ml_project_declares_python_314_and_separate_dependency_groups():
    root = Path(__file__).parents[1]
    data = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
    assert data["project"]["requires-python"] == ">=3.14,<3.15"
    optional = data["project"]["optional-dependencies"]
    assert {"train", "serve", "dev"} <= set(optional)
    assert any("torch" in dep for dep in optional["train"])
    assert any("fastapi" in dep for dep in optional["serve"])
```

- [ ] **Step 2: Run the focused test to verify the expected metadata failure**

Run: `cd ml && uv run --python 3.14 pytest tests/test_project_metadata.py::test_ml_project_declares_python_314_and_separate_dependency_groups -v`

Expected: FAIL because the current project uses the old Python floor and a single dependency set.

- [ ] **Step 3: Update `pyproject.toml` to compatible ranges**

Use Python `>=3.14,<3.15`. Move training-only dependencies such as `torch`, `transformers`, `datasets`, `accelerate`, `scikit-learn`, pandas, NumPy, SciPy, PyArrow, Matplotlib, and tqdm into the `train` extra. Put `fastapi`, `uvicorn`, `huggingface-hub`, and only required inference libraries in `serve`. Keep pytest and Ruff in `dev`. Do not preserve historical exact version pins merely for compatibility.

- [ ] **Step 4: Create `.python-version` and resolve the lockfile**

```text
3.14
```

Run: `cd ml && uv lock`

- [ ] **Step 5: Run the focused metadata test again**

Run: `cd ml && uv run --extra dev pytest tests/test_project_metadata.py::test_ml_project_declares_python_314_and_separate_dependency_groups -v`

Expected: PASS.

- [ ] **Step 6: Run dependency/import smoke tests**

Run: `cd ml && uv run --extra dev ruff check src tests --select E9,F && uv run --extra dev pytest -q`

Expected: no import errors, Ruff errors, or test failures.

- [ ] **Step 7: Commit**

```bash
git add ml/pyproject.toml ml/uv.lock ml/.python-version ml/tests/test_project_metadata.py
git commit -m "build(ml): migrate project to uv and split dependencies"
```

### Task 2: Make training independent of Kaggle and expose a reusable job contract

**Files:**
- Create: `ml/src/expense_ml/training/__init__.py`
- Create: `ml/src/expense_ml/training/job.py`
- Modify: `ml/src/expense_ml/master_pipeline.py`
- Modify: `ml/kaggle_train.py`
- Test: `ml/tests/test_training_job.py`

**Interfaces:**
- Consumes: `train_all()`, `load_input()`, `TrainingConfig`, dataset manifests, and the existing model/evaluation functions.
- Produces: `run_training_job(config_path, prepared_path, output_path, include_transformer=True) -> dict` that has no Kaggle-only assumptions.

- [ ] **Step 1: Write a failing job-wrapper test**

```python
from pathlib import Path
import pandas as pd

from expense_ml.training.job import run_training_job


def test_training_job_uses_explicit_paths_and_returns_completed_manifest(tmp_path):
    prepared = tmp_path / "prepared.parquet"
    output = tmp_path / "runs"
    pd.DataFrame(
        [
            {"text": "grocery one", "label": "food_dining", "source": "fixture", "country": "India"},
            {"text": "ride one", "label": "transportation", "source": "fixture", "country": "India"},
            {"text": "grocery two", "label": "food_dining", "source": "fixture", "country": "India"},
            {"text": "ride two", "label": "transportation", "source": "fixture", "country": "India"},
        ] * 10
    ).to_parquet(prepared, index=False)

    manifest = run_training_job(Path("config/datasets.yaml"), prepared, output, include_transformer=False)
    assert manifest["status"] == "completed"
    assert Path(manifest["run_directory"]).exists()
```

- [ ] **Step 2: Run the test and verify it fails because the reusable job module does not exist**

Run: `cd ml && uv run --extra train --extra dev pytest tests/test_training_job.py::test_training_job_uses_explicit_paths_and_returns_completed_manifest -v`

Expected: FAIL with the missing module/function.

- [ ] **Step 3: Implement the reusable job wrapper**

The wrapper must call the existing `master_pipeline.load_input()` and `train_all()`, construct a run directory, and return the completed manifest. It must accept all paths as arguments and never reference `/kaggle/...`.

- [ ] **Step 4: Reduce `kaggle_train.py` to compatibility glue**

Keep Kaggle authentication and repository-sync conveniences there, but make the final invocation call `expense_ml.training.job.run_training_job(...)`. No training logic should be duplicated.

- [ ] **Step 5: Run the focused test**

Run: `cd ml && uv run --extra train --extra dev pytest tests/test_training_job.py::test_training_job_uses_explicit_paths_and_returns_completed_manifest -v`

Expected: PASS.

- [ ] **Step 6: Run all ML tests**

Run: `cd ml && uv run --extra train --extra dev pytest -q`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add ml/src/expense_ml/training ml/src/expense_ml/master_pipeline.py ml/kaggle_train.py ml/tests/test_training_job.py
git commit -m "refactor(ml): expose environment-independent training job"
```

### Task 3: Add feedback schema, validation, and ingestion boundary

**Files:**
- Create: `ml/src/expense_ml/feedback/__init__.py`
- Create: `ml/src/expense_ml/feedback/schema.py`
- Create: `ml/src/expense_ml/feedback/validation.py`
- Create: `ml/src/expense_ml/feedback/client.py`
- Test: `ml/tests/test_feedback.py`

**Interfaces:**
- Consumes: canonical taxonomy from `expense_ml.data.taxonomy`.
- Produces: `FeedbackRecord`, `validate_feedback_rows()`, and `fetch_training_feedback()` with deterministic eligibility filtering and cursor support.

- [ ] **Step 1: Write failing validation tests**

```python
import pytest

from expense_ml.feedback.schema import FeedbackRecord
from expense_ml.feedback.validation import validate_feedback_rows


def test_feedback_validator_rejects_unknown_categories():
    with pytest.raises(ValueError, match="Unknown category"):
        validate_feedback_rows([
            FeedbackRecord(
                feedback_id="1",
                transaction_id="t1",
                text="coffee",
                predicted_category="food_dining",
                corrected_category="not_real",
                confidence=0.8,
                model_version="v1",
                created_at="2026-09-18T00:00:00Z",
                training_status="eligible",
            )
        ])
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `cd ml && uv run --extra dev pytest tests/test_feedback.py::test_feedback_validator_rejects_unknown_categories -v`

Expected: FAIL because the feedback types/validator are not present.

- [ ] **Step 3: Implement immutable feedback schema and validation rules**

Require stable feedback ID, transaction ID, non-empty transaction text, canonical predicted/corrected categories, confidence in `[0,1]`, model version, timestamp, and an eligibility status. Reject duplicate feedback IDs, contradictory duplicate corrections, empty text, and unknown categories. Preserve source/model provenance.

- [ ] **Step 4: Implement HTTP ingestion client**

`fetch_training_feedback(base_url, token, after_cursor=None, limit=1000)` must call the Spring internal endpoint, parse JSON into `FeedbackRecord` values, and return records plus the new cursor. It must never log authorization headers or tokens.

- [ ] **Step 5: Run focused and full tests**

Run: `cd ml && uv run --extra dev pytest tests/test_feedback.py -q && uv run --extra dev pytest -q`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add ml/src/expense_ml/feedback ml/tests/test_feedback.py
git commit -m "feat(ml): add validated continuous-learning feedback boundary"
```

### Task 4: Add training-data assembly from curated corpus plus verified feedback

**Files:**
- Create: `ml/src/expense_ml/training/dataset.py`
- Test: `ml/tests/test_training_dataset.py`

**Interfaces:**
- Consumes: prepared base corpus and validated `FeedbackRecord` objects.
- Produces: deterministic `build_training_frame(base_frame, feedback_records) -> pandas.DataFrame` and `feedback_fingerprint(records) -> str`.

- [ ] **Step 1: Write the failing merge test**

```python
import pandas as pd

from expense_ml.feedback.schema import FeedbackRecord
from expense_ml.training.dataset import build_training_frame


def test_training_frame_adds_only_eligible_feedback_and_preserves_canonical_labels():
    base = pd.DataFrame([
        {"text": "grocery", "label": "food_dining", "source": "base", "country": "India"},
        {"text": "taxi", "label": "transportation", "source": "base", "country": "India"},
    ])
    records = [
        FeedbackRecord(
            feedback_id="f1", transaction_id="t1", text="restaurant", predicted_category="shopping_retail",
            corrected_category="food_dining", confidence=0.6, model_version="v1",
            created_at="2026-09-18T00:00:00Z", training_status="eligible"
        ),
        FeedbackRecord(
            feedback_id="f2", transaction_id="t2", text="noise", predicted_category="shopping_retail",
            corrected_category="food_dining", confidence=0.6, model_version="v1",
            created_at="2026-09-18T00:00:00Z", training_status="pending"
        ),
    ]
    result = build_training_frame(base, records)
    assert len(result) == 3
    assert "restaurant" in set(result["text"])
    assert "noise" not in set(result["text"])
    assert set(result["label"]) <= {"food_dining", "transportation"}
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `cd ml && uv run --extra dev pytest tests/test_training_dataset.py::test_training_frame_adds_only_eligible_feedback_and_preserves_canonical_labels -v`

Expected: FAIL because the dataset builder does not exist.

- [ ] **Step 3: Implement deterministic assembly**

Add only `training_status == "eligible"` records, normalize to the existing schema, preserve provenance, deduplicate by stable feedback ID and normalized text/label, and compute a reproducible fingerprint over ordered feedback IDs plus base-frame fingerprint.

- [ ] **Step 4: Run focused and full tests**

Run: `cd ml && uv run --extra dev pytest tests/test_training_dataset.py -q && uv run --extra dev pytest -q`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ml/src/expense_ml/training/dataset.py ml/tests/test_training_dataset.py
git commit -m "feat(ml): assemble verified feedback into training corpus"
```

### Task 5: Add candidate manifests, production comparison, and promotion gate

**Files:**
- Create: `ml/src/expense_ml/training/candidate.py`
- Create: `ml/src/expense_ml/training/promotion.py`
- Modify: `ml/src/expense_ml/reporting.py`
- Test: `ml/tests/test_promotion.py`

**Interfaces:**
- Consumes: completed training manifests and evaluation dictionaries.
- Produces: `CandidateManifest`, `evaluate_candidate()`, and `promote_candidate()` decisions without mutating production on failure.

- [ ] **Step 1: Write failing promotion tests**

```python
from expense_ml.training.promotion import evaluate_candidate


def test_candidate_is_rejected_when_test_macro_f1_is_below_gate():
    decision = evaluate_candidate(
        candidate={"test_accuracy": 0.95, "test_macro_f1": 0.88},
        current={"test_accuracy": 0.94, "test_macro_f1": 0.87},
        minimum_accuracy=0.90,
        minimum_macro_f1=0.90,
    )
    assert decision.promote is False
    assert "macro_f1" in decision.reason


def test_candidate_can_promote_only_after_beating_required_thresholds():
    decision = evaluate_candidate(
        candidate={"test_accuracy": 0.96, "test_macro_f1": 0.92},
        current={"test_accuracy": 0.95, "test_macro_f1": 0.91},
        minimum_accuracy=0.90,
        minimum_macro_f1=0.90,
    )
    assert decision.promote is True
```

- [ ] **Step 2: Run the focused promotion tests and verify failure**

Run: `cd ml && uv run --extra dev pytest tests/test_promotion.py -q`

Expected: FAIL because promotion types/functions do not exist.

- [ ] **Step 3: Implement candidate manifest and promotion decision**

Store training-data fingerprint, git commit, Python version, dependency lock hash, model revision, validation metrics, test metrics, country metrics, India holdout metrics, and artifact paths. Promotion must require all configured gates and must not overwrite or mutate the current production reference on rejection.

- [ ] **Step 4: Wire model-comparison reporting to the existing pipeline**

Use the already-imported `save_model_comparison()` instead of leaving a linter exception for the unused import. Persist `model_comparison.png` and the machine-readable comparison from the same validation result data.

- [ ] **Step 5: Run promotion and existing ML tests**

Run: `cd ml && uv run --extra dev pytest tests/test_promotion.py -q && uv run --extra dev ruff check src tests --select E9,F && uv run --extra dev pytest -q`

Expected: PASS with no per-file ignore needed for the model-comparison import once the call is wired.

- [ ] **Step 6: Commit**

```bash
git add ml/src/expense_ml/training ml/src/expense_ml/reporting.py ml/tests/test_promotion.py
 git commit -m "feat(ml): add candidate manifests and safe promotion gates"
```

### Task 6: Add FastAPI inference service and explicit model registry

**Files:**
- Create: `ml/src/expense_ml/inference/__init__.py`
- Create: `ml/src/expense_ml/inference/model_registry.py`
- Create: `ml/src/expense_ml/inference/service.py`
- Create: `ml/api/main.py`
- Test: `ml/tests/test_api.py`

**Interfaces:**
- Consumes: published model revision from environment and existing category model artifacts.
- Produces: `GET /health`, `POST /api/v1/classify`, and `POST /api/v1/analyze` with stable JSON schemas.

- [ ] **Step 1: Write failing API tests**

```python
from fastapi.testclient import TestClient

from expense_ml.api.main import app

client = TestClient(app)


def test_health_contract():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] in {"ok", "degraded"}


def test_classify_rejects_empty_description():
    response = client.post("/api/v1/classify", json={"description": ""})
    assert response.status_code == 422
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `cd ml && uv run --extra serve --extra dev pytest tests/test_api.py -q`

Expected: FAIL because the API module and route contracts do not exist.

- [ ] **Step 3: Implement model registry**

Load only an explicit `MODEL_REVISION` or `MODEL_ID` from environment. Fail clearly when the model cannot be loaded. Expose the loaded revision in health/diagnostic output. Never silently fall back to an unknown model.

- [ ] **Step 4: Implement inference service and FastAPI routes**

Use Pydantic request/response models. `classify` returns category, confidence, model revision, and optional alternatives. `analyze` delegates only to inference-safe auxiliary models that are actually available in the published artifact.

- [ ] **Step 5: Run API tests**

Run: `cd ml && uv run --extra serve --extra dev pytest tests/test_api.py -q`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add ml/src/expense_ml/inference ml/api ml/tests/test_api.py
 git commit -m "feat(ml): add versioned FastAPI inference service"
```

### Task 7: Add the combined Spring Boot + Python Docker runtime

**Files:**
- Create: `ml/Dockerfile`
- Create: `ml/docker/supervisord.conf`
- Create: `ml/docker/nginx.conf`
- Create: `ml/docker/entrypoint.sh`
- Modify: existing Spring Boot Docker build file or add `Dockerfile` at repository deployment root after inspecting current backend packaging
- Test: `ml/tests/test_docker_contract.py`

**Interfaces:**
- Consumes: built Spring Boot JAR and Python `serve` environment.
- Produces: one container with Spring Boot on `8080`, FastAPI on `8000`, and one externally exposed gateway on `7860`.

- [ ] **Step 1: Write the failing Docker contract test**

```python
from pathlib import Path


def test_docker_runtime_declares_required_ports_and_services():
    root = Path(__file__).parents[1]
    dockerfile = (root / "Dockerfile").read_text(encoding="utf-8")
    supervisor = (root / "docker/supervisord.conf").read_text(encoding="utf-8")
    nginx = (root / "docker/nginx.conf").read_text(encoding="utf-8")
    assert "7860" in dockerfile
    assert "8080" in supervisor
    assert "8000" in supervisor
    assert "8000" in nginx
    assert "8080" in nginx
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `cd ml && uv run --extra dev pytest tests/test_docker_contract.py -q`

Expected: FAIL because the production Docker runtime does not exist.

- [ ] **Step 3: Implement multi-process runtime**

Use a process supervisor for Spring Boot and Uvicorn, with Nginx routing the external Space port. Spring-to-Python calls use `http://127.0.0.1:8000`. Configure graceful signal forwarding and clear process failure visibility.

- [ ] **Step 4: Add model revision environment variables**

The container must accept a specific model revision at startup. Do not bake secrets into the image.

- [ ] **Step 5: Build and run the container locally**

Run: `docker build -t expense-tracker-space -f ml/Dockerfile .`

Then: `docker run --rm -p 7860:7860 -e MODEL_ID=<test-model> expense-tracker-space`

Verify with: `curl -f http://127.0.0.1:7860/health`

Expected: HTTP 200 and the loaded model revision reported.

- [ ] **Step 6: Commit**

```bash
git add ml/Dockerfile ml/docker ml/tests/test_docker_contract.py
 git commit -m "feat(deploy): add combined Spring and Python Docker runtime"
```

### Task 8: Add automated retraining job entrypoint and HF-compatible automation contract

**Files:**
- Create: `ml/jobs/retrain.py`
- Create: `ml/jobs/publish.py`
- Create: `ml/config/automation.yaml`
- Modify: `ml/README_MASTER_TRAINING.md`
- Test: `ml/tests/test_retrain_job.py`

**Interfaces:**
- Consumes: Spring feedback endpoint, base training corpus, current production model metadata, and environment secrets.
- Produces: candidate run, promotion decision, optional Hub publication, and machine-readable job summary.

- [ ] **Step 1: Write a failing retraining-job test**

```python
from expense_ml.jobs.retrain import should_retrain


def test_retrain_waits_until_feedback_threshold_or_schedule_window():
    assert should_retrain(new_feedback_count=499, threshold=500, scheduled=True) is False
    assert should_retrain(new_feedback_count=500, threshold=500, scheduled=False) is True
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `cd ml && uv run --extra train --extra dev pytest tests/test_retrain_job.py -q`

Expected: FAIL because the automation entrypoints do not exist.

- [ ] **Step 3: Implement trigger decision**

Support a feedback threshold, a scheduled training window, and an explicit force flag. Exit successfully without GPU training when there is insufficient new eligible feedback.

- [ ] **Step 4: Implement retraining orchestration**

The job must fetch eligible feedback, build the augmented corpus, run the reusable training job, evaluate against the current production model, and stop without publishing when any gate fails.

- [ ] **Step 5: Implement Hub publication separately**

`publish.py` receives a validated candidate directory and publishes the model plus manifest to a configured Hugging Face model repository/revision. It must never publish a failed candidate.

- [ ] **Step 6: Add explicit automation configuration**

`automation.yaml` must define: feedback endpoint variable names, threshold, schedule, model repository, current-model reference, candidate output path, and required secret names without embedding secret values.

- [ ] **Step 7: Run focused tests and static checks**

Run: `cd ml && uv run --extra train --extra dev pytest tests/test_retrain_job.py -q && uv run --extra dev ruff check src tests jobs --select E9,F && uv run --extra dev pytest -q`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add ml/jobs ml/config/automation.yaml ml/README_MASTER_TRAINING.md ml/tests/test_retrain_job.py
git commit -m "feat(ml): add automated retraining and publication jobs"
```

### Task 9: Add deployment metadata and production documentation

**Files:**
- Create: `ml/README_INFERENCE.md`
- Create: `ml/.dockerignore`
- Modify: `ml/README.md`
- Modify: `ml/README_MASTER_TRAINING.md`
- Test: `ml/tests/test_docs_contract.py`

**Interfaces:**
- Consumes: final training, API, Docker, and automation contracts.
- Produces: operator documentation covering local `uv` training, HF Job execution, model publishing, Space deployment, model revision changes, rollback, and Spring-to-Python API calls.

- [ ] **Step 1: Write a failing documentation contract test**

```python
from pathlib import Path


def test_docs_describe_uv_training_automation_and_model_revision():
    root = Path(__file__).parents[1]
    docs = "\n".join(
        (root / name).read_text(encoding="utf-8")
        for name in ["README.md", "README_MASTER_TRAINING.md", "README_INFERENCE.md"]
    )
    assert "uv sync" in docs
    assert "MODEL_REVISION" in docs
    assert "Hugging Face Jobs" in docs
    assert "rollback" in docs.lower()
```

- [ ] **Step 2: Run and verify failure**

Run: `cd ml && uv run --extra dev pytest tests/test_docs_contract.py -q`

Expected: FAIL because the new documentation does not exist or lacks the required workflow terms.

- [ ] **Step 3: Document the operator workflow**

Include exact commands for Python 3.14 + uv setup, local training, smoke training, feedback retraining, candidate inspection, model publication, Space startup, model-revision changes, and rollback to the previous known-good revision.

- [ ] **Step 4: Document the Spring Boot integration contract**

Describe the internal FastAPI endpoints and the stable JSON response shape. Keep authentication, persistence, and business rules in Java.

- [ ] **Step 5: Run the docs test and full ML verification**

Run: `cd ml && uv run --extra dev pytest tests/test_docs_contract.py -q && uv run --extra dev ruff check src tests jobs --select E9,F && uv run --extra dev pytest -q`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add ml/README.md ml/README_MASTER_TRAINING.md ml/README_INFERENCE.md ml/.dockerignore ml/tests/test_docs_contract.py
git commit -m "docs(ml): document automated training and inference operations"
```

### Task 10: End-to-end verification and CI integration

**Files:**
- Modify: `.github/workflows/ml-validation.yml`
- Create: `ml/tests/test_end_to_end_contract.py`

**Interfaces:**
- Consumes: all previously implemented components.
- Produces: deterministic CI coverage for training contracts, feedback, promotion, API, and container contracts without running the full 4.5M-row training corpus.

- [ ] **Step 1: Write the failing end-to-end smoke contract**

```python
from expense_ml.training.promotion import evaluate_candidate


def test_candidate_lifecycle_contract():
    decision = evaluate_candidate(
        candidate={"test_accuracy": 0.95, "test_macro_f1": 0.93},
        current={"test_accuracy": 0.94, "test_macro_f1": 0.92},
        minimum_accuracy=0.90,
        minimum_macro_f1=0.90,
    )
    assert decision.promote is True
```

- [ ] **Step 2: Run the focused smoke test and verify failure if the lifecycle is incomplete**

Run: `cd ml && uv run --extra dev pytest tests/test_end_to_end_contract.py -q`

Expected: PASS only after all lifecycle contracts are available.

- [ ] **Step 3: Update CI dependency installation**

CI should install with uv and run the deterministic test/lint suite. It must not perform network-heavy full training.

- [ ] **Step 4: Verify all required checks locally where available**

Run:

```bash
cd ml
uv sync --all-extras
uv run ruff check src tests jobs --select E9,F
uv run pytest -q
```

Then, when Docker is available:

```bash
docker build -t expense-tracker-space -f Dockerfile ..
```

- [ ] **Step 5: Push and inspect GitHub Actions results**

Confirm the ML Validation run checks out the latest commit, completes dependency installation, Ruff, and pytest successfully. Do not claim the automated training workflow is production-ready until the Docker startup contract and repository CI are green.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ml-validation.yml ml/tests/test_end_to_end_contract.py
git commit -m "ci(ml): verify continuous-learning contracts in CI"
```
