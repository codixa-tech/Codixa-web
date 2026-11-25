"""API representations. Output uses the same camelCase shapes as the React app's data layer."""
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.conf import settings as django_settings
from rest_framework import serializers

from . import schema
from .models import Client, ContactMessage, Contract, Payment, Project, ProjectImage, ProjectVideo, SiteSettings


def _url(request, f):
    """Media URL. Relative by default (/media/...) so it works behind any domain or proxy;
    set MEDIA_PUBLIC_BASE (e.g. https://api.codixa.tech) when the site and API use different domains."""
    if not f:
        return ""
    from django.conf import settings

    return f"{settings.MEDIA_PUBLIC_BASE}{f.url}"


def _num(d):
    return float(d) if d is not None else 0.0


def _iso(d):
    return d.isoformat() if d else ""


# ---------- Media ----------
def image_dict(img: ProjectImage, request) -> dict:
    return {
        "id": img.pk,
        "src": _url(request, img.image),
        "thumb": _url(request, img.thumb) or _url(request, img.image),
        "w": img.width,
        "h": img.height,
        "bytes": img.bytes,
        "originalBytes": img.original_bytes,
    }


def video_dict(v: ProjectVideo, request) -> dict:
    return {
        "id": v.pk,
        "src": _url(request, v.file),
        "poster": _url(request, v.poster),
        "w": v.width,
        "h": v.height,
        "vertical": v.vertical,
        "duration": v.duration,
        "bytes": v.bytes,
        "name": v.name,
        "state": v.state,
    }


# ---------- Projects ----------
def project_admin_dict(p: Project, request) -> dict:
    paid = getattr(p, "paid_total", None)
    if paid is None:
        paid = sum((pay.amount for pay in p.payments.all()), Decimal("0"))
    c = p.client
    return {
        "id": p.pk,
        "kind": p.kind,
        "category": p.category,
        "title": {"ar": p.title_ar, "en": p.title_en},
        "summary": {"ar": p.summary_ar, "en": p.summary_en},
        "clientId": p.client_id,
        "client": {"id": c.pk, "name": c.name, "company": c.company} if c else None,
        "showClient": p.show_client,
        "status": p.status,
        "progress": p.progress,
        "featured": p.featured,
        "published": p.published,
        "startDate": _iso(p.start_date),
        "endDate": _iso(p.end_date),
        "cost": _num(p.cost),
        "currency": p.currency,
        "images": [image_dict(i, request) for i in p.images.all()],
        "videos": [video_dict(v, request) for v in p.videos.all()],
        "details": {**(p.details or {}), **(p.secrets or {})},
        "paid": _num(paid),
        "remaining": _num(p.cost - paid),
        "paymentsCount": getattr(p, "payments_count", None) or 0,
        "contractsCount": getattr(p, "contracts_count", None) or 0,
        "createdAt": p.created_at.isoformat(),
        "updatedAt": p.updated_at.isoformat(),
    }


def project_public_dict(p: Project, request) -> dict:
    allowed = schema.public_keys(p.category)
    details = {k: v for k, v in (p.details or {}).items() if k in allowed and v not in (None, "", [], {})}
    c = p.client
    return {
        "id": p.pk,
        "kind": p.kind,
        "category": p.category,
        "title": {"ar": p.title_ar, "en": p.title_en},
        "summary": {"ar": p.summary_ar, "en": p.summary_en},
        "status": p.status,
        "progress": p.progress,
        "featured": p.featured,
        "startDate": _iso(p.start_date),
        "endDate": _iso(p.end_date),
        "images": [image_dict(i, request) for i in p.images.all()],
        "videos": [video_dict(v, request) for v in p.videos.all() if v.state == ProjectVideo.State.READY],
        "details": details,
        "client": {"name": c.company or c.name} if (c and p.show_client) else None,
    }


class BilingualField(serializers.Field):
    def to_internal_value(self, data):
        if isinstance(data, str):
            return {"ar": "", "en": data}
        if not isinstance(data, dict):
            raise serializers.ValidationError("Expected {ar, en}")
        return {"ar": str(data.get("ar", "") or "").strip(), "en": str(data.get("en", "") or "").strip()}

    def to_representation(self, value):
        return value


