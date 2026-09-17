from __future__ import annotations

import json
from collections.abc import Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .schema import FeedbackRecord
from .validation import eligible_feedback


class FeedbackClientError(RuntimeError):
    """Raised when the Spring Boot feedback endpoint cannot be consumed safely."""


def _request_json(
    url: str,
    token: str,
    *,
    method: str = "GET",
    payload: object | None = None,
    timeout: float = 30.0,
) -> object:
    body = None
    headers = {
        "Accept": "application/json",
        "X-ML-Training-Token": token,
    }
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = Request(url, headers=headers, method=method, data=body)
    try:
        with urlopen(request, timeout=timeout) as response:
            raw = response.read()
    except HTTPError as exc:
        raise FeedbackClientError(f"Feedback endpoint returned HTTP {exc.code}") from exc
    except URLError as exc:
        raise FeedbackClientError("Feedback endpoint could not be reached") from exc

    if not raw:
        return {}
    try:
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise FeedbackClientError("Feedback endpoint returned invalid JSON") from exc


def count_training_feedback(
    base_url: str,
    token: str,
    *,
    timeout: float = 30.0,
) -> int:
    """Read the eligible-feedback count without downloading training rows."""
    if not base_url.strip() or not token.strip():
        raise ValueError("Feedback API base_url and token must be non-empty")
    payload = _request_json(
        f"{base_url.rstrip('/')}/api/internal/ml/feedback/count",
        token,
        timeout=timeout,
    )
    if not isinstance(payload, Mapping):
        raise FeedbackClientError("Feedback count response must be a JSON object")
    try:
        count = int(payload["eligibleCount"])
    except (KeyError, TypeError, ValueError) as exc:
        raise FeedbackClientError("Feedback count response has an invalid eligibleCount") from exc
    if count < 0:
        raise FeedbackClientError("Feedback count response cannot be negative")
    return count


def fetch_training_feedback(
    base_url: str,
    token: str,
    *,
    after_cursor: str | None = None,
    limit: int = 1000,
    timeout: float = 30.0,
) -> tuple[list[FeedbackRecord], str | None]:
    """Fetch one validated page of training-eligible feedback from Spring Boot."""
    if not base_url.strip():
        raise ValueError("Feedback API base_url must be non-empty")
    if not token.strip():
        raise ValueError("Feedback API token must be non-empty")
    if not 1 <= limit <= 5000:
        raise ValueError("Feedback API limit must be between 1 and 5000")

    params = {"limit": str(limit)}
    if after_cursor:
        params["after"] = after_cursor
    separator = "&" if "?" in base_url else "?"
    url = f"{base_url.rstrip('/')}/api/internal/ml/feedback{separator}{urlencode(params)}"
    payload = _request_json(url, token, timeout=timeout)
    if not isinstance(payload, Mapping):
        raise FeedbackClientError("Feedback endpoint response must be a JSON object")
    raw_records = payload.get("records", [])
    if not isinstance(raw_records, list):
        raise FeedbackClientError("Feedback endpoint 'records' must be a JSON array")

    records = [FeedbackRecord.from_mapping(item) for item in raw_records]
    validated = eligible_feedback(records)
    next_cursor = payload.get("next_cursor")
    if next_cursor is not None:
        next_cursor = str(next_cursor)
    return validated, next_cursor


def mark_feedback_consumed(
    base_url: str,
    token: str,
    feedback_ids: list[str],
    *,
    timeout: float = 30.0,
) -> None:
    """Mark successfully published feedback as consumed by the training job."""
    if not feedback_ids:
        return
    payload = _request_json(
        f"{base_url.rstrip('/')}/api/internal/ml/feedback/consume",
        token,
        method="POST",
        payload={"feedback_ids": feedback_ids},
        timeout=timeout,
    )
    if not isinstance(payload, Mapping) or payload.get("status") != "ok":
        raise FeedbackClientError("Feedback endpoint did not acknowledge consumption")
