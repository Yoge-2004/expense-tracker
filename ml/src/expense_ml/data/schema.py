from __future__ import annotations

from dataclasses import dataclass


REQUIRED_COLUMNS = ("text", "label", "source")
OPTIONAL_COLUMNS = ("source_label", "country", "currency", "language", "record_id")
ALL_COLUMNS = REQUIRED_COLUMNS + OPTIONAL_COLUMNS


@dataclass(frozen=True)
class TransactionExample:
    text: str
    label: str
    source: str
    source_label: str = ""
    country: str = "unknown"
    currency: str = "unknown"
    language: str = "unknown"
    record_id: str = ""