class MediaRefField(serializers.ListField):
    child = serializers.DictField()


class ProjectWriteSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=Project.Kind.choices)
    category = serializers.CharField(max_length=32)
    title = BilingualField()
    summary = BilingualField(required=False)
    clientId = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all(), allow_null=True, required=False, source="client")
    showClient = serializers.BooleanField(required=False, default=True, source="show_client")
    status = serializers.ChoiceField(choices=Project.Status.choices)
    progress = serializers.IntegerField(min_value=0, max_value=100, required=False, default=0)
    featured = serializers.BooleanField(required=False, default=False)
    published = serializers.BooleanField(required=False, default=True)
    startDate = serializers.DateField(required=False, allow_null=True, source="start_date")
    endDate = serializers.DateField(required=False, allow_null=True, source="end_date")
    cost = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0"), required=False, default=Decimal("0"))
    currency = serializers.ChoiceField(choices=Project.currency.field.choices, required=False, default="EGP")
    details = serializers.DictField(required=False, default=dict)
    images = MediaRefField(required=False)
    videos = MediaRefField(required=False)

    def to_internal_value(self, data):
        # Empty strings from date inputs mean "no date".
        data = data.copy() if hasattr(data, "copy") else dict(data)
        for k in ("startDate", "endDate"):
            if data.get(k) == "":
                data[k] = None
        return super().to_internal_value(data)

    def validate_category(self, value):
        if not schema.category(value):
            raise serializers.ValidationError("Unknown category")
        return value

    def validate(self, attrs):
        title = attrs.get("title") or {}
        if not (title.get("ar") or title.get("en")):
            raise serializers.ValidationError({"title": "Add a name in Arabic or English."})
        cat = schema.category(attrs["category"])
        attrs["kind"] = cat["kind"]
        known = {f["key"] for f in cat["fields"]}
        secret = schema.secret_keys(attrs["category"])
        raw = {k: v for k, v in (attrs.get("details") or {}).items() if k in known}
        attrs["secrets"] = {k: v for k, v in raw.items() if k in secret and v not in (None, "")}
        attrs["details"] = {k: v for k, v in raw.items() if k not in secret}
        return attrs

    @transaction.atomic
    def save_project(self, instance: Project | None) -> Project:
        data = dict(self.validated_data)
        title = data.pop("title")
        summary = data.pop("summary", None) or {"ar": "", "en": ""}
        images = data.pop("images", None)
        videos = data.pop("videos", None)
        p = instance or Project()
        p.title_ar, p.title_en = title["ar"], title["en"]
        p.summary_ar, p.summary_en = summary["ar"], summary["en"]
        for k, v in data.items():
            setattr(p, k, v)
        p.save()
        if images is not None:
            self._sync_media(p, ProjectImage, images)
        if videos is not None:
            self._sync_media(p, ProjectVideo, videos)
        return p

    @staticmethod
    def _sync_media(project, model, refs):
        """Attach uploaded media in the given order; delete media removed in the editor."""
        ids = [int(r["id"]) for r in refs if str(r.get("id", "")).isdigit()]
        keep = set(ids)
        for obj in model.objects.filter(project=project).exclude(pk__in=keep):
            obj.delete()
        # Only media already on this project or freshly uploaded (unattached) can be attached.
        items = {o.pk: o for o in model.objects.filter(pk__in=keep).filter(Q(project=project) | Q(project__isnull=True))}
        for pos, pk in enumerate(ids):
            obj = items.get(pk)
            if obj:
                obj.project, obj.position = project, pos
        model.objects.bulk_update(items.values(), ["project", "position"])


