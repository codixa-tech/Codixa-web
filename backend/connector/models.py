"""OAuth 2.1 storage for the Claude connector (MCP) plus the activity log.

Only SHA-256 hashes of codes and tokens are stored, so a database leak does not leak usable tokens.
"""
import hashlib
import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def new_token(prefix: str) -> str:
    return f"{prefix}_{secrets.token_urlsafe(32)}"


class OAuthClient(models.Model):
    """A client registered through Dynamic Client Registration (Claude registers itself)."""

    client_id = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=200, blank=True)
    redirect_uris = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name or self.client_id


class Grant(models.Model):
    """One approval by a user for one client. Revoking it kills every token issued under it."""

    client = models.ForeignKey(OAuthClient, on_delete=models.CASCADE, related_name="grants")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="connector_grants")
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def active(self) -> bool:
        return self.revoked_at is None

    def revoke(self):
        if self.revoked_at is None:
            self.revoked_at = timezone.now()
            self.save(update_fields=["revoked_at"])


class AuthCode(models.Model):
    code_hash = models.CharField(max_length=64, unique=True)
    grant = models.ForeignKey(Grant, on_delete=models.CASCADE)
    redirect_uri = models.CharField(max_length=500)
    code_challenge = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)


class Token(models.Model):
    class Kind(models.TextChoices):
        ACCESS = "access", "Access"
        REFRESH = "refresh", "Refresh"

    token_hash = models.CharField(max_length=64, unique=True)
    kind = models.CharField(max_length=8, choices=Kind.choices)
    grant = models.ForeignKey(Grant, on_delete=models.CASCADE, related_name="tokens")
    expires_at = models.DateTimeField(db_index=True)
    revoked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class ActivityLog(models.Model):
    """Who changed what and when — from the dashboard or from Claude."""

    class Source(models.TextChoices):
        DASHBOARD = "dashboard", "Dashboard"
        CONNECTOR = "connector", "Claude connector"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    source = models.CharField(max_length=12, choices=Source.choices)
    action = models.CharField(max_length=80)
    target = models.CharField(max_length=200, blank=True)
    detail = models.JSONField(default=dict, blank=True)
    ok = models.BooleanField(default=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"], name="act_created_idx"),
            models.Index(fields=["source", "-created_at"], name="act_source_idx"),
        ]
