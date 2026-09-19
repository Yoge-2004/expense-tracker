from expense_ml.training.promotion import evaluate_candidate


def test_candidate_is_rejected_when_test_macro_f1_is_below_gate():
    decision = evaluate_candidate(
        candidate={"test_accuracy": 0.95, "test_macro_f1": 0.88},
        current={"test_accuracy": 0.94, "test_macro_f1": 0.87},
        minimum_accuracy=0.90,
        minimum_macro_f1=0.90,
    )
    assert decision.promote is False
    assert "macro_f1" in decision.reason


def test_candidate_can_promote_only_after_beating_required_thresholds():
    decision = evaluate_candidate(
        candidate={"test_accuracy": 0.96, "test_macro_f1": 0.92},
        current={"test_accuracy": 0.95, "test_macro_f1": 0.91},
        minimum_accuracy=0.90,
        minimum_macro_f1=0.90,
    )
    assert decision.promote is True
