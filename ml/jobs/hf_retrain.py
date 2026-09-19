# /// script
# requires-python = ">=3.14,<3.15"
# dependencies = []
#
# [tool.hf-jobs]
# name = "expense-tracker-ml-retrain"
# flavor = "a10g-large"
# timeout = "8h"
# secrets = ["HF_TOKEN", "EXPENSE_ML_FEEDBACK_TOKEN"]
# env = { EXPENSE_ML_SCHEDULED = "1", HF_MODEL_REPO = "Yoge-2004/expense-intelligence-model", HF_SPACE_REPO = "Yoge-2004/expense-tracker-backend", HF_SPACE_URL = "https://yoge-2004-expense-tracker-backend.hf.space", EXPENSE_ML_FEEDBACK_URL = "https://yoge-2004-expense-tracker-backend.hf.space" }
# ///

"""Stable Hugging Face Job wrapper that always trains the current repository revision."""

from __future__ import annotations

from pathlib import Path
import os
import shutil
import subprocess
import tempfile
import urllib.request
import zipfile


REPOSITORY = "Yoge-2004/expense-tracker"
BRANCH = "main"
ARCHIVE_URL = f"https://github.com/{REPOSITORY}/archive/refs/heads/{BRANCH}.zip"


def main() -> None:
    workspace = Path(tempfile.mkdtemp(prefix="expense-tracker-ml-", dir="/data"))
    archive = workspace / "repo.zip"
    checkout = workspace / "repo"
    try:
        urllib.request.urlretrieve(ARCHIVE_URL, archive)
        with zipfile.ZipFile(archive) as archive_file:
            archive_file.extractall(workspace)
        extracted = next(workspace.glob("expense-tracker-*"))
        extracted.rename(checkout)

        ml = checkout / "ml"
        if not (ml / "pyproject.toml").exists():
            raise RuntimeError("Downloaded repository does not contain ml/pyproject.toml")

        env = os.environ.copy()
        env["EXPENSE_ML_CONFIG"] = str(ml / "config" / "datasets.yaml")
        env["EXPENSE_ML_PREPARED"] = str(Path("/data") / "expense-ml-data" / "transactions.parquet")
        env["EXPENSE_ML_OUTPUT"] = str(Path("/data") / "expense-ml-runs")

        subprocess.run(
            ["uv", "sync", "--directory", str(ml), "--extra", "train", "--no-dev"],
            check=True,
            env=env,
        )
        subprocess.run(
            [
                "uv",
                "run",
                "--directory",
                str(ml),
                "--extra",
                "train",
                "python",
                "jobs/retrain.py",
            ],
            check=True,
            env=env,
        )
    finally:
        shutil.rmtree(workspace, ignore_errors=True)


if __name__ == "__main__":
    main()
