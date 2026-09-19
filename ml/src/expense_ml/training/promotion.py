from __future__ import annotations

from dataclasses import dataclass, asdict
import json
from pathlib import Path


@dataclass(frozen=True)
class PromotionDecision:
    promote: bool
    reason: str
    checks: dict[str, bool]

    def to_dict(self) -> dict:
        return asdict(self)


def evaluate_candidate(
    candidate: dict,
    current: dict | None,
    *,
    minimum_accuracy: float,
    minimum_macro_f1: float,
) -> PromotionDecision:
    """Apply non-regression and absolute quality gates to a candidate model."""
    candidate_accuracy = float(candidate.get("test_accuracy", 0.0))
    candidate_macro_f1 = float(candidate.get("test_macro_f1", 0.0))
    checks = {
        "minimum_accuracy": candidate_accuracy >= minimum_accuracy,
        "minimum_macro_f1": candidate_macro_f1 >= minimum_macro_f1,
    }
    if current is not None:
        current_accuracy = float(current.get("test_accuracy", 0.0))
        current_macro_f1 = float(current.get("test_macro_f1", 0.0))
        checks["non_regression_accuracy"] = candidate_accuracy >= current_accuracy
        checks["non_regression_macro_f1"] = candidate_macro_f1 >= current_macro_f1

    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        return PromotionDecision(False, "Promotion gates failed: " + ", ".join(failed), checks)
    return PromotionDecision(True, "Candidate passed all promotion gates", checks)


def write_promotion_decision(decision: PromotionDecision, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(decision.to_dict(), indent=2), encoding="utf-8")


def promote_candidate(
    candidate_dir: Path,
    production_dir: Path,
    *,
    decision: PromotionDecision,
) -> Path | None:
    """Promote a validated candidate by creating a new immutable revision directory."""
    if not decision.promote:
        return None
    model_dir = candidate_dir / "model"
    if not model_dir.exists():
        raise ValueError(f"Candidate model directory does not exist: {model_dir}")

    production_dir.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((candidate_dir / "manifest.json").read_text(encoding="utf-8"))
    revision = str(manifest["model_revision"])
    target = production_dir / revision
    if target.exists():
        raise FileExistsError(f"Production model revision already exists: {target}")
    target.mkdir(parents=True)
    for source in model_dir.rglob("*"):
        relative = source.relative_to(model_dir)
        destination = target / relative
        if source.is_dir():
            destination.mkdir(parents=True, exist_ok=True)
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(source.read_bytes())
    return target
