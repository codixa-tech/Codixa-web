"""Dashboard API for the connector: see/revoke Claude's access, read the activity log, open signed PDF links."""
from django.contrib.auth import get_user_model
from django.core import signing
from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import ActivityLog, Grant, Token
from .oauth import mcp_url
from .tools import read_pdf_token


def _grant_dict(g: Grant) -> dict:
    return {
        "id": g.pk,
        "client": g.client.name or "Claude",
        "user": g.user.get_username(),
        "createdAt": g.created_at.isoformat(),
        "lastUsedAt": g.last_used_at.isoformat() if g.last_used_at else None,
        "active": g.active,
        "revokedAt": g.revoked_at.isoformat() if g.revoked_at else None,
    }


@api_view(["GET"])
def connector_info(request):
    grants = Grant.objects.select_related("client", "user").order_by("revoked_at", "-created_at")[:50]
    return Response({"url": mcp_url(request), "grants": [_grant_dict(g) for g in grants]})


@api_view(["POST"])
def connector_revoke(request, pk):
    grant = Grant.objects.filter(pk=pk).first()
    if not grant:
        return Response({"error": "not_found"}, status=404)
    grant.revoke()
    Token.objects.filter(grant=grant).update(revoked=True)
    ActivityLog.objects.create(user=request.user, source=ActivityLog.Source.DASHBOARD, action="connector.revoked",
                               target=f"grant #{grant.pk}")
    return Response(_grant_dict(grant))


@api_view(["GET"])
def activity_list(request):
    qs = ActivityLog.objects.select_related("user")
    p = request.query_params
    if p.get("source") in ActivityLog.Source.values:
        qs = qs.filter(source=p["source"])
    if p.get("q"):
        qs = qs.filter(Q(action__icontains=p["q"]) | Q(target__icontains=p["q"]))
    try:
        limit = min(max(int(p.get("limit", 100)), 1), 300)
    except ValueError:
        limit = 100
    return Response([
        {
            "id": a.pk,
            "source": a.source,
            "action": a.action,
            "target": a.target,
            "detail": a.detail,
            "ok": a.ok,
            "user": a.user.get_username() if a.user else None,
            "ip": a.ip,
            "createdAt": a.created_at.isoformat(),
        }
        for a in qs[:limit]
    ])


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def signed_pdf(request, token):
    """PDF behind a short-lived signed link created by the connector (no login needed for 15 minutes)."""
    from core.views.reports import render_contract, render_project_report

    try:
        data = read_pdf_token(token)
    except signing.SignatureExpired:
        return Response({"error": "link_expired"}, status=410)
    except signing.BadSignature:
        return Response({"error": "invalid_link"}, status=404)
    user = get_user_model().objects.filter(pk=data.get("u"), is_active=True, is_staff=True).first()
    if not user:
        return Response({"error": "invalid_link"}, status=404)
    lang = "en" if data.get("l") == "en" else "ar"
    if data.get("d") == "contract":
        return render_contract(request, data.get("id"), lang)
    kind = "internal" if data.get("d") == "internal_report" else "client"
    return render_project_report(request, data.get("id"), kind, lang, include_secrets=False)
