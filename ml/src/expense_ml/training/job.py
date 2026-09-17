from __future__ import annotations

from pathlib import Path

from ..master_pipeline import _run_id, load_input, train_all


def run_training_job(
    config_path: Path,
    prepared_path: Path,
    output_path: Path,
    *,
    include_transformer: bool = True,
) -> dict:
    """Run the master training pipeline with explicit filesystem paths."""
    config_path = Path(config_path)
    prepared_path = Path(prepared_path)
    output_path = Path(output_path)

    frame, _, dataset_manifest = load_input(config_path, prepared_path)
    run_dir = output_path / _run_id()
    manifest = train_all(
        frame,
        _load_config(config_path),
        run_dir,
        include_transformer=include_transformer,
        dataset_manifest=dataset_manifest,
    )
    manifest["run_directory"] = str(run_dir)
    return manifest


def _load_config(config_path: Path):
    """Load the same effective TrainingConfig used by the master pipeline."""
    import yaml
    from ..config import TrainingConfig

    raw = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    values = raw.get("training", {})
    datasets = raw.get("datasets", [])
    config = TrainingConfig.from_mapping(values)
    return TrainingConfig.from_env(
        TrainingConfig.from_mapping({**config.__dict__, "datasets": datasets})
    )
