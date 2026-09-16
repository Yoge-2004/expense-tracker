import pandas as pd

from expense_ml.evaluate import evaluate_model


class StubModel:
    def predict(self, texts):
        from expense_ml.models.tfidf import PredictionBatch
        return PredictionBatch(["food", "transport"], [0.9, 0.8], [[("food", .9)], [("transport", .8)]])


def test_evaluate_model_returns_core_metrics():
    frame = pd.DataFrame({"text": ["a", "b"], "label": ["food", "transport"]})
    result = evaluate_model(StubModel(), frame, "stub")
    assert result.accuracy == 1.0
    assert result.macro_f1 == 1.0
    assert result.samples == 2
