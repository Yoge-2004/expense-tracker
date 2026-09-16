from __future__ import annotations

import argparse
from pathlib import Path
import json

import yaml

from .config import TrainingConfig
from .data.prepare import load_configured_datasets, save_prepared
from .data.split import split_dataset
from .evaluate import compare_models, evaluate_model, save_result
from .train_baseline import train_tfidf


def _config(path: Path) -> TrainingConfig:
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    cfg = TrainingConfig.from_mapping(raw.get("training", {}))
    datasets = (yaml.safe_load(path.read_text(encoding="utf-8")) or {}).get("datasets", [])
    return TrainingConfig.from_env(TrainingConfig.from_mapping({**cfg.__dict__, "datasets": datasets}))


def main() -> None:
    parser = argparse.ArgumentParser(description="Expense Tracker ML training pipeline")
    sub = parser.add_subparsers(dest="command", required=True)
    prep = sub.add_parser("prepare")
    prep.add_argument("--config", type=Path, default=Path("config/datasets.yaml"))
    prep.add_argument("--output", type=Path, default=Path("data/prepared/transactions.parquet"))
    train = sub.add_parser("train")
    train.add_argument("--config", type=Path, default=Path("config/datasets.yaml"))
    train.add_argument("--model", choices=["tfidf", "transformer", "both"], default="both")
    args = parser.parse_args()

    if args.command == "prepare":
        cfg = _config(args.config)
        frame = load_configured_datasets(cfg.datasets, cfg.data_dir)
        print(json.dumps(save_prepared(frame, args.output), indent=2))
        return

    cfg = _config(args.config)
    prepared = cfg.data_dir / "prepared/transactions.parquet"
    frame = __import__("pandas").read_parquet(prepared)
    splits = split_dataset(frame, cfg.seed, cfg.test_size, cfg.validation_size)
    results = []
    if args.model in {"tfidf", "both"}:
        model = train_tfidf(splits.train, cfg)
        results.append(evaluate_model(model, splits.test, "tfidf"))
        if len(splits.india_holdout):
            save_result(evaluate_model(model, splits.india_holdout, "tfidf-india"), cfg.artifacts_dir / "tfidf-india.json")
    if args.model in {"transformer", "both"}:
        from .train_transformer import train_transformer
        model = train_transformer(splits.train, splits.validation, cfg)
        results.append(evaluate_model(model, splits.test, "transformer"))
        if len(splits.india_holdout):
            save_result(evaluate_model(model, splits.india_holdout, "transformer-india"), cfg.artifacts_dir / "transformer-india.json")
    comparison = compare_models(results)
    (cfg.artifacts_dir / "comparison.json").write_text(json.dumps(comparison, indent=2), encoding="utf-8")
    print(json.dumps(comparison, indent=2))


if __name__ == "__main__":
    main()
