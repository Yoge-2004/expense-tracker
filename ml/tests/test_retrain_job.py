from expense_ml.jobs.retrain import should_retrain


def test_retrain_waits_until_feedback_threshold_or_force():
    assert should_retrain(new_feedback_count=499, threshold=500, scheduled=True) is False
    assert should_retrain(new_feedback_count=500, threshold=500, scheduled=True) is True
    assert should_retrain(new_feedback_count=1, threshold=500, scheduled=False) is False
    assert should_retrain(new_feedback_count=1, threshold=500, scheduled=False, force=True) is True
