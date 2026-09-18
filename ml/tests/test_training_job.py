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
