import pandas as pd

from expense_ml.config import TrainingConfig
from expense_ml.evaluate import EvaluationResult
from expense_ml.master_pipeline import train_all


def test_master_manifest_has_pipeline_version(tmp_path, monkeypatch):
    class DummyModel:
        def save(self, path):
            path.mkdir(parents=True, exist_ok=True)

        def predict(self, texts):
            return type("Predictions", (), {"labels": ["Food"] * len(texts)})()

    monkeypatch.setattr("expense_ml.master_pipeline.train_tfidf", lambda train, cfg: DummyModel())
    monkeypatch.setattr(
        "expense_ml.master_pipeline.evaluate_model",
        lambda model, frame, name, **kwargs: EvaluationResult(
            model_name=name,
            accuracy=1.0,
            macro_f1=1.0,
            weighted_f1=1.0,
            report={"Food": {"precision": 1.0, "recall": 1.0, "f1-score": 1.0}},
            confusion_matrix=[[len(frame)]],
            samples=len(frame),
        ),
    )
    monkeypatch.setattr("expense_ml.master_pipeline.save_result", lambda *args, **kwargs: None)
    monkeypatch.setattr("expense_ml.master_pipeline.save_classification_figures", lambda *args, **kwargs: None)
    monkeypatch.setattr("expense_ml.master_pipeline.save_dataset_figures", lambda *args, **kwargs: None)
    monkeypatch.setattr("expense_ml.master_pipeline.save_model_comparison", lambda *args, **kwargs: None)

    frame = pd.DataFrame({"text": ["x"] * 12, "label": ["Food"] * 12})
    manifest = train_all(
        frame,
        TrainingConfig(test_size=.2, validation_size=.2),
        tmp_path,
        include_transformer=False,
    )
    assert manifest["pipeline_version"] == "1.1.0"