# ---------- Clients ----------
class ClientSerializer(serializers.ModelSerializer):
    idNumber = serializers.CharField(source="id_number", required=False, allow_blank=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Client
        fields = ["id", "name", "company", "email", "phone", "country", "address", "idNumber", "notes", "createdAt"]


# ---------- Payments ----------
class PaymentSerializer(serializers.ModelSerializer):
    projectId = serializers.PrimaryKeyRelatedField(source="project", queryset=Project.objects.all())
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"), coerce_to_string=False)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Payment
        fields = ["id", "projectId", "amount", "date", "method", "reference", "note", "createdAt"]

    def to_representation(self, obj):
        data = super().to_representation(obj)
        data["amount"] = float(obj.amount)
        p = obj.project
        data["project"] = {"id": p.pk, "title": {"ar": p.title_ar, "en": p.title_en}, "currency": p.currency}
        data["client"] = {"id": p.client.pk, "name": p.client.name} if p.client_id else None
        return data


# ---------- Contracts ----------
class ContractSerializer(serializers.ModelSerializer):
    projectId = serializers.PrimaryKeyRelatedField(source="project", queryset=Project.objects.all())
    title = serializers.SerializerMethodField()
    contractDate = serializers.DateField(source="contract_date")
    startDate = serializers.DateField(source="start_date", required=False, allow_null=True)
    endDate = serializers.DateField(source="end_date", required=False, allow_null=True)
    durationDays = serializers.IntegerField(source="duration_days", required=False, allow_null=True, min_value=0)
    totalValue = serializers.DecimalField(source="total_value", max_digits=14, decimal_places=2, coerce_to_string=False, min_value=Decimal("0"))
    clientName = serializers.CharField(source="client_name")
    clientCompany = serializers.CharField(source="client_company", required=False, allow_blank=True)
    clientRepresentative = serializers.CharField(source="client_representative", required=False, allow_blank=True)
    clientIdNumber = serializers.CharField(source="client_id_number", required=False, allow_blank=True)
    clientAddress = serializers.CharField(source="client_address", required=False, allow_blank=True)
    clientPhone = serializers.CharField(source="client_phone", required=False, allow_blank=True)
    clientEmail = serializers.EmailField(source="client_email", required=False, allow_blank=True)
    scope = serializers.SerializerMethodField()
    clientObligations = serializers.SerializerMethodField()
    extraTerms = serializers.SerializerMethodField()
    warrantyDays = serializers.IntegerField(source="warranty_days", min_value=0, required=False)
    supportMonths = serializers.IntegerField(source="support_months", min_value=0, required=False)
    signedAt = serializers.DateField(source="signed_at", required=False, allow_null=True)
    signedFile = serializers.FileField(source="signed_file", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    BILINGUAL = {"title": "title", "scope": "scope", "clientObligations": "client_obligations", "extraTerms": "extra_terms"}

    class Meta:
        model = Contract
        fields = [
            "id", "projectId", "number", "status", "title", "contractDate", "startDate", "endDate", "durationDays",
            "totalValue", "currency", "clientName", "clientCompany", "clientRepresentative", "clientIdNumber",
            "clientAddress", "clientPhone", "clientEmail", "scope", "deliverables", "installments", "warrantyDays",
            "supportMonths", "clientObligations", "extraTerms", "notes", "signedAt", "signedFile", "createdAt",
        ]
        read_only_fields = ["number"]

    def _pair(self, obj, base):
        return {"ar": getattr(obj, f"{base}_ar"), "en": getattr(obj, f"{base}_en")}

    def get_title(self, obj):
        return self._pair(obj, "title")

    def get_scope(self, obj):
        return self._pair(obj, "scope")

    def get_clientObligations(self, obj):
        return self._pair(obj, "client_obligations")

    def get_extraTerms(self, obj):
        return self._pair(obj, "extra_terms")

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, "copy") else dict(data)
        for k in ("startDate", "endDate", "signedAt", "durationDays"):
            if data.get(k) == "":
                data[k] = None
        values = super().to_internal_value(data)
        for key, base in self.BILINGUAL.items():
            if key in data:
                pair = BilingualField().to_internal_value(data.get(key) or {})
                values[f"{base}_ar"], values[f"{base}_en"] = pair["ar"], pair["en"]
        return values

    def validate_deliverables(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Expected a list")
        return [{"ar": str(i.get("ar", "")).strip(), "en": str(i.get("en", "")).strip()} for i in value if isinstance(i, dict)]

    def validate_installments(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Expected a list")
        clean = []
        for i in value:
            if not isinstance(i, dict):
                continue
            clean.append(
                {
                    "labelAr": str(i.get("labelAr", "")).strip(),
                    "labelEn": str(i.get("labelEn", "")).strip(),
                    "percent": float(i.get("percent") or 0),
                    "amount": float(i.get("amount") or 0),
                    "due": str(i.get("due", "") or ""),
                }
            )
        return clean

    def to_representation(self, obj):
        data = super().to_representation(obj)
        data["signedFile"] = _url(self.context.get("request"), obj.signed_file)
        p = obj.project
        data["project"] = {"id": p.pk, "title": {"ar": p.title_ar, "en": p.title_en}}
        return data


# ---------- Messages ----------
class ContactCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ["name", "email", "phone", "service", "message", "lang"]
        extra_kwargs = {"email": {"required": True, "allow_blank": False}, "message": {"required": True, "allow_blank": False}}


class MessageSerializer(serializers.ModelSerializer):
    read = serializers.BooleanField(source="is_read")
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    preferredContact = serializers.CharField(source="preferred_contact", read_only=True)
    system = serializers.SerializerMethodField()

    class Meta:
        model = ContactMessage
        fields = ["id", "kind", "status", "system", "name", "email", "phone", "company", "preferredContact",
                  "service", "message", "lang", "read", "createdAt"]
        read_only_fields = ["kind", "name", "email", "phone", "company", "service", "message", "lang"]

    def get_system(self, m):
        if not (m.system_id or m.system_title):
            return None
        return {"id": m.system_id, "slug": m.system.slug if m.system_id else "", "title": m.system_title}


def settings_public_dict(s: SiteSettings) -> dict:
    return {
        "email": s.email,
        "phone": s.phone,
        "whatsapp": s.whatsapp,
        "address": {"ar": s.address_ar, "en": s.address_en},
        "partnerName": s.partner_name,
        "partnerUrl": s.partner_url,
        "social": s.social or {},
    }


def settings_admin_dict(s: SiteSettings, request) -> dict:
    return {
        **settings_public_dict(s),
        "companyName": {"ar": s.company_name_ar, "en": s.company_name_en},
        "ceoName": {"ar": s.ceo_name_ar, "en": s.ceo_name_en},
        "commercialReg": s.commercial_reg,
        "taxId": s.tax_id,
        "website": s.website,
        "signature": _url(request, s.signature),
        "notifyEmail": s.notify_email,
        "notifyOrders": s.notify_orders,
        "notifyMessages": s.notify_messages,
        "emailServer": {"configured": django_settings.EMAIL_CONFIGURED, "from": django_settings.DEFAULT_FROM_EMAIL},
    }


class SettingsWriteSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=40)
    whatsapp = serializers.CharField(required=False, allow_blank=True, max_length=40)
    address = BilingualField(required=False)
    partnerName = serializers.CharField(required=False, allow_blank=True, max_length=120)
    partnerUrl = serializers.URLField(required=False, allow_blank=True)
    social = serializers.DictField(child=serializers.CharField(allow_blank=True), required=False)
    companyName = BilingualField(required=False)
    ceoName = BilingualField(required=False)
    commercialReg = serializers.CharField(required=False, allow_blank=True, max_length=60)
    taxId = serializers.CharField(required=False, allow_blank=True, max_length=60)
    website = serializers.URLField(required=False, allow_blank=True)
    notifyEmail = serializers.EmailField(required=False, allow_blank=True)
    notifyOrders = serializers.BooleanField(required=False)
    notifyMessages = serializers.BooleanField(required=False)

    def validate_social(self, value):
        url = serializers.URLField()
        return {k: (url.run_validation(v) if v else "") for k, v in value.items()}

    def apply(self, s: SiteSettings) -> SiteSettings:
        d = self.validated_data
        simple = {"email": "email", "phone": "phone", "whatsapp": "whatsapp", "partnerName": "partner_name", "partnerUrl": "partner_url",
                  "social": "social", "commercialReg": "commercial_reg", "taxId": "tax_id", "website": "website",
                  "notifyEmail": "notify_email", "notifyOrders": "notify_orders", "notifyMessages": "notify_messages"}
        for src, dst in simple.items():
            if src in d:
                setattr(s, dst, d[src])
        for src, base in {"address": "address", "companyName": "company_name", "ceoName": "ceo_name"}.items():
            if src in d:
                setattr(s, f"{base}_ar", d[src]["ar"])
                setattr(s, f"{base}_en", d[src]["en"])
        s.save()
        return s
