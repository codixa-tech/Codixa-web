"""Access to the shared category schema (src/config/categories.json)."""
import json
from functools import lru_cache

from django.conf import settings


@lru_cache(maxsize=1)
def load_schema() -> dict:
    with open(settings.CATEGORIES_FILE, encoding="utf-8") as fh:
        return json.load(fh)


def categories() -> dict:
    return {c["key"]: c for c in load_schema()["categories"]}


def category(key: str) -> dict | None:
    return categories().get(key)


def category_choices() -> list[tuple[str, str]]:
    return [(c["key"], c["label"]["en"]) for c in load_schema()["categories"]]


def secret_keys(category_key: str) -> set[str]:
    cat = category(category_key) or {}
    return {f["key"] for f in cat.get("fields", []) if f.get("secret")}


def public_keys(category_key: str) -> set[str]:
    cat = category(category_key) or {}
    return {f["key"] for f in cat.get("fields", []) if f.get("public") and not f.get("secret")}


def field_label(category_key: str, field_key: str, lang: str) -> str:
    for f in (category(category_key) or {}).get("fields", []):
        if f["key"] == field_key:
            return f["label"].get(lang) or f["label"]["en"]
    return field_key


def option_label(category_key: str, field_key: str, value, lang: str):
    for f in (category(category_key) or {}).get("fields", []):
        if f["key"] != field_key:
            continue
        for o in f.get("options", []):
            if isinstance(o, dict) and o.get("v") == value:
                return o.get(lang) or o["v"]
    return value


def status_label(key: str, lang: str) -> str:
    for s in load_schema()["statuses"]:
        if s["key"] == key:
            return s.get(lang) or s["en"]
    return key


def payment_method_label(key: str, lang: str) -> str:
    for m in load_schema()["paymentMethods"]:
        if m["key"] == key:
            return m.get(lang) or m["en"]
    return key
