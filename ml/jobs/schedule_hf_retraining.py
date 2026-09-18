from __future__ import annotations

import os


SCRIPT_URL = (
    "https://raw.githubusercontent.com/Yoge-2004/expense-tracker/"
    "main/ml/jobs/hf_retrain.py"
)


def create_or_replace_schedule() -> object:
    """Create the unattended HF retraining schedule using encrypted secrets."""
    from huggingface_hub import create_scheduled_uv_job, list_scheduled_jobs

    token = os.environ["HF_TOKEN"]
    feedback_token = os.environ["EXPENSE_ML_FEEDBACK_TOKEN"]
    schedule = os.getenv("EXPENSE_ML_SCHEDULE", "0 2 * * *")
    name = os.getenv("EXPENSE_ML_SCHEDULE_NAME", "expense-tracker-ml-retrain")

    existing = list(list_scheduled_jobs(labels={"name": name}, token=token))
    for job in existing:
        job_id = getattr(job, "id", None) or getattr(job, "scheduled_job_id", None)
        if job_id:
            from huggingface_hub import delete_scheduled_job

            delete_scheduled_job(job_id, token=token)

    return create_scheduled_uv_job(
        SCRIPT_URL,
        schedule=schedule,
        name=name,
        flavor=os.getenv("EXPENSE_ML_JOB_FLAVOR", "a10g-large"),
        timeout=os.getenv("EXPENSE_ML_JOB_TIMEOUT", "8h"),
        concurrency=False,
        env={
            "EXPENSE_ML_REPO_REF": "main",
            "EXPENSE_ML_SCHEDULED": "1",
            "HF_MODEL_REPO": os.getenv(
                "HF_MODEL_REPO", "Yoge-2004/expense-intelligence-model"
            ),
            "HF_SPACE_REPO": os.getenv(
                "HF_SPACE_REPO", "Yoge-2004/expense-tracker-backend"
            ),
            "HF_SPACE_URL": os.getenv(
                "HF_SPACE_URL", "https://yoge-2004-expense-tracker-backend.hf.space"
            ),
            "EXPENSE_ML_FEEDBACK_URL": os.getenv(
                "EXPENSE_ML_FEEDBACK_URL",
                "https://yoge-2004-expense-tracker-backend.hf.space",
            ),
            "EXPENSE_ML_FEEDBACK_THRESHOLD": os.getenv(
                "EXPENSE_ML_FEEDBACK_THRESHOLD", "500"
            ),
        },
        secrets={
            "HF_TOKEN": token,
            "EXPENSE_ML_FEEDBACK_TOKEN": feedback_token,
        },
        token=token,
    )


if __name__ == "__main__":
    job = create_or_replace_schedule()
    print("Scheduled ML retraining job:", getattr(job, "id", job))
