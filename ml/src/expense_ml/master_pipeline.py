from __future__ import annotations

import argparse
from dataclasses import asdict, replace
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import platform
import sys

import pandas as pd
from tqdm.auto import tqdm

from .config import TrainingConfig
from .data.prepare import load_configured_datasets, save_prepared
from .data.sampling import balanced_training_sample
from .data.split import split_dataset
from .data.taxonomy import CANONICAL_CATEGORIES
from .evaluate import compare_models, evaluate_by_country, evaluate_model, save_result, validate_quality
from .models.auxiliary import DuplicateSimilarityModel, MerchantSimilarityIndex, SpendingForecastModel, TransactionAnomalyModel
from .reporting import save_anomaly_figure, save_classification_figures, save_data_quality, save_dataset_figures, save_model_comparison, save_spending_forecast, write_json, write_master_report
from .resources import configure_resources
from .train_baseline import train_tfidf

PIPELINE_VERSION = "2.0.0"


def _run_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _text_frame(frame: pd.DataFrame) -> pd.DataFrame:
    missing = {"text", "label"} - set(frame.columns)
    if missing:
        raise ValueError(f"Prepared data is missing required columns: {sorted(missing)}")
    out = frame.copy()
    out["text"] = out["text"].fillna("").astype(str)
    out["label"] = out["label"].fillna("").astype(str)
    out = out[(out["text"].str.strip() != "") & (out["label"].str.strip() != "")]
    if "source" not in out:
        out["source"] = "unknown"
    if "country" not in out:
        out["country"] = "unknown"
    out["source"] = out["source"].fillna("unknown").astype(str)
    out["country"] = out["country"].fillna("unknown").astype(str)
    return out.reset_index(drop=True)


