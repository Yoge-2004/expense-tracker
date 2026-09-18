from pathlib import Path
import tomllib


def test_ml_project_declares_python_314_and_separate_dependency_groups():
    root = Path(__file__).parents[1]
    data = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
    assert data["project"]["requires-python"] == ">=3.14,<3.15"
    assert (root / ".python-version").read_text(encoding="utf-8").strip() == "3.14"
    optional = data["project"]["optional-dependencies"]
    assert {"train", "serve", "dev"} <= set(optional)
    assert any(dep.startswith("torch>=") for dep in optional["train"])
    assert any(dep.startswith("transformers>=") for dep in optional["train"])
    assert any(dep.startswith("fastapi>=") for dep in optional["serve"])
    assert any(dep.startswith("uvicorn[standard]>=") for dep in optional["serve"])
    assert any(dep.startswith("huggingface-hub>=") for dep in optional["serve"])
