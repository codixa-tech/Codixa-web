"""Minimal OAuth 2.1 authorization server for the Claude connector.

Implements what Claude's connector flow needs and nothing more:
  * RFC 8414 / RFC 9728 discovery metadata
  * RFC 7591 Dynamic Client Registration (public clients, redirect URIs from an allow-list)
  * Authorization-code grant with mandatory PKCE (S256) and a login + consent page
  * Refresh tokens with rotation and replay detection
Only staff users can approve. Every grant can be revoked from the dashboard.
"""
import base64
import hashlib
import json
import secrets
from datetime import timedelta
from urllib.parse import urlencode, urlsplit

from django.conf import settings
from django.contrib.auth import authenticate
from django.core.cache import cache
from django.db import transaction
from django.http import HttpResponse, HttpResponseNotAllowed, JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from .models import ActivityLog, AuthCode, Grant, OAuthClient, Token, hash_token, new_token

ACCESS_TTL = timedelta(hours=1)
REFRESH_TTL = timedelta(days=30)
CODE_TTL = timedelta(minutes=10)
LOGIN_FAILS_LIMIT = 8
LOGIN_FAILS_WINDOW = 15 * 60
REGISTER_LIMIT = 30  # per IP per hour


# ---------------------------------------------------------------- helpers
def base_url(request) -> str:
    return (settings.PUBLIC_BASE_URL or request.build_absolute_uri("/")).rstrip("/")


def mcp_url(request) -> str:
    return f"{base_url(request)}/mcp"


def client_ip(request) -> str | None:
    fwd = request.META.get("HTTP_X_FORWARDED_FOR")
    return (fwd.split(",")[0].strip() if fwd else request.META.get("REMOTE_ADDR")) or None


def _json_body(request) -> dict:
    if request.content_type == "application/json":
        try:
            data = json.loads(request.body or b"{}")
            return data if isinstance(data, dict) else {}
        except ValueError:
            return {}
    return request.POST.dict()


def _no_store(resp):
    resp["Cache-Control"] = "no-store"
    resp["Pragma"] = "no-cache"
    return resp


def _oauth_error(error: str, description: str = "", status: int = 400):
    body = {"error": error}
    if description:
        body["error_description"] = description
    return _no_store(JsonResponse(body, status=status))


def _is_loopback(uri: str) -> bool:
    parts = urlsplit(uri)
    return parts.scheme == "http" and parts.hostname in {"localhost", "127.0.0.1"}


def redirect_allowed(uri: str) -> bool:
    """Only Claude's callbacks (and loopback for Claude Code) can receive codes."""
    if not isinstance(uri, str) or len(uri) > 500:
        return False
    return uri in settings.CONNECTOR_REDIRECT_URIS or _is_loopback(uri)


def redirect_matches(registered: list[str], uri: str) -> bool:
    if uri in registered:
        return True
    if _is_loopback(uri):  # Claude Code uses an ephemeral port: compare without it.
        u = urlsplit(uri)
        for r in registered:
            ru = urlsplit(r)
            if _is_loopback(r) and ru.hostname == u.hostname and ru.path == u.path:
                return True
    return False


def _rate_hit(key: str, limit: int, window: int) -> bool:
    """Increment a counter; True when the limit is exceeded."""
    added = cache.add(key, 1, window)
    if added:
        return False
    try:
        return cache.incr(key) > limit
    except ValueError:
        cache.set(key, 1, window)
        return False


def _pkce_ok(verifier: str, challenge: str) -> bool:
    if not verifier or not (43 <= len(verifier) <= 128):
        return False
    digest = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return secrets.compare_digest(digest, challenge)


def issue_tokens(grant: Grant) -> dict:
    now = timezone.now()
    access, refresh = new_token("cdx_at"), new_token("cdx_rt")
    Token.objects.bulk_create(
        [
            Token(token_hash=hash_token(access), kind=Token.Kind.ACCESS, grant=grant, expires_at=now + ACCESS_TTL),
            Token(token_hash=hash_token(refresh), kind=Token.Kind.REFRESH, grant=grant, expires_at=now + REFRESH_TTL),
        ]
    )
    return {
        "access_token": access,
        "token_type": "Bearer",
        "expires_in": int(ACCESS_TTL.total_seconds()),
        "refresh_token": refresh,
        "scope": "codixa",
    }


