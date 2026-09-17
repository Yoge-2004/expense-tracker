from __future__ import annotations

from pathlib import Path
import json
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def publish_candidate(
    candidate_dir: Path,
    *,
    repo_id: str,
    revision: str,
    token: str,
    private: bool = True,
    production_revision: str = "production",
    space_repo_id: str | None = None,
    space_url: str | None = None,
    model_type: str | None = None,
) -> dict:
    """Publish a versioned candidate, advance production, and restart the Space."""
    if not candidate_dir.exists():
        raise FileNotFoundError(f"Candidate directory does not exist: {candidate_dir}")
    model_dir = candidate_dir / "model"
    if not model_dir.exists():
        raise FileNotFoundError(f"Candidate model directory does not exist: {model_dir}")
    if not token.strip():
        raise ValueError("Hugging Face token must be non-empty")

    from huggingface_hub import HfApi

    api = HfApi(token=token)
    api.create_repo(repo_id=repo_id, repo_type="model", private=private, exist_ok=True)

    for target_revision in (revision, production_revision):
        api.create_branch(
            repo_id=repo_id,
            repo_type="model",
            branch=target_revision,
            revision="main",
            exist_ok=True,
        )

    api.upload_folder(
        repo_id=repo_id,
        repo_type="model",
        folder_path=str(model_dir),
        revision=revision,
        commit_message=f"Publish Expense Tracker candidate {revision}",
    )
    for filename in ("manifest.json", "metrics.json", "promotion.json"):
        path = candidate_dir / filename
        if path.exists():
            api.upload_file(
                path_or_fileobj=str(path),
                path_in_repo=filename,
                repo_id=repo_id,
                repo_type="model",
                revision=revision,
                commit_message=f"Publish candidate metadata {filename}",
            )

    api.upload_folder(
        repo_id=repo_id,
        repo_type="model",
        folder_path=str(model_dir),
        revision=production_revision,
        commit_message=f"Promote Expense Tracker candidate {revision} to {production_revision}",
    )
    for filename in ("manifest.json", "metrics.json"):
        path = candidate_dir / filename
        if path.exists():
            api.upload_file(
                path_or_fileobj=str(path),
                path_in_repo=filename,
                repo_id=repo_id,
                repo_type="model",
                revision=production_revision,
                commit_message=f"Promote candidate metadata {filename} to {production_revision}",
            )

    restarted = False
    if space_repo_id:
        values = api.get_space_variables(repo_id=space_repo_id)
        desired = {
            "MODEL_ID": repo_id,
            "MODEL_REVISION": production_revision,
        }
        if model_type:
            desired["MODEL_TYPE"] = model_type
        for key, value in desired.items():
            existing = values.get(key)
            if existing is None or str(existing.value) != value:
                api.add_space_variable(repo_id=space_repo_id, key=key, value=value)
        api.restart_space(repo_id=space_repo_id, token=token)
        restarted = True

    return {
        "repo_id": repo_id,
        "revision": revision,
        "production_revision": production_revision,
        "model_ref": f"hf://{repo_id}@{production_revision}",
        "space_repo_id": space_repo_id,
        "space_url": space_url,
        "space_restarted": restarted,
    }


def wait_for_space_revision(
    space_url: str,
    expected_revision: str,
    *,
    timeout_seconds: int = 600,
    interval_seconds: int = 10,
) -> dict:
    """Wait for the serving Space health endpoint to report the expected model revision."""
    if not space_url.strip():
        raise ValueError("space_url must be non-empty")
    if timeout_seconds < 1 or interval_seconds < 1:
        raise ValueError("timeout_seconds and interval_seconds must be >= 1")

    health_url = f"{space_url.rstrip('/')}/health"
    deadline = time.monotonic() + timeout_seconds
    last_error = "space did not become ready"
    while time.monotonic() < deadline:
        request = Request(health_url, headers={"Accept": "application/json"}, method="GET")
        try:
            with urlopen(request, timeout=min(30, interval_seconds + 10)) as response:
                if response.status == 200:
                    payload = json.loads(response.read().decode("utf-8"))
                    model = payload.get("model", {}) if isinstance(payload, dict) else {}
                    if payload.get("status") == "ok" and model.get("revision") == expected_revision:
                        return payload
                    last_error = f"unexpected health payload: {payload}"
                else:
                    last_error = f"health HTTP {response.status}"
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = f"{type(exc).__name__}: {exc}"
        time.sleep(interval_seconds)
    raise RuntimeError(f"Space did not reach revision '{expected_revision}' within timeout: {last_error}")
