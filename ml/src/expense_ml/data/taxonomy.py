from __future__ import annotations

from collections.abc import Mapping


CANONICAL_CATEGORIES: tuple[str, ...] = (
    "food_dining",
    "transportation",
    "shopping_retail",
    "entertainment_recreation",
    "healthcare_medical",
    "utilities_services",
    "financial_services",
    "income",
    "government_legal",
    "charity_donations",
)

DISPLAY_NAMES: Mapping[str, str] = {
    "food_dining": "Food & Dining",
    "transportation": "Transportation",
    "shopping_retail": "Shopping & Retail",
    "entertainment_recreation": "Entertainment & Recreation",
    "healthcare_medical": "Healthcare & Medical",
    "utilities_services": "Utilities & Services",
    "financial_services": "Financial Services",
    "income": "Income",
    "government_legal": "Government & Legal",
    "charity_donations": "Charity & Donations",
}

SOURCE_LABEL_MAP: Mapping[str, Mapping[str, str]] = {
    "global-transaction-categorization": {
        "food & dining": "food_dining",
        "transportation": "transportation",
        "shopping & retail": "shopping_retail",
        "entertainment & recreation": "entertainment_recreation",
        "healthcare & medical": "healthcare_medical",
        "utilities & services": "utilities_services",
        "financial services": "financial_services",
        "income": "income",
        "government & legal": "government_legal",
        "charity & donations": "charity_donations",
    },
    "finee-india": {
        "food": "food_dining",
        "grocery": "food_dining",
        "shopping": "shopping_retail",
        "transport": "transportation",
        "travel": "transportation",
        "bills": "utilities_services",
        "entertainment": "entertainment_recreation",
        "healthcare": "healthcare_medical",
        "investment": "financial_services",
        "transfer": "financial_services",
        "salary": "income",
        "emi": "financial_services",
    },
    "synthetic-indian-transactions": {
        "groceries": "food_dining",
        "eating out": "food_dining",
        "kids activities": "entertainment_recreation",
        "shopping & clothing": "shopping_retail",
        "medicine & pharmacy": "healthcare_medical",
        "hospital & medical": "healthcare_medical",
        "utilities": "utilities_services",
        "rent & mortgage": "financial_services",
        "transportation & gas": "transportation",
        "entertainment & subscriptions": "entertainment_recreation",
        "travel": "transportation",
        "insurance": "financial_services",
        "education": "government_legal",
        "personal care": "shopping_retail",
        "investments & savings transfer": "financial_services",
        "atm & cash": "financial_services",
        "fees & interest": "financial_services",
        "income & deposits": "income",
    },
}


def canonicalize_category(label: str, source: str) -> str:
    normalized = str(label).strip().casefold()
    mapping = SOURCE_LABEL_MAP.get(source)
    if mapping is None:
        raise ValueError(
            f"No canonical taxonomy mapping is registered for configured source '{source}'."
        )
    try:
        return mapping[normalized]
    except KeyError as exc:
        known = ", ".join(sorted(mapping))
        raise ValueError(
            f"Unknown category '{label}' for configured source '{source}'. "
            f"Add an explicit taxonomy mapping. Known labels: {known}"
        ) from exc


def display_category(category_id: str) -> str:
    return DISPLAY_NAMES.get(category_id, category_id)
