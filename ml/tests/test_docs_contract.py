from pathlib import Path


def test_docs_describe_uv_training_automation_model_revision_and_rollback():
    root = Path(__file__).parents[1]
    docs = (root / "README.md").read_text(encoding="utf-8")
    assert "uv sync" in docs
    assert "MODEL_REVISION" in docs
    assert "Hugging Face" in docs
    assert "rollback" in docs.lower()