def _frame_fingerprint(frame: pd.DataFrame) -> str:
    columns = [c for c in ("text", "label", "source", "country", "currency", "language") if c in frame]
    payload = frame.loc[:, columns].sort_values(columns).to_json(orient="records", force_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _stage(bar, name: str) -> None:
    bar.set_description(name)
    bar.refresh()


def _country_gate(country_metrics: dict[str, dict], minimum_macro_f1: float) -> None:
    failures = []
    for country, result in sorted(country_metrics.items()):
        score = float(result["macro_f1"])
        if score < minimum_macro_f1:
            failures.append(f"{country}: macro_f1={score:.4f} < {minimum_macro_f1:.4f}")
    if failures:
        raise ValueError("Country quality gate failed: " + "; ".join(failures))


def _read_fetch_manifest(prepared_path: Path) -> list[dict]:
    path = prepared_path.parent / "fetch_manifest.json"
    if not path.exists():
        return []
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid dataset fetch manifest: {path}") from exc
    if not isinstance(value, list):
        raise ValueError(f"Dataset fetch manifest must be a list: {path}")
    return value


def train_all(frame: pd.DataFrame, cfg: TrainingConfig, run_dir: Path, *, include_transformer: bool = True, dataset_manifest: list[dict] | None = None) -> dict:
    run_dir.mkdir(parents=True, exist_ok=True)
    plots_dir = run_dir / "reports" / "figures"
    models_dir = run_dir / "models"
    run_cfg = replace(cfg, artifacts_dir=models_dir, model_dir=models_dir / "category-transformer")
    resources = configure_resources(cfg.cpu_threads, torch_threads=cfg.torch_threads)

    manifest = {
        "status": "running",
        "run_id": run_dir.name,
        "pipeline_version": PIPELINE_VERSION,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "python": sys.version,
        "platform": platform.platform(),
        "seed": cfg.seed,
        "taxonomy_categories": list(CANONICAL_CATEGORIES),
        "resources": resources,
        "datasets": dataset_manifest or [],
        "models": {},
    }

    frame = _text_frame(frame)
    unexpected = sorted(set(frame["label"]) - set(CANONICAL_CATEGORIES))
    if unexpected:
        raise ValueError(f"Prepared data contains non-canonical labels: {unexpected}")

    write_json(
        {
            "rows": len(frame),
            "classes": int(frame["label"].nunique()),
            "fingerprint": _frame_fingerprint(frame),
            "class_counts": frame["label"].value_counts().to_dict(),
            "country_counts": frame["country"].value_counts().to_dict(),
            "source_counts": frame["source"].value_counts().to_dict(),
        },
        run_dir / "reports" / "dataset_summary.json",
    )

    stages = ["dataset-validation", "split", "tfidf", "transformer", "merchant", "duplicates", "anomaly", "forecast", "reports"]
    results = []
    country_metrics_by_model: dict[str, dict[str, dict]] = {}
    india_results: dict[str, object] = {}

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
                "train_fingerprint": _frame_fingerprint(splits.train),
                "validation_fingerprint": _frame_fingerprint(splits.validation),
                "test_fingerprint": _frame_fingerprint(splits.test),
                "india_holdout_fingerprint": _frame_fingerprint(splits.india_holdout),
            },
            run_dir / "reports" / "split_summary.json",
        )
        bar.update(1)

        train_sample = balanced_training_sample(splits.train, cfg.baseline_max_rows, cfg.seed)
        transformer_sample = balanced_training_sample(splits.train, cfg.transformer_max_rows, cfg.seed + 1)
        write_json(
            {
                "full_train_rows": len(splits.train),
                "baseline_rows": len(train_sample),
                "transformer_rows": len(transformer_sample),
                "baseline_country_counts": train_sample["country"].value_counts().to_dict(),
                "transformer_country_counts": transformer_sample["country"].value_counts().to_dict(),
                "baseline_class_counts": train_sample["label"].value_counts().to_dict(),
                "transformer_class_counts": transformer_sample["label"].value_counts().to_dict(),
            },
            run_dir / "reports" / "training_sampling.json",
        )

        _stage(bar, "TF-IDF + Logistic Regression")
        tfidf = train_tfidf(train_sample, run_cfg)
        tfidf_result = evaluate_model(
            tfidf,
            splits.test,
            "tfidf",
            batch_size=cfg.eval_batch_size,
            confidence_threshold=cfg.confidence_threshold,
            progress=cfg.progress,
        )
        save_result(tfidf_result, run_dir / "reports" / "tfidf_test.json")
        save_classification_figures(tfidf_result, plots_dir, "TFIDF")
        country_metrics_by_model["tfidf"] = evaluate_by_country(
            tfidf, splits.test, "tfidf", minimum_samples=cfg.minimum_country_samples,
            batch_size=cfg.eval_batch_size, confidence_threshold=cfg.confidence_threshold,
            progress=cfg.progress,
        )
        write_json(country_metrics_by_model["tfidf"], run_dir / "reports" / "tfidf_country_metrics.json")
        manifest["models"]["category_tfidf"] = {
            "status": "trained", "artifact": "models/category-tfidf",
            "test_macro_f1": tfidf_result.macro_f1, "test_accuracy": tfidf_result.accuracy,
        }
        if len(splits.india_holdout):
            india_results["tfidf"] = evaluate_model(
                tfidf, splits.india_holdout, "tfidf-india",
                batch_size=cfg.eval_batch_size, confidence_threshold=cfg.confidence_threshold,
                progress=cfg.progress,
            )
            save_result(india_results["tfidf"], run_dir / "reports" / "tfidf_india_test.json")
        results.append(tfidf_result)
        bar.update(1)

        _stage(bar, "Transformer classifier")
        if include_transformer:
            if splits.validation.empty:
                raise ValueError("Transformer training requires a non-empty validation split.")
            from .train_transformer import train_transformer
            transformer = train_transformer(transformer_sample, splits.validation, run_cfg)
            transformer_result = evaluate_model(
                transformer, splits.test, "transformer",
                batch_size=cfg.eval_batch_size, confidence_threshold=cfg.confidence_threshold,
                progress=cfg.progress,
            )
            save_result(transformer_result, run_dir / "reports" / "transformer_test.json")
            save_classification_figures(transformer_result, plots_dir, "Transformer")
            country_metrics_by_model["transformer"] = evaluate_by_country(
                transformer, splits.test, "transformer", minimum_samples=cfg.minimum_country_samples,
                batch_size=cfg.eval_batch_size, confidence_threshold=cfg.confidence_threshold,
                progress=cfg.progress,
            )
            write_json(country_metrics_by_model["transformer"], run_dir / "reports" / "transformer_country_metrics.json")
            manifest["models"]["category_transformer"] = {
                "status": "trained", "artifact": "models/category-transformer",
                "test_macro_f1": transformer_result.macro_f1, "test_accuracy": transformer_result.accuracy,
            }
            if len(splits.india_holdout):
                india_results["transformer"] = evaluate_model(
                    transformer, splits.india_holdout, "transformer-india",
                    batch_size=cfg.eval_batch_size, confidence_threshold=cfg.confidence_threshold,
                    progress=cfg.progress,
                )
                save_result(india_results["transformer"], run_dir / "reports" / "transformer_india_test.json")
            results.append(transformer_result)
        else:
            manifest["models"]["category_transformer"] = {"status": "disabled"}
        bar.update(1)

        _stage(bar, "Merchant similarity")
        merchant_sample = balanced_training_sample(frame, cfg.max_merchants, cfg.seed + 3)
        merchant = MerchantSimilarityIndex.fit(merchant_sample["text"].tolist(), max_merchants=cfg.max_merchants)
        merchant.save(models_dir / "merchant-similarity")
        manifest["models"]["merchant_similarity"] = {"status": "trained", "artifact": "models/merchant-similarity"}
        bar.update(1)

        _stage(bar, "Duplicate similarity")
        duplicate_sample = balanced_training_sample(frame, cfg.duplicate_max_rows, cfg.seed + 4)
        duplicate = DuplicateSimilarityModel.fit(duplicate_sample["text"].tolist(), max_rows=cfg.duplicate_max_rows)
        pairs = duplicate.duplicate_pairs()
        duplicate.save(models_dir / "duplicate-similarity")
        write_json(
            {"indexed_rows": len(duplicate_sample), "candidate_pairs": len(pairs), "threshold": 0.92, "examples": pairs[:1000]},
            run_dir / "reports" / "duplicate_candidates.json",
        )
        manifest["models"]["duplicate_similarity"] = {"status": "trained", "artifact": "models/duplicate-similarity"}
        bar.update(1)

        _stage(bar, "Transaction anomaly detection")
        if "amount" not in frame.columns:
            manifest["models"]["transaction_anomaly"] = {
                "status": "not_applicable",
                "reason": "No amount feature is present in the configured category datasets.",
            }
        else:
            anomaly, scored = TransactionAnomalyModel.fit(frame, run_cfg.seed)
            anomaly.save(models_dir / "transaction-anomaly")
            save_anomaly_figure(scored["anomaly_score"].to_numpy(), plots_dir)
            write_json(
                {"rows": len(scored), "anomalies": int(scored["is_anomaly"].sum()), "anomaly_rate": float(scored["is_anomaly"].mean()), "features": anomaly.feature_columns},
                run_dir / "reports" / "anomaly_report.json",
            )
            manifest["models"]["transaction_anomaly"] = {"status": "trained", "artifact": "models/transaction-anomaly"}
        bar.update(1)

        _stage(bar, "Spending forecast")
        date_columns = {"date", "transaction_date", "timestamp", "datetime"}
        amount_columns = {"amount", "value", "transaction_amount"}
        if not date_columns.intersection(frame.columns) or not amount_columns.intersection(frame.columns):
            manifest["models"]["spending_forecast"] = {
                "status": "not_applicable",
                "reason": "Category datasets do not provide transaction date and amount fields.",
            }
        else:
            forecaster, forecast = SpendingForecastModel.fit(frame, run_cfg.seed)
            forecaster.save(models_dir / "spending-forecast")
            write_json({"mae": forecast.mae, "rmse": forecast.rmse, "r2": forecast.r2, "holdout_days": len(forecast.actual)}, run_dir / "reports" / "spending_forecast.json")
            save_spending_forecast(forecast.actual, forecast.predicted, plots_dir)
            manifest["models"]["spending_forecast"] = {"status": "trained", "artifact": "models/spending-forecast"}
        bar.update(1)

        _stage(bar, "Reports and export manifest")
        comparison = compare_models(results)
        selected = comparison["selected"]
        if not selected:
            raise ValueError("No category model completed successfully.")
        selected_result = next(result for result in results if result.model_name == selected)

        validate_quality(
            selected_result,
            minimum_accuracy=cfg.minimum_accuracy,
            minimum_macro_f1=cfg.minimum_macro_f1,
            minimum_confidence_coverage=cfg.minimum_confidence_coverage,
            minimum_high_confidence_accuracy=cfg.minimum_high_confidence_accuracy,
        )
        _country_gate(country_metrics_by_model.get(selected, {}), cfg.minimum_country_macro_f1)
        selected_india = india_results.get(selected)
        if selected_india is not None:
            validate_quality(
                selected_india,
                minimum_accuracy=cfg.minimum_accuracy,
                minimum_macro_f1=cfg.minimum_india_macro_f1,
                minimum_confidence_coverage=cfg.minimum_confidence_coverage,
                minimum_high_confidence_accuracy=cfg.minimum_high_confidence_accuracy,
            )

        selected_key = "category_transformer" if selected == "transformer" else "category_tfidf"
        manifest["selected_model"] = {
            "name": selected,
            "artifact": manifest["models"][selected_key]["artifact"],
            "selection_metric": "macro_f1",
            "test_accuracy": selected_result.accuracy,
            "test_macro_f1": selected_result.macro_f1,
        }
        save_model_comparison([asdict(result) for result in results], plots_dir)
        comparison["quality_thresholds"] = {
            "minimum_accuracy": cfg.minimum_accuracy,
            "minimum_macro_f1": cfg.minimum_macro_f1,
            "minimum_country_macro_f1": cfg.minimum_country_macro_f1,
            "minimum_india_macro_f1": cfg.minimum_india_macro_f1,
            "minimum_confidence_coverage": cfg.minimum_confidence_coverage,
            "minimum_high_confidence_accuracy": cfg.minimum_high_confidence_accuracy,
        }
        comparison["accepted"] = True
        write_json(comparison, run_dir / "reports" / "model_comparison.json")
        write_json(manifest, run_dir / "manifest.json")
        write_master_report(manifest, run_dir / "reports")
        bar.update(1)

    manifest["status"] = "completed"
    write_json(manifest, run_dir / "manifest.json")
    return manifest


