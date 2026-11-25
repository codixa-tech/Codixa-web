"""Store (المتجر): public catalogue + booking, and the dashboard API for managing systems."""
from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers as drf
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, parser_classes, permission_classes, throttle_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from core.models import ContactMessage
from core.serializers import _url
from core.services import images as image_service
from core.services import notify
from core.views.public import _cached, client_ip, is_spam

from .models import EditorImage, System, SystemImage
from .serializers import SystemWriteSerializer, image_dict, system_admin, system_card, system_public


def _with_images(qs):
    return qs.prefetch_related(Prefetch("images", queryset=SystemImage.objects.order_by("position", "id")))


# ------------------------------------------------------------------ public
@api_view(["GET"])
@permission_classes([AllowAny])
def public_systems(request):
    data = _cached("systems", lambda: [system_card(s, request) for s in _with_images(System.objects.filter(published=True))])
    resp = Response(data)
    resp["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    return resp


@api_view(["GET"])
@permission_classes([AllowAny])
def public_system(request, slug):
    def build():
        s = _with_images(System.objects.filter(published=True, slug=slug)).first()
        return system_public(s, request) if s else None

    data = _cached(f"system:{slug}", build)
    if data is None:
        return Response({"error": "not_found"}, status=404)
    resp = Response(data)
    resp["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    return resp


class OrderThrottle(SimpleRateThrottle):
    scope = "order"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class OrderSerializer(drf.Serializer):
    name = drf.CharField(max_length=150)
    phone = drf.CharField(max_length=40)
    email = drf.EmailField(required=False, allow_blank=True)
    company = drf.CharField(required=False, allow_blank=True, max_length=150)
    preferredContact = drf.ChoiceField(choices=["whatsapp", "call", "email"], required=False, default="whatsapp")
    message = drf.CharField(required=False, allow_blank=True, max_length=3000)
    lang = drf.ChoiceField(choices=["ar", "en"], required=False, default="ar")

    def validate_phone(self, v):
        digits = "".join(c for c in v if c.isdigit())
        if len(digits) < 8:
            raise drf.ValidationError("invalid_phone")
        return v.strip()

    def validate(self, data):
        if data.get("preferredContact") == "email" and not data.get("email"):
            raise drf.ValidationError({"email": "required_for_email_contact"})
        return data


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([OrderThrottle])
def public_order(request, slug):
    system = get_object_or_404(System, slug=slug, published=True)
    if is_spam(request):
        return Response({"id": 0}, status=status.HTTP_201_CREATED)
    s = OrderSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    msg = ContactMessage.objects.create(
        kind=ContactMessage.Kind.ORDER,
        system=system,
        system_title=system.title_ar or system.title_en,
        name=d["name"].strip(),
        phone=d["phone"],
        email=d.get("email", ""),
        company=d.get("company", "").strip(),
        preferred_contact=d.get("preferredContact", "whatsapp"),
        message=d.get("message", "").strip(),
        service="store",
        lang=d.get("lang", "ar"),
        ip=client_ip(request),
    )
    notify.notify_new_message(msg)
    return Response({"id": msg.pk}, status=status.HTTP_201_CREATED)


# ------------------------------------------------------------------ dashboard
class SystemViewSet(viewsets.ViewSet):
    """CRUD for store systems (staff only)."""

    def _qs(self):
        return _with_images(System.objects.annotate(orders_count=Count("orders", filter=Q(orders__kind="order"))))

    def list(self, request):
        qs = self._qs()
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(title_ar__icontains=q) | Q(title_en__icontains=q) | Q(slug__icontains=q))
        return Response([system_admin(s, request) for s in qs])

    def retrieve(self, request, pk=None):
        return Response(system_admin(get_object_or_404(self._qs(), pk=pk), request))

    def create(self, request):
        s = SystemWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        obj = s.save_system()
        return Response(system_admin(get_object_or_404(self._qs(), pk=obj.pk), request), status=201)

    def update(self, request, pk=None):
        obj = get_object_or_404(System, pk=pk)
        s = SystemWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save_system(obj)
        return Response(system_admin(get_object_or_404(self._qs(), pk=obj.pk), request))

    def destroy(self, request, pk=None):
        get_object_or_404(System, pk=pk).delete()
        return Response(status=204)


def _process(request):
    f = request.FILES.get("file")
    if not f:
        return None, Response({"error": "file_required"}, status=400)
    try:
        return image_service.process_upload(f), None
    except image_service.ImageError as exc:
        return None, Response({"error": str(exc)}, status=400)


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def upload_system_image(request):
    data, err = _process(request)
    if err:
        return err
    return Response(image_dict(SystemImage.objects.create(**data), request), status=201)


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def upload_editor_image(request):
    """Image inserted inside the rich-text editor; returns its URL."""
    data, err = _process(request)
    if err:
        return err
    img = EditorImage.objects.create(image=data["image"], width=data["width"], height=data["height"])
    return Response({"src": _url(request, img.image), "w": img.width, "h": img.height}, status=201)
