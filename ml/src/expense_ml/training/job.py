from __future__ import annotations

from pathlib import Path

from ..master_pipeline import _run_id, load_input, train_all
from ..reporting import write_json


def run_training_job(
    config_path: Path,
    prepared_path: Path,
    output_path: Path,
    *,
    include_transformer: bool = True,
    dataset_manifest: list[dict] | None = None,
) -> dict:
    """Run the master training pipeline with explicit filesystem paths."""
    config_path = Path(config_path)
    prepared_path = Path(prepared_path)
    output_path = Path(output_path)

    frame, config, resolved_manifest = load_input(config_path, prepared_path)
    run_dir = output_path / _run_id()
    manifest = train_all(
        frame,
        config,
        run_dir,
        include_transformer=include_transformer,
        dataset_manifest=dataset_manifest if dataset_manifest is not None else resolved_manifest,
    )
    manifest["run_directory"] = str(run_dir)
    write_json(manifest, run_dir / "manifest.json")
    return manifest
