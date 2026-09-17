import pandas as pd

from expense_ml.config import TrainingConfig
from expense_ml.evaluate import EvaluationResult
from expense_ml.master_pipeline import train_all


def test_master_manifest_has_pipeline_version(tmp_path, monkeypatch):
    class DummyModel:
        def save(self, path):
            path.mkdir(parents=True, exist_ok=True)

        def predict(self, texts):
            return type(
                "Predictions",
                (),
                {"labels": ["food_dining"] * len(texts), "confidence": [0.99] * len(texts)},
            )()

    monkeypatch.setattr("expense_ml.master_pipeline.train_tfidf", lambda train, cfg: DummyModel())
    monkeypatch.setattr(
        "expense_ml.master_pipeline.evaluate_model",
        lambda model, frame, name, **kwargs: EvaluationResult(
            model_name=name,
            accuracy=1.0,
            macro_f1=1.0,
            weighted_f1=1.0,
            report={"food_dining": {"precision": 1.0, "recall": 1.0, "f1-score": 1.0}},
            confusion_matrix=[[len(frame)]],
            samples=len(frame),
            confidence_threshold=0.7,
            confidence_coverage=1.0,
            high_confidence_accuracy=1.0,
        ),
    )
    monkeypatch.setattr("expense_ml.master_pipeline.save_result", lambda *args, **kwargs: None)
    monkeypatch.setattr("expense_ml.master_pipeline.save_classification_figures", lambda *args, **kwargs: None)
    monkeypatch.setattr("expense_ml.master_pipeline.save_dataset_figures", lambda *args, **kwargs: None)
    monkeypatch.setattr("expense_ml.master_pipeline.save_model_comparison", lambda *args, **kwargs: None)
    monkeypatch.setattr("expense_ml.master_pipeline.write_master_report", lambda *args, **kwargs: None)

    frame = pd.DataFrame(
        [
            {"text": f"food transaction {i}", "label": "food_dining"}
            for i in range(40)
        ]
        + [
            {"text": f"transport transaction {i}", "label": "transportation"}
            for i in range(40)
        ]
    )
    manifest = train_all(
        frame,
        TrainingConfig(
            test_size=0.2,
            validation_size=0.2,
            minimum_accuracy=0.0,
            minimum_macro_f1=0.0,
            minimum_country_macro_f1=0.0,
            minimum_india_macro_f1=0.0,
            minimum_confidence_coverage=0.0,
            minimum_high_confidence_accuracy=0.0,
            max_merchants=20,
            duplicate_max_rows=20,
        ),
        tmp_path,
        include_transformer=False,
    )
    assert manifest["pipeline_version"] == "2.0.0"
    assert manifest["status"] == "completed"
    assert manifest["selected_model"]["name"] == "tfidf"
    assert manifest["selected_model"]["test_accuracy"] == 1.0
