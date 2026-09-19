from __future__ import annotations

from pathlib import Path
import json
import os
import shutil

from expense_ml.feedback.client import (
    count_training_feedback,
    fetch_training_feedback,
    mark_feedback_consumed,
)
from expense_ml.training.candidate import build_candidate_manifest
from expense_ml.training.dataset import build_training_frame, training_data_fingerprint
from expense_ml.training.job import run_training_job
from expense_ml.training.promotion import evaluate_candidate, write_promotion_decision


def should_retrain(new_feedback_count: int, threshold: int, scheduled: bool, force: bool = False) -> bool:
    """Decide whether an automation run has enough new information."""
    if force:
        return True
    if new_feedback_count < 0 or threshold < 1:
        raise ValueError("new_feedback_count must be >= 0 and threshold must be >= 1")
    return scheduled and new_feedback_count >= threshold


def _load_current_metrics(repo_id: str, token: str, revision: str = "production") -> dict | None:
    from huggingface_hub import HfHubHTTPError, hf_hub_download

    try:
        path = hf_hub_download(
            repo_id=repo_id,
            repo_type="model",
            filename="metrics.json",
            revision=revision,
            token=token,
        )
    except HfHubHTTPError as exc:
        response = getattr(exc, "response", None)
        if response is not None and response.status_code == 404:
            return None
        raise
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _copy_selected_model(run_dir: Path, model_name: str, candidate_dir: Path) -> Path:
    source_name = "category-transformer" if model_name == "transformer" else "category-tfidf"
    source = run_dir / "models" / source_name
    if not source.exists():
        raise FileNotFoundError(f"Selected model artifact does not exist: {source}")
    target = candidate_dir / "model"
    shutil.copytree(source, target)
    return target


def run_automated_retraining() -> dict:
    """Run feedback-driven training and publish only passing candidates."""
    config = Path(os.getenv("EXPENSE_ML_CONFIG", "config/datasets.yaml"))
    prepared = Path(os.getenv("EXPENSE_ML_PREPARED", "data/prepared/transactions.parquet"))
    output = Path(os.getenv("EXPENSE_ML_OUTPUT", "artifacts/automation-runs"))
    feedback_url = os.getenv("EXPENSE_ML_FEEDBACK_URL", "")
    feedback_token = os.getenv("EXPENSE_ML_FEEDBACK_TOKEN", "")
    threshold = int(os.getenv("EXPENSE_ML_FEEDBACK_THRESHOLD", "500"))
    scheduled = os.getenv("EXPENSE_ML_SCHEDULED", "1") == "1"
    force = os.getenv("EXPENSE_ML_FORCE_RETRAIN", "0") == "1"
    if not feedback_url and not force:
        raise RuntimeError("EXPENSE_ML_FEEDBACK_URL is required for automated retraining")
    if not feedback_token and not force:
        raise RuntimeError("EXPENSE_ML_FEEDBACK_TOKEN is required for automated retraining")

    feedback_count = 0
    if feedback_url:
        feedback_count = count_training_feedback(feedback_url, feedback_token)

    if not should_retrain(feedback_count, threshold, scheduled, force=force):
        summary = {
            "status": "skipped",
            "reason": "insufficient_new_feedback",
            "feedback_count": feedback_count,
            "threshold": threshold,
        }
        output.mkdir(parents=True, exist_ok=True)
        (output / "latest-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
        return summary

    records = []
    cursor = None
    if feedback_url:
        while True:
            page, cursor = fetch_training_feedback(
                feedback_url,
                feedback_token,
                after_cursor=cursor,
            )
            records.extend(page)
            if not cursor:
                break

    from expense_ml.master_pipeline import load_input

    base_frame, config_object, dataset_manifest = load_input(config, prepared)
    training_frame = build_training_frame(base_frame, records)
    augmented = output / "working" / "augmented-training.parquet"
    augmented.parent.mkdir(parents=True, exist_ok=True)
    training_frame.to_parquet(augmented, index=False)

    manifest = run_training_job(
        config,
        augmented,
        output,
        include_transformer=os.getenv("EXPENSE_ML_NO_TRANSFORMER") != "1",
        dataset_manifest=dataset_manifest,
    )
    run_dir = Path(manifest["run_directory"])
    selected = manifest["selected_model"]["name"]
    revision = f"v{run_dir.name}"
    candidate_dir = run_dir / "candidate"
    _copy_selected_model(run_dir, selected, candidate_dir)

    candidate_metrics = {
        "model_name": selected,
        "test_accuracy": manifest["selected_model"]["test_accuracy"],
        "test_macro_f1": manifest["selected_model"]["test_macro_f1"],
    }
    repo_id = os.environ["HF_MODEL_REPO"]
    token = os.environ["HF_TOKEN"]
    current = _load_current_metrics(repo_id, token)
    decision = evaluate_candidate(
        candidate_metrics,
        current,
        minimum_accuracy=config_object.minimum_accuracy,
        minimum_macro_f1=config_object.minimum_macro_f1,
    )
    write_promotion_decision(decision, candidate_dir / "promotion.json")
    (candidate_dir / "metrics.json").write_text(
        json.dumps(candidate_metrics, indent=2), encoding="utf-8"
    )
    build_candidate_manifest(
        run_id=run_dir.name,
        training_data_fingerprint=training_data_fingerprint(training_frame),
        model_name=selected,
        model_revision=revision,
        validation_metrics=manifest["selected_model"],
        test_metrics=manifest["test_evaluation"],
        country_metrics=manifest["country_test_metrics"],
        india_holdout_metrics=manifest.get("india_holdout_evaluation"),
        artifact_directory=run_dir,
        project_root=Path(__file__).resolve().parents[1],
    )

    if not decision.promote:
        return {
            "status": "rejected",
            "run_directory": str(run_dir),
            "candidate_revision": revision,
            "decision": decision.to_dict(),
        }

    from publish import publish_candidate, wait_for_space_revision

    space_repo = os.getenv("HF_SPACE_REPO", "Yoge-2004/expense-tracker-backend")
    space_url = os.getenv(
        "HF_SPACE_URL", "https://yoge-2004-expense-tracker-backend.hf.space"
    )
    published = publish_candidate(
        candidate_dir,
        repo_id=repo_id,
        revision=revision,
        token=token,
        private=os.getenv("HF_MODEL_PRIVATE", "1") == "1",
        production_revision=os.getenv("HF_MODEL_PRODUCTION_REVISION", "production"),
        space_repo_id=space_repo,
        space_url=space_url,
        model_type=selected,
    )
    wait_for_space_revision(
        space_url,
        published["production_revision"],
        timeout_seconds=int(os.getenv("EXPENSE_ML_SPACE_HEALTH_TIMEOUT", "600")),
        interval_seconds=int(os.getenv("EXPENSE_ML_SPACE_HEALTH_INTERVAL", "10")),
    )
    mark_feedback_consumed(
        feedback_url,
        feedback_token,
        [record.feedback_id for record in records],
    )

    summary = {
        "status": "promoted",
        "run_directory": str(run_dir),
        "candidate_revision": revision,
        "published": published,
        "decision": decision.to_dict(),
        "feedback_consumed": len(records),
    }
    (run_dir / "candidate" / "promotion-summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )
    return summary


if __name__ == "__main__":
    print(json.dumps(run_automated_retraining(), indent=2))
