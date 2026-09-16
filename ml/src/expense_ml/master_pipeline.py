from __future__ import annotations

import argparse
from dataclasses import asdict, replace
from datetime import datetime, timezone
from pathlib import Path
import json
import platform
import sys

import pandas as pd
from tqdm.auto import tqdm

from .config import TrainingConfig
from .data.prepare import load_configured_datasets, save_prepared
from .data.split import split_dataset
from .evaluate import evaluate_model, save_result
from .models.auxiliary import (
    DuplicateSimilarityModel,
    MerchantSimilarityIndex,
    SpendingForecastModel,
    TransactionAnomalyModel,
)
from .reporting import (
    save_anomaly_figure,
    save_classification_figures,
    save_data_quality,
    save_dataset_figures,
    save_model_comparison,
    save_spending_forecast,
    write_json,
    write_master_report,
)
from .resources import configure_resources
from .train_baseline import train_tfidf


PIPELINE_VERSION = "1.1.0"


def _run_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _text_frame(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    if "text" not in out or "label" not in out:
        raise ValueError("Prepared data must contain text and label columns.")
    out["text"] = out["text"].fillna("").astype(str)
    out["label"] = out["label"].fillna("").astype(str)
    return out[(out["text"].str.strip() != "") & (out["label"].str.strip() != "")].reset_index(drop=True)


def _stage(bar, name: str):
    bar.set_description(name)
    bar.refresh()


def train_all(frame: pd.DataFrame, cfg: TrainingConfig, run_dir: Path, include_transformer: bool = True) -> dict:
    run_dir.mkdir(parents=True, exist_ok=True)
    plots_dir = run_dir / "reports" / "figures"
    models_dir = run_dir / "models"
    run_cfg = replace(cfg, artifacts_dir=models_dir, model_dir=models_dir / "category-transformer")
    resources = configure_resources(cfg.cpu_threads, torch_threads=cfg.torch_threads)
    results = []
    manifest = {
        "run_id": run_dir.name,
        "pipeline_version": PIPELINE_VERSION,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "python": sys.version,
        "platform": platform.platform(),
        "seed": cfg.seed,
        "resources": resources,
        "models": {},
    }

    frame = _text_frame(frame)
    write_json({"rows": len(frame), "classes": int(frame["label"].nunique())}, run_dir / "reports" / "dataset_summary.json")

    stages = ["dataset-validation", "split", "tfidf", "transformer", "merchant", "duplicates", "anomaly", "forecast", "reports"]
    with tqdm(total=len(stages), unit="stage", desc="ML pipeline", disable=not cfg.progress) as bar:
        _stage(bar, "Dataset validation")
        save_dataset_figures(frame, plots_dir)
        write_json(save_data_quality(frame, plots_dir), run_dir / "reports" / "dataset_quality.json")
        bar.update(1)

        _stage(bar, "Leakage-safe split")
        splits = split_dataset(frame, cfg.seed, cfg.test_size, cfg.validation_size)
        write_json(
            {
                "train_rows": len(splits.train),
                "validation_rows": len(splits.validation),
                "test_rows": len(splits.test),
                "india_holdout_rows": len(splits.india_holdout),
            },
            run_dir / "reports" / "split_summary.json",
        )
        bar.update(1)

        _stage(bar, "TF-IDF + Logistic Regression")
        tfidf = train_tfidf(splits.train, run_cfg)
        tfidf_result = evaluate_model(tfidf, splits.test, "tfidf", batch_size=cfg.eval_batch_size, progress=cfg.progress)
        save_result(tfidf_result, run_dir / "reports" / "tfidf_test.json")
        save_classification_figures(tfidf_result, plots_dir, "TFIDF")
        results.append(asdict(tfidf_result))
        manifest["models"]["category_tfidf"] = {"status": "trained", "artifact": "models/category-tfidf"}
        if len(splits.india_holdout):
            india_result = evaluate_model(tfidf, splits.india_holdout, "tfidf-india", batch_size=cfg.eval_batch_size, progress=cfg.progress)
            save_result(india_result, run_dir / "reports" / "tfidf_india_test.json")
        bar.update(1)

        _stage(bar, "Transformer classifier")
        if include_transformer:
            try:
                from .train_transformer import train_transformer
                transformer = train_transformer(splits.train, splits.validation, run_cfg)
                transformer_result = evaluate_model(transformer, splits.test, "transformer", batch_size=cfg.eval_batch_size, progress=cfg.progress)
                save_result(transformer_result, run_dir / "reports" / "transformer_test.json")
                save_classification_figures(transformer_result, plots_dir, "Transformer")
                results.append(asdict(transformer_result))
                if len(splits.india_holdout):
                    india_result = evaluate_model(transformer, splits.india_holdout, "transformer-india", batch_size=cfg.eval_batch_size, progress=cfg.progress)
                    save_result(india_result, run_dir / "reports" / "transformer_india_test.json")
                manifest["models"]["category_transformer"] = {"status": "trained", "artifact": "models/category-transformer"}
            except Exception as exc:
                manifest["models"]["category_transformer"] = {"status": "skipped", "reason": str(exc)}
        else:
            manifest["models"]["category_transformer"] = {"status": "disabled"}
        bar.update(1)

        _stage(bar, "Merchant similarity")
        try:
            merchant = MerchantSimilarityIndex.fit(frame["text"].tolist(), max_merchants=cfg.max_merchants)
            merchant.save(models_dir / "merchant-similarity")
            write_json({"unique_merchants": len(merchant.merchants), "cap": cfg.max_merchants}, run_dir / "reports" / "merchant_index.json")
            manifest["models"]["merchant_similarity"] = {"status": "trained", "artifact": "models/merchant-similarity"}
        except Exception as exc:
            manifest["models"]["merchant_similarity"] = {"status": "skipped", "reason": str(exc)}
        bar.update(1)

        _stage(bar, "Duplicate similarity")
        try:
            duplicate = DuplicateSimilarityModel.fit(frame["text"].tolist(), max_rows=cfg.duplicate_max_rows)
            pairs = duplicate.duplicate_pairs()
            duplicate.save(models_dir / "duplicate-similarity")
            write_json({"indexed_rows": min(len(frame), cfg.duplicate_max_rows), "candidate_pairs": len(pairs), "threshold": 0.92, "examples": pairs[:1000]}, run_dir / "reports" / "duplicate_candidates.json")
            manifest["models"]["duplicate_similarity"] = {"status": "trained", "artifact": "models/duplicate-similarity"}
        except Exception as exc:
            manifest["models"]["duplicate_similarity"] = {"status": "skipped", "reason": str(exc)}
        bar.update(1)

        _stage(bar, "Transaction anomaly detection")
        try:
            anomaly, scored = TransactionAnomalyModel.fit(frame, run_cfg.seed)
            anomaly.save(models_dir / "transaction-anomaly")
            save_anomaly_figure(scored["anomaly_score"].to_numpy(), plots_dir)
            write_json({"rows": len(scored), "anomalies": int(scored["is_anomaly"].sum()), "anomaly_rate": float(scored["is_anomaly"].mean()), "features": anomaly.feature_columns}, run_dir / "reports" / "anomaly_report.json")
            manifest["models"]["transaction_anomaly"] = {"status": "trained", "artifact": "models/transaction-anomaly"}
        except Exception as exc:
            manifest["models"]["transaction_anomaly"] = {"status": "skipped", "reason": str(exc)}
        bar.update(1)

        _stage(bar, "Spending forecast")
        try:
            forecaster, forecast = SpendingForecastModel.fit(frame, run_cfg.seed)
            forecaster.save(models_dir / "spending-forecast")
            write_json({"mae": forecast.mae, "rmse": forecast.rmse, "r2": forecast.r2, "holdout_days": len(forecast.actual)}, run_dir / "reports" / "spending_forecast.json")
            save_spending_forecast(forecast.actual, forecast.predicted, plots_dir)
            manifest["models"]["spending_forecast"] = {"status": "trained", "artifact": "models/spending-forecast"}
        except Exception as exc:
            manifest["models"]["spending_forecast"] = {"status": "skipped", "reason": str(exc)}
        bar.update(1)

        _stage(bar, "Reports and export manifest")
        save_model_comparison(results, plots_dir)
        write_json({"models": results, "selection_metric": "macro_f1"}, run_dir / "reports" / "model_comparison.json")
        write_json(manifest, run_dir / "manifest.json")
        write_master_report(manifest, run_dir / "reports")
        bar.update(1)

    return manifest


def load_input(config_path: Path, prepared_path: Path) -> tuple[pd.DataFrame, TrainingConfig]:
    import yaml

    raw = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    cfg = TrainingConfig.from_mapping(raw.get("training", {}))
    datasets = raw.get("datasets", [])
    cfg = TrainingConfig.from_env(TrainingConfig.from_mapping({**cfg.__dict__, "datasets": datasets}))
    if prepared_path.exists():
        return pd.read_parquet(prepared_path), cfg
    frame = load_configured_datasets(cfg.datasets, cfg.data_dir, progress=cfg.progress, normalize_chunk_size=cfg.normalize_chunk_size)
    save_prepared(frame, prepared_path)
    return frame, cfg


def main() -> None:
    parser = argparse.ArgumentParser(description="Master offline training pipeline for Expense Tracker ML")
    parser.add_argument("--config", type=Path, default=Path("config/datasets.yaml"))
    parser.add_argument("--prepared", type=Path, default=Path("data/prepared/transactions.parquet"))
    parser.add_argument("--output", type=Path, default=Path("artifacts/master-runs"))
    parser.add_argument("--no-transformer", action="store_true")
    args = parser.parse_args()

    frame, cfg = load_input(args.config, args.prepared)
    run_dir = args.output / _run_id()
    manifest = train_all(frame, cfg, run_dir, include_transformer=not args.no_transformer)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
