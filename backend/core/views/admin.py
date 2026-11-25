"""Dashboard API (staff only)."""
from collections import defaultdict
from decimal import Decimal

from django.db.models import Count, Prefetch, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, parser_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from ..models import Client, ContactMessage, Contract, Payment, Project, ProjectImage, ProjectVideo, SiteSettings
from ..serializers import (
    ClientSerializer,
    ContractSerializer,
    MessageSerializer,
    PaymentSerializer,
    ProjectWriteSerializer,
    SettingsWriteSerializer,
    image_dict,
    project_admin_dict,
    settings_admin_dict,
    video_dict,
)
from ..services import images as image_service
from ..services import videos as video_service
from ..services.finance import with_money
from ..services.contracts import draft_for
from ..services.numbering import next_contract_number


def _project_qs():
    return with_money(
        Project.objects.select_related("client").prefetch_related(
            Prefetch("images", queryset=ProjectImage.objects.order_by("position", "id")),
            Prefetch("videos", queryset=ProjectVideo.objects.order_by("position", "id")),
        )
    ).annotate(contracts_count=Count("contracts", distinct=True))


class ProjectViewSet(viewsets.ViewSet):
    def list(self, request):
        qs = _project_qs()
        p = request.query_params
        for field in ("kind", "category", "status"):
            if p.get(field):
                qs = qs.filter(**{field: p[field]})
        if p.get("q"):
            q = p["q"].strip()
            qs = qs.filter(Q(title_ar__icontains=q) | Q(title_en__icontains=q) | Q(client__name__icontains=q) | Q(client__company__icontains=q))
        return Response([project_admin_dict(x, request) for x in qs])

    def retrieve(self, request, pk=None):
        obj = _project_qs().filter(pk=pk).first()
        if not obj:
            return Response({"error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(project_admin_dict(obj, request))

    def create(self, request):
        s = ProjectWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        obj = s.save_project(None)
        return Response(project_admin_dict(_project_qs().get(pk=obj.pk), request), status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        obj = Project.objects.filter(pk=pk).first()
        if not obj:
            return Response({"error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        s = ProjectWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save_project(obj)
        return Response(project_admin_dict(_project_qs().get(pk=obj.pk), request))

    def destroy(self, request, pk=None):
        Project.objects.filter(pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def upload_image(request):
    f = request.FILES.get("file")
    if not f:
        return Response({"error": "file_required"}, status=400)
    try:
        data = image_service.process_upload(f)
    except image_service.ImageError as exc:
        return Response({"error": str(exc)}, status=400)
    img = ProjectImage.objects.create(**data)
    return Response(image_dict(img, request), status=201)


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def upload_video(request):
    from django.conf import settings

    f = request.FILES.get("file")
    if not f:
        return Response({"error": "file_required"}, status=400)
    if f.size > settings.VIDEO_MAX_UPLOAD_MB * 1024 * 1024:
        return Response({"error": "too_big"}, status=400)
    if not (f.content_type or "").startswith("video/"):
        return Response({"error": "not_video"}, status=400)
    video = ProjectVideo.objects.create(file=f, name=f.name[:200], bytes=f.size)
    meta = video_service.probe(video.file.path)
    if meta["duration"] > settings.VIDEO_MAX_SECONDS + 1:
        video.delete()
        return Response({"error": "too_long"}, status=400)
    video.width, video.height, video.duration = meta["width"], meta["height"], meta["duration"]
    poster = request.FILES.get("poster")
    if poster:
        try:
            pdata = image_service.process_upload(poster)
            video.poster.save(pdata["thumb"].name, pdata["thumb"], save=False)
        except image_service.ImageError:
            pass
    video.save()
    video_service.transcode_async(video.pk)
    return Response(video_dict(video, request), status=201)


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer

    def get_queryset(self):
        qs = Client.objects.all()
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(company__icontains=q) | Q(email__icontains=q) | Q(phone__icontains=q))
        return qs

    def list(self, request, *args, **kwargs):
        clients = list(self.get_queryset())
        totals = defaultdict(dict)
        counts = defaultdict(int)
        for row in with_money(Project.objects.filter(client__in=clients)).values("client_id", "currency", "cost", "paid_total"):
            t = totals[row["client_id"]].setdefault(row["currency"], {"cost": 0.0, "paid": 0.0})
            t["cost"] += float(row["cost"])
            t["paid"] += float(row["paid_total"])
            counts[row["client_id"]] += 1
        data = self.get_serializer(clients, many=True).data
        for item in data:
            item["projectsCount"] = counts[item["id"]]
            item["totals"] = totals[item["id"]]
        return Response(data)


class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer

    def get_queryset(self):
        qs = Payment.objects.select_related("project", "project__client")
        p = self.request.query_params
        if p.get("projectId"):
            qs = qs.filter(project_id=p["projectId"])
        if p.get("clientId"):
            qs = qs.filter(project__client_id=p["clientId"])
        return qs


class ContractViewSet(viewsets.ModelViewSet):
    serializer_class = ContractSerializer

    def get_queryset(self):
        qs = Contract.objects.select_related("project")
        if self.request.query_params.get("projectId"):
            qs = qs.filter(project_id=self.request.query_params["projectId"])
        return qs

    def perform_create(self, serializer):
        serializer.save(number=next_contract_number())

    @action(detail=False, methods=["get"], url_path="draft")
    def draft(self, request):
        """Pre-filled contract for a project (not saved): client data, value, scope and a standard schedule."""
        project = Project.objects.select_related("client").filter(pk=request.query_params.get("projectId")).first()
        if not project:
            return Response({"error": "not_found"}, status=404)
        return Response(draft_for(project))

    @action(detail=True, methods=["post"], url_path="signed-file")
    def signed_file(self, request, pk=None):
        contract = self.get_object()
        f = request.FILES.get("file")
        if not f:
            return Response({"error": "file_required"}, status=400)
        contract.signed_file = f
        contract.status = Contract.Status.SIGNED
        contract.signed_at = contract.signed_at or timezone.localdate()
        contract.save()
        return Response(self.get_serializer(contract).data)


class MessageViewSet(mixins.ListModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Website messages and store orders. ?kind=contact|order&status=new|contacted|won|closed"""

    serializer_class = MessageSerializer

    def get_queryset(self):
        qs = ContactMessage.objects.select_related("system")
        p = self.request.query_params
        if p.get("kind") in ContactMessage.Kind.values:
            qs = qs.filter(kind=p["kind"])
        if p.get("status") in ContactMessage.Status.values:
            qs = qs.filter(status=p["status"])
        return qs


@api_view(["GET", "PUT"])
@parser_classes([JSONParser])
def site_settings(request):
    s = SiteSettings.load()
    if request.method == "PUT":
        w = SettingsWriteSerializer(data=request.data)
        w.is_valid(raise_exception=True)
        s = w.apply(s)
    return Response(settings_admin_dict(s, request))


@api_view(["POST"])
def site_test_email(request):
    """Send a test e-mail now to the notification address and report the SMTP result."""
    from ..services.notify import recipient, send_test

    s = SiteSettings.load()
    to = (request.data.get("to") or recipient(s) or "").strip()
    if not to:
        return Response({"ok": False, "error": "no_recipient"}, status=400)
    error = send_test(to)
    return Response({"ok": error is None, "to": to, "error": error}, status=200 if error is None else 502)


@api_view(["POST", "DELETE"])
@parser_classes([MultiPartParser, FormParser])
def site_signature(request):
    """Upload (PNG with transparent background works best) or remove the CEO signature used on PDFs."""
    s = SiteSettings.load()
    if request.method == "DELETE":
        if s.signature:
            s.signature.delete(save=False)
        s.signature = ""
        s.save()
        return Response(settings_admin_dict(s, request))
    f = request.FILES.get("file")
    if not f or not (f.content_type or "").startswith("image/"):
        return Response({"error": "not_image"}, status=400)
    if s.signature:
        s.signature.delete(save=False)
    s.signature = f
    s.save()
    return Response(settings_admin_dict(s, request))


@api_view(["GET"])
def stats_overview(request):
    projects = with_money(Project.objects.all()).values("currency", "cost", "paid_total", "status")
    by_currency = {}
    active = completed = 0
    for p in projects:
        active += p["status"] == Project.Status.IN_PROGRESS
        completed += p["status"] == Project.Status.COMPLETED
        if p["cost"] <= 0:
            continue
        c = by_currency.setdefault(p["currency"], {"contract": 0.0, "received": 0.0, "outstanding": 0.0, "byMonth": {}})
        c["contract"] += float(p["cost"])
        c["received"] += float(p["paid_total"])
        c["outstanding"] += float(max(p["cost"] - p["paid_total"], Decimal("0")))
    months = (
        Payment.objects.annotate(m=TruncMonth("date")).values("m", "project__currency").annotate(total=Sum("amount")).order_by("m")
    )
    for row in months:
        c = by_currency.setdefault(row["project__currency"], {"contract": 0.0, "received": 0.0, "outstanding": 0.0, "byMonth": {}})
        c["byMonth"][row["m"].strftime("%Y-%m")] = float(row["total"])

    attention = [
        project_admin_dict(p, request)
        for p in _project_qs().filter(cost__gt=0).order_by("-cost")
        if p.cost - p.paid_total > 0
    ]
    attention.sort(key=lambda x: -x["remaining"])
    return Response(
        {
            "byCurrency": by_currency,
            "active": active,
            "completed": completed,
            "total": len(projects),
            "attention": attention[:6],
            "unread": ContactMessage.objects.filter(is_read=False).count(),
        }
    )


@api_view(["GET"])
def backup_export(request):
    """JSON export of all records (media files stay on the server)."""
    data = {
        "projects": [project_admin_dict(p, request) for p in _project_qs()],
        "clients": ClientSerializer(Client.objects.all(), many=True).data,
        "payments": PaymentSerializer(Payment.objects.select_related("project", "project__client"), many=True).data,
        "contracts": ContractSerializer(Contract.objects.select_related("project"), many=True, context={"request": request}).data,
        "messages": MessageSerializer(ContactMessage.objects.all(), many=True).data,
        "settings": settings_admin_dict(SiteSettings.load(), request),
    }
    return Response({"app": "codixa", "version": 2, "exportedAt": timezone.now().isoformat(), "data": data})


@api_view(["GET"])
def me(request):
    u = request.user
    return Response({"id": u.pk, "username": u.get_username(), "name": u.get_full_name() or u.get_username()})