def authenticate_bearer(request):
    """Return the Grant for a valid access token, else None."""
    header = request.META.get("HTTP_AUTHORIZATION", "")
    if not header.lower().startswith("bearer "):
        return None
    raw = header[7:].strip()
    if not raw:
        return None
    tok = (
        Token.objects.select_related("grant", "grant__user", "grant__client")
        .filter(token_hash=hash_token(raw), kind=Token.Kind.ACCESS, revoked=False, expires_at__gt=timezone.now())
        .first()
    )
    if not tok:
        return None
    grant = tok.grant
    user = grant.user
    if grant.revoked_at or not (user.is_active and user.is_staff):
        return None
    now = timezone.now()
    if not grant.last_used_at or now - grant.last_used_at > timedelta(minutes=5):
        Grant.objects.filter(pk=grant.pk).update(last_used_at=now)
    return grant


# ---------------------------------------------------------------- discovery
def protected_resource_metadata(request, *args):
    return JsonResponse(
        {
            "resource": mcp_url(request),
            "authorization_servers": [base_url(request)],
            "bearer_methods_supported": ["header"],
            "scopes_supported": ["codixa"],
            "resource_name": "Codixa dashboard",
        }
    )


def authorization_server_metadata(request, *args):
    b = base_url(request)
    return JsonResponse(
        {
            "issuer": b,
            "authorization_endpoint": f"{b}/oauth/authorize",
            "token_endpoint": f"{b}/oauth/token",
            "registration_endpoint": f"{b}/oauth/register",
            "revocation_endpoint": f"{b}/oauth/revoke",
            "response_types_supported": ["code"],
            "grant_types_supported": ["authorization_code", "refresh_token"],
            "code_challenge_methods_supported": ["S256"],
            "token_endpoint_auth_methods_supported": ["none"],
            "revocation_endpoint_auth_methods_supported": ["none"],
            "scopes_supported": ["codixa"],
        }
    )


# ---------------------------------------------------------------- registration
@csrf_exempt
def register(request):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])
    if _rate_hit(f"oauth:reg:{client_ip(request)}", REGISTER_LIMIT, 3600):
        return _oauth_error("slow_down", "Too many registrations", 429)
    data = _json_body(request)
    uris = data.get("redirect_uris")
    if not isinstance(uris, list) or not uris or len(uris) > 5:
        return _oauth_error("invalid_redirect_uri", "redirect_uris is required")
    bad = [u for u in uris if not redirect_allowed(u)]
    if bad:
        return _oauth_error("invalid_redirect_uri", "Redirect URI not allowed for this server")
    client = OAuthClient.objects.create(
        client_id=secrets.token_urlsafe(24),
        name=str(data.get("client_name") or "")[:200],
        redirect_uris=uris,
    )
    return _no_store(
        JsonResponse(
            {
                "client_id": client.client_id,
                "client_id_issued_at": int(client.created_at.timestamp()),
                "client_name": client.name,
                "redirect_uris": uris,
                "token_endpoint_auth_method": "none",
                "grant_types": ["authorization_code", "refresh_token"],
                "response_types": ["code"],
            },
            status=201,
        )
    )


# ---------------------------------------------------------------- authorize
AUTH_PARAMS = ("response_type", "client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state", "scope", "resource")


def _redirect(uri: str, **params) -> HttpResponse:
    sep = "&" if "?" in uri else "?"
    resp = HttpResponse(status=302)
    resp["Location"] = f"{uri}{sep}{urlencode({k: v for k, v in params.items() if v})}"
    return _no_store(resp)