def load_input(config_path: Path, prepared_path: Path) -> tuple[pd.DataFrame, TrainingConfig, list[dict]]:
    import yaml
    raw = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    cfg = TrainingConfig.from_mapping(raw.get("training", {}))
    datasets = raw.get("datasets", [])
    cfg = TrainingConfig.from_env(TrainingConfig.from_mapping({**cfg.__dict__, "datasets": datasets}))
    if prepared_path.exists():
        return pd.read_parquet(prepared_path), cfg, _read_fetch_manifest(prepared_path)
    frame = load_configured_datasets(cfg.datasets, cfg.data_dir, progress=cfg.progress, normalize_chunk_size=cfg.normalize_chunk_size)
    save_prepared(frame, prepared_path)
    return frame, cfg, _read_fetch_manifest(prepared_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Master offline training pipeline for Expense Tracker ML")
    parser.add_argument("--config", type=Path, default=Path("config/datasets.yaml"))
    parser.add_argument("--prepared", type=Path, default=Path("data/prepared/transactions.parquet"))
    parser.add_argument("--output", type=Path, default=Path("artifacts/master-runs"))
    parser.add_argument("--no-transformer", action="store_true")
    args = parser.parse_args()

    frame, cfg, dataset_manifest = load_input(args.config, args.prepared)
    run_dir = args.output / _run_id()
    manifest = train_all(frame, cfg, run_dir, include_transformer=not args.no_transformer, dataset_manifest=dataset_manifest)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
