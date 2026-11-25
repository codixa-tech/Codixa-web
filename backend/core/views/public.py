"""Public, unauthenticated endpoints used by the website. Responses are cached and versioned."""
from django.core.cache import cache as django_cache
from django.db.models import Prefetch
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from django.conf import settings

from ..models import ContactMessage, Project, ProjectImage, ProjectVideo, SiteSettings
from ..serializers import ContactCreateSerializer, project_public_dict, settings_public_dict
from ..services import cache, notify


class ContactThrottle(SimpleRateThrottle):
    """5 contact messages per hour per IP (rate in settings: DEFAULT_THROTTLE_RATES['contact'])."""

    scope = "contact"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


def _cached(name, builder):
    key = cache.key(name)
    data = django_cache.get(key)
    if data is None:
        data = builder()
        django_cache.set(key, data, settings.PUBLIC_CACHE_SECONDS)
    return data


@api_view(["GET"])
@permission_classes([AllowAny])
def public_projects(request):
    def build():
        qs = (
            Project.objects.filter(published=True)
            .select_related("client")
            .prefetch_related(
                Prefetch("images", queryset=ProjectImage.objects.order_by("position", "id")),
                Prefetch("videos", queryset=ProjectVideo.objects.order_by("position", "id")),
            )
        )
        return [project_public_dict(p, request) for p in qs]

    resp = Response(_cached(f"projects:{request.get_host()}", build))
    resp["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    return resp


@api_view(["GET"])
@permission_classes([AllowAny])
def public_settings(request):
    resp = Response(_cached("settings", lambda: settings_public_dict(SiteSettings.load())))
    resp["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    return resp


def client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return (xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR")) or None


def is_spam(request) -> bool:
    """Honeypot: a hidden 'website' field people never see; bots fill every field."""
    return bool((request.data.get("website") or "").strip())


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([ContactThrottle])
def public_contact(request):
    if is_spam(request):
        return Response({"id": 0}, status=status.HTTP_201_CREATED)
    s = ContactCreateSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    msg = s.save(ip=client_ip(request), kind=ContactMessage.Kind.CONTACT)
    notify.notify_new_message(msg)
    return Response({"id": msg.pk}, status=status.HTTP_201_CREATED)
