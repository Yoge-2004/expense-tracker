import pandas as pd

from expense_ml.evaluate import evaluate_model


class StubModel:
    def __init__(self):
        self.calls = []

    def predict(self, texts):
        from expense_ml.models.tfidf import PredictionBatch
        self.calls.append(len(texts))
        labels = ["food" if x == "a" else "transport" for x in texts]
        confidence = [0.9] * len(labels)
        top_k = [[(label, 0.9)] for label in labels]
        return PredictionBatch(labels, confidence, top_k)


def test_evaluate_model_returns_core_metrics():
    frame = pd.DataFrame({"text": ["a", "b"], "label": ["food", "transport"]})
    result = evaluate_model(StubModel(), frame, "stub")
    assert result.accuracy == 1.0
    assert result.macro_f1 == 1.0
    assert result.samples == 2


def test_evaluate_model_predicts_in_memory_bounded_batches():
    frame = pd.DataFrame({"text": ["a", "b"] * 2_100, "label": ["food", "transport"] * 2_100})
    model = StubModel()
    result = evaluate_model(model, frame, "stub", batch_size=1024)
    assert result.accuracy == 1.0
    assert max(model.calls) <= 1024
    assert len(model.calls) > 1
