import pytest

from expense_ml.config import TrainingConfig


def test_training_config_rejects_invalid_quality_thresholds():
    with pytest.raises(ValueError, match="minimum_macro_f1"):
        TrainingConfig(minimum_macro_f1=1.5)


def test_training_config_rejects_invalid_split_fractions():
    with pytest.raises(ValueError, match="test_size"):
        TrainingConfig(test_size=0.8, validation_size=0.3)
