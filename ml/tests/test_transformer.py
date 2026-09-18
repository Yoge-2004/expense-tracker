from types import SimpleNamespace

import torch

from expense_ml.models.transformer import TransformerCategoryModel


class DummyTokenizer:
    def __call__(self, values, **kwargs):
        return {
            "input_ids": torch.ones((len(values), 2), dtype=torch.long),
            "attention_mask": torch.ones((len(values), 2), dtype=torch.long),
        }


class DeviceCheckingModel(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.weight = torch.nn.Parameter(torch.zeros(1))

    def forward(self, **inputs):
        expected = self.weight.device
        assert all(value.device == expected for value in inputs.values())
        logits = torch.tensor([[3.0, 1.0]], device=expected).repeat(inputs["input_ids"].shape[0], 1)
        return SimpleNamespace(logits=logits)


def test_transformer_predict_moves_inputs_to_model_device():
    model = TransformerCategoryModel(
        DeviceCheckingModel(),
        DummyTokenizer(),
        ["food_dining", "transportation"],
    )
    prediction = model.predict(["uber ride"])
    assert prediction.labels == ["food_dining"]
    assert prediction.confidence[0] > 0.5
