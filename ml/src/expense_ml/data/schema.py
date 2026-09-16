from dataclasses import dataclass


REQUIRED_COLUMNS = ("text", "label", "source")


@dataclass(frozen=True)
class TransactionExample:
    text: str
    label: str
    source: str
