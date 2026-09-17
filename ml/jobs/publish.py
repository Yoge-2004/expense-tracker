from __future__ import annotations

from pathlib import Path


def publish_candidate(
    candidate_dir: Path,
    *,
    repo_id: str,
    revision: str,
    token: str,
    private: bool = True,
) -> dict:
    """Publish a validated candidate to an immutable version branch on the Hub."""
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
    try:
        api.create_branch(repo_id=repo_id, repo_type="model", branch=revision, revision="main")
    except Exception as exc:
        # A concurrent/retried automation run may have already created the branch.
        if "already exists" not in str(exc).lower():
            raise

    api.upload_folder(
        repo_id=repo_id,
        repo_type="model",
        folder_path=str(model_dir),
        revision=revision,
        commit_message=f"Publish Expense Tracker candidate {revision}",
    )
    manifest = candidate_dir / "manifest.json"
    if manifest.exists():
        api.upload_file(
            path_or_fileobj=str(manifest),
            path_in_repo="manifest.json",
            repo_id=repo_id,
            repo_type="model",
            revision=revision,
            commit_message=f"Publish candidate metadata {revision}",
        )
    return {
        "repo_id": repo_id,
        "revision": revision,
        "model_ref": f"hf://{repo_id}@{revision}",
    }
