"""Encryption at rest for project credentials (Fernet: AES-128-CBC + HMAC-SHA256)."""
import json

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models


def _fernet() -> Fernet:
    key = settings.FIELD_ENCRYPTION_KEY
    if not key:
        if settings.DEBUG:
            # Deterministic development key so local data survives restarts. Never used in production.
            key = "ZGV2LW9ubHkta2V5LWRvLW5vdC11c2UtaW4tcHJvZDA="
        else:
            raise ImproperlyConfigured("FIELD_ENCRYPTION_KEY must be set in production")
    return Fernet(key.encode() if isinstance(key, str) else key)


class EncryptedJSONField(models.TextField):
    """Stores a JSON object encrypted. Reads back as a dict; unreadable values become {}."""

    description = "Encrypted JSON"

    def from_db_value(self, value, expression, connection):
        return self.to_python(value)

    def to_python(self, value):
        if value is None or isinstance(value, dict):
            return value or {}
        if value == "":
            return {}
        try:
            return json.loads(_fernet().decrypt(value.encode()).decode())
        except (InvalidToken, ValueError):
            return {}

    def get_prep_value(self, value):
        if not value:
            return ""
        payload = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        return _fernet().encrypt(payload.encode()).decode()
