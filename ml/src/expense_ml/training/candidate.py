from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
import hashlib
import json
import platform
import subprocess
import sys


@dataclass(frozen=True)
class CandidateManifest:
    run_id: str
    training_data_fingerprint: str
    dependency_lock_hash: str
    git_commit: str
    python_version: str
    platform: str
    model_name: str
    model_revision: str
    validation_metrics: dict
    test_metrics: dict
    country_metrics: dict
    india_holdout_metrics: dict | None
    artifact_directory: str

    def to_dict(self) -> dict:
        return asdict(self)


def _git_commit() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], text=True, stderr=subprocess.STDOUT
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def _lock_hash(root: Path) -> str:
    path = root / "uv.lock"
    if not path.exists():
        return "unavailable"
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build_candidate_manifest(
    *,
    run_id: str,
    training_data_fingerprint: str,
    model_name: str,
    model_revision: str,
    validation_metrics: dict,
    test_metrics: dict,
    country_metrics: dict,
    india_holdout_metrics: dict | None,
    artifact_directory: Path,
    project_root: Path,
) -> CandidateManifest:
    manifest = CandidateManifest(
        run_id=run_id,
        training_data_fingerprint=training_data_fingerprint,
        dependency_lock_hash=_lock_hash(project_root),
        git_commit=_git_commit(),
        python_version=sys.version,
        platform=platform.platform(),
        model_name=model_name,
        model_revision=model_revision,
        validation_metrics=validation_metrics,
        test_metrics=test_metrics,
        country_metrics=country_metrics,
        india_holdout_metrics=india_holdout_metrics,
        artifact_directory=str(artifact_directory),
    )
    candidate_dir = artifact_directory / "candidate"
    candidate_dir.mkdir(parents=True, exist_ok=True)
    (candidate_dir / "manifest.json").write_text(
        json.dumps(manifest.to_dict(), indent=2, default=str), encoding="utf-8"
    )
    return manifest