def _page(request, ctx: dict, status: int = 200):
    resp = render(request, "connector/authorize.html", ctx, status=status)
    resp["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'self'; form-action 'self' https: http://localhost:* http://127.0.0.1:*; frame-ancestors 'none'"
    return _no_store(resp)


def authorize(request):
    src = request.POST if request.method == "POST" else request.GET
    params = {k: src.get(k, "") for k in AUTH_PARAMS}

    client = OAuthClient.objects.filter(client_id=params["client_id"]).first()
    if not client or not redirect_matches(client.redirect_uris, params["redirect_uri"]):
        # Never redirect to an unverified URI.
        return _page(request, {"fatal": True, "error": "Unknown application or redirect address."}, 400)

    redirect_uri, state = params["redirect_uri"], params["state"]
    if params["response_type"] != "code":
        return _redirect(redirect_uri, error="unsupported_response_type", state=state)
    if params["code_challenge_method"] != "S256" or not params["code_challenge"]:
        return _redirect(redirect_uri, error="invalid_request", error_description="PKCE S256 required", state=state)

    ctx = {"params": params, "client_name": client.name or "Claude", "base": base_url(request)}
    if request.method == "GET":
        return _page(request, ctx)

    if request.POST.get("decision") != "approve":
        return _redirect(redirect_uri, error="access_denied", state=state)

    ip = client_ip(request)
    fails_key = f"oauth:fails:{ip}"
    if (cache.get(fails_key) or 0) >= LOGIN_FAILS_LIMIT:
        return _page(request, {**ctx, "error": "Too many attempts. Try again in 15 minutes."}, 429)

    user = authenticate(request, username=request.POST.get("username", ""), password=request.POST.get("password", ""))
    if not user or not user.is_active or not user.is_staff:
        _rate_hit(fails_key, LOGIN_FAILS_LIMIT, LOGIN_FAILS_WINDOW)
        return _page(request, {**ctx, "error": "Wrong username or password, or the account has no dashboard access.",
                               "username": request.POST.get("username", "")}, 400)

    cache.delete(fails_key)
    with transaction.atomic():
        grant = Grant.objects.filter(client=client, user=user, revoked_at__isnull=True).first() or Grant.objects.create(client=client, user=user)
        code = secrets.token_urlsafe(32)
        AuthCode.objects.create(
            code_hash=hash_token(code),
            grant=grant,
            redirect_uri=redirect_uri,
            code_challenge=params["code_challenge"],
            expires_at=timezone.now() + CODE_TTL,
        )
    ActivityLog.objects.create(user=user, source=ActivityLog.Source.CONNECTOR, action="connector.authorized",
                               target=client.name or client.client_id, ip=ip)
    return _redirect(redirect_uri, code=code, state=state, iss=base_url(request))


# ---------------------------------------------------------------- token
@csrf_exempt
def token(request):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])
    data = _json_body(request)
    grant_type = data.get("grant_type")
    if grant_type == "authorization_code":
        return _token_from_code(data)
    if grant_type == "refresh_token":
        return _token_from_refresh(data)
    return _oauth_error("unsupported_grant_type")


def _token_from_code(data):
    with transaction.atomic():
        code = (
            AuthCode.objects.select_for_update()
            .select_related("grant", "grant__client", "grant__user")
            .filter(code_hash=hash_token(data.get("code", "")))
            .first()
        )
        if not code:
            return _oauth_error("invalid_grant", "Unknown code")
        grant = code.grant
        if code.used:
            # Replay of a code: treat as compromise and revoke everything issued under it.
            grant.revoke()
            Token.objects.filter(grant=grant).update(revoked=True)
            return _oauth_error("invalid_grant", "Code already used")
        code.used = True
        code.save(update_fields=["used"])
        if code.expires_at < timezone.now():
            return _oauth_error("invalid_grant", "Code expired")
        if data.get("client_id") and data["client_id"] != grant.client.client_id:
            return _oauth_error("invalid_grant", "Client mismatch")
        if data.get("redirect_uri", code.redirect_uri) != code.redirect_uri:
            return _oauth_error("invalid_grant", "redirect_uri mismatch")
        if not _pkce_ok(data.get("code_verifier", ""), code.code_challenge):
            return _oauth_error("invalid_grant", "PKCE verification failed")
        if grant.revoked_at or not (grant.user.is_active and grant.user.is_staff):
            return _oauth_error("invalid_grant", "Access revoked")
        return _no_store(JsonResponse(issue_tokens(grant)))


def _token_from_refresh(data):
    raw = data.get("refresh_token", "")
    with transaction.atomic():
        tok = (
            Token.objects.select_for_update()
            .select_related("grant", "grant__client", "grant__user")
            .filter(token_hash=hash_token(raw), kind=Token.Kind.REFRESH)
            .first()
        )
        if not tok:
            return _oauth_error("invalid_grant", "Unknown refresh token")
        grant = tok.grant
        if tok.revoked:
            # A rotated refresh token was reused: someone may have copied it.
            grant.revoke()
            Token.objects.filter(grant=grant).update(revoked=True)
            return _oauth_error("invalid_grant", "Refresh token reuse detected")
        if tok.expires_at < timezone.now() or grant.revoked_at or not (grant.user.is_active and grant.user.is_staff):
            return _oauth_error("invalid_grant", "Refresh token expired or access revoked")
        if data.get("client_id") and data["client_id"] != grant.client.client_id:
            return _oauth_error("invalid_grant", "Client mismatch")
        tok.revoked = True
        tok.save(update_fields=["revoked"])
        return _no_store(JsonResponse(issue_tokens(grant)))


@csrf_exempt
def revoke(request):
    """RFC 7009: always 200, revokes the given access or refresh token if it exists."""
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])
    raw = _json_body(request).get("token", "")
    if raw:
        Token.objects.filter(token_hash=hash_token(raw)).update(revoked=True)
    return _no_store(HttpResponse(status=200))
