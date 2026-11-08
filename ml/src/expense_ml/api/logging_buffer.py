from __future__ import annotations

import contextlib
import logging
import os
import re
import threading
from collections import deque
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

LOG_BUFFER_CAPACITY = 1000

# Regex pattern for detecting tqdm progress bars
TQDM_PATTERN = re.compile(r"(?:\d+%\s*\|.*?\||\d+/\d+\s+\[.*?(?:it/s|s/it)\]|%\s*\|.*?\|\s*\d+/\d+)")
# Regex pattern for sanitizing/redacting sensitive tokens and credentials
SECRET_REDACT_PATTERNS = [
    (re.compile(r"(hf_[a-zA-Z0-9]{16,})", re.IGNORECASE), "hf_[REDACTED]"),
    (re.compile(r"((?:token|secret|password|passwd|apiKey)=)(['\"]?[^&'\s\"]{6,}['\"]?)", re.IGNORECASE), r"\1[REDACTED]"),
    (re.compile(r"(Bearer\s+)[a-zA-Z0-9_\-\.]{12,}", re.IGNORECASE), r"\1[REDACTED]"),
]


def _level_severity(lvl: str) -> int:
    lvl = (lvl or "").strip().upper()
    if lvl in {"CRITICAL", "FATAL"}:
        return 50
    if lvl == "ERROR":
        return 40
    if lvl in {"WARNING", "WARN"}:
        return 30
    if lvl == "INFO":
        return 20
    if lvl == "DEBUG":
        return 10
    if lvl == "TRACE":
        return 5
    return 0


def _normalize_level(lvl: str) -> str:
    norm = (lvl or "INFO").strip().upper()
    if norm == "WARNING":
        return "WARN"
    if norm in {"CRITICAL", "FATAL"}:
        return "ERROR"
    return norm


def _clean_message(msg: str) -> tuple[str, bool]:
    """Cleans terminal control characters, handles carriage returns (\r), redacts secrets, and detects tqdm."""
    # Handle carriage return updates: keep only the terminal's visible state after the last \r
    if "\r" in msg:
        msg = msg.split("\r")[-1]

    # Detect tqdm progress
    is_tqdm = bool(TQDM_PATTERN.search(msg))

    # Strip trailing newlines/spaces
    msg = msg.strip("\r\n").rstrip()

    # Redact sensitive credentials/tokens
    for pat, repl in SECRET_REDACT_PATTERNS:
        msg = pat.sub(repl, msg)

    return msg, is_tqdm


def _safe_log_path(raw_path: str | None) -> Path | None:
    if not raw_path or not raw_path.strip():
        return None
    try:
        p = Path(raw_path.strip()).resolve()
        forbidden_prefixes = ("/etc", "/sys", "/proc", "/usr", "/bin", "/sbin", "/boot", "/dev")
        if any(str(p).startswith(prefix) for prefix in forbidden_prefixes):
            return None
        return p
    except Exception:  # noqa: BLE001
        return None


class RingBufferLogHandler(logging.Handler):
    """Thread-safe ring buffer log handler with level normalization and tqdm progress deduplication."""

    def __init__(self, capacity: int = LOG_BUFFER_CAPACITY, log_file: Path | None = None) -> None:
        super().__init__()
        self.capacity = capacity
        self.buffer: deque[dict[str, Any]] = deque(maxlen=capacity)
        self._lock = threading.Lock()
        self.log_file = log_file
        if self.log_file:
            with contextlib.suppress(Exception):
                self.log_file.parent.mkdir(parents=True, exist_ok=True)

    def emit(self, record: logging.LogRecord) -> None:
        try:
            timestamp = datetime.fromtimestamp(record.created, UTC).isoformat()
            raw_msg = record.getMessage()
            clean_msg, is_tqdm = _clean_message(raw_msg)
            if not clean_msg:
                return

            normalized_lvl = _normalize_level(record.levelname)
            thread_name = record.threadName or "python-worker"
            logger_name = record.name

            with self._lock:
                # If this entry is a tqdm progress bar and the previous entry was also a progress bar
                # from the same logger, update the existing entry in-place to prevent buffer flooding.
                if is_tqdm and len(self.buffer) > 0 and self.buffer[-1].get("_is_tqdm") and self.buffer[-1].get("logger") == logger_name:
                    self.buffer[-1]["timestamp"] = timestamp
                    self.buffer[-1]["level"] = normalized_lvl
                    self.buffer[-1]["message"] = clean_msg
                else:
                    entry = {
                        "timestamp": timestamp,
                        "level": normalized_lvl,
                        "thread": thread_name,
                        "logger": logger_name,
                        "message": clean_msg,
                        "_is_tqdm": is_tqdm,
                    }
                    self.buffer.append(entry)

            if self.log_file:
                with contextlib.suppress(Exception):
                    formatted_line = f"[{timestamp}] [{normalized_lvl}] [{thread_name}] [{logger_name}] {clean_msg}\n"
                    with self.log_file.open("a", encoding="utf-8") as f:
                        f.write(formatted_line)
        except Exception:  # noqa: BLE001
            self.handleError(record)

    def get_logs(
        self,
        limit: int = 150,
        level: str | None = None,
        query: str | None = None,
    ) -> list[dict[str, Any]]:
        lvl_filter = (level or "ALL").strip().upper()
        min_severity = _level_severity(lvl_filter)
        q = (query or "").strip().lower()

        with self._lock:
            snapshot = list(self.buffer)

        result: list[dict[str, Any]] = []
        for entry in snapshot:
            entry_severity = _level_severity(entry["level"])
            # Severity-based filter: if "WARN", returns WARN, ERROR; if "INFO", returns INFO, WARN, ERROR
            if min_severity > 0 and entry_severity < min_severity:
                continue
            if q and q not in entry["message"].lower() and q not in entry["logger"].lower():
                continue

            result.append({
                "timestamp": entry["timestamp"],
                "level": entry["level"],
                "thread": entry["thread"],
                "logger": entry["logger"],
                "message": entry["message"],
            })

        max_lines = min(max(limit, 1), self.capacity)
        if len(result) > max_lines:
            return result[-max_lines:]
        return result


_handler_instance: RingBufferLogHandler | None = None
_init_lock = threading.Lock()


def setup_api_logging() -> RingBufferLogHandler:
    global _handler_instance
    with _init_lock:
        if _handler_instance is not None:
            return _handler_instance

        log_file_env = os.getenv("EXPENSE_ML_LOG_FILE")
        log_file_path = _safe_log_path(log_file_env)

        handler = RingBufferLogHandler(capacity=LOG_BUFFER_CAPACITY, log_file=log_file_path)
        formatter = logging.Formatter(
            fmt="[%(asctime)s] [%(levelname)s] [%(threadName)s] %(name)s: %(message)s"
        )
        handler.setFormatter(formatter)

        root = logging.getLogger()
        if handler not in root.handlers:
            root.addHandler(handler)

        for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "expense_ml"):
            log_obj = logging.getLogger(name)
            log_obj.setLevel(logging.INFO)
            if handler not in log_obj.handlers:
                log_obj.addHandler(handler)

        _handler_instance = handler
        logging.getLogger("expense_ml.api").info(
            "Python ML logging buffer initialized (capacity=%d, log_file=%s)",
            LOG_BUFFER_CAPACITY,
            str(log_file_path) if log_file_path else "in-memory only",
        )
        return handler


def get_log_handler() -> RingBufferLogHandler:
    if _handler_instance is None:
        return setup_api_logging()
    return _handler_instance
