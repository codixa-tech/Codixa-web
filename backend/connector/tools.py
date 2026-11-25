"""Tools Claude can call through the connector.

Rules enforced here (not left to the model):
  * Project credentials (every field marked `secret` in categories.json) are never returned and can't be written.
  * Nothing can be deleted. Media is only appended; projects, clients and contracts are only created or edited.
  * Every call is written to the activity log with the approving user.
"""
import base64
import binascii
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.core import signing
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.db.models import Count, F as models_F, Max, Prefetch, Q
from rest_framework import serializers as drf

from core import schema
from core.models import Client, ContactMessage, Contract, Payment, Project, ProjectImage, ProjectVideo
from core.serializers import ClientSerializer, ContractSerializer, PaymentSerializer, ProjectWriteSerializer, project_admin_dict
from core.services import images as image_service
from core.services import videos as video_service
from core.services.contracts import draft_for
from core.services.finance import with_money
from core.services.numbering import next_contract_number

from . import fetch

PDF_LINK_SALT = "codixa.connector.pdf"
PDF_LINK_MAX_AGE = 15 * 60


class ToolError(Exception):
    """A problem Claude should read and fix (bad input, not found). Returned as isError content."""


@dataclass
class Ctx:
    user: object
    base: str
    ip: str | None


@dataclass
class Tool:
    name: str
    title: str
    description: str
    schema: dict
    func: object
    read_only: bool


REGISTRY: dict[str, Tool] = {}


def tool(name, title, description, properties=None, required=(), read_only=False):
    def deco(func):
        REGISTRY[name] = Tool(
            name=name,
            title=title,
            description=description,
            schema={"type": "object", "properties": properties or {}, "required": list(required), "additionalProperties": False},
            func=func,
            read_only=read_only,
        )
        return func

    return deco


# ------------------------------------------------------------------ helpers
def _abs(ctx: Ctx, url: str) -> str:
    return f"{ctx.base}{url}" if url and url.startswith("/") else url


def _project_qs():
    return with_money(
        Project.objects.select_related("client").prefetch_related(
            Prefetch("images", queryset=ProjectImage.objects.order_by("position", "id")),
            Prefetch("videos", queryset=ProjectVideo.objects.order_by("position", "id")),
        )
    ).annotate(contracts_count=Count("contracts", distinct=True))


def _get_project(pk) -> Project:
    p = _project_qs().filter(pk=_int(pk, "project_id")).first()
    if not p:
        raise ToolError(f"No project with id {pk}. Use search_projects to find the right id.")
    return p


def _int(v, name) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        raise ToolError(f"{name} must be a number") from None


def project_out(p: Project, ctx: Ctx) -> dict:
    d = project_admin_dict(p, None)
    secret = schema.secret_keys(p.category)
    d["details"] = {k: v for k, v in (p.details or {}).items() if k not in secret}
    d["hasCredentials"] = bool(p.secrets)
    for m in d["images"]:
        m["src"], m["thumb"] = _abs(ctx, m["src"]), _abs(ctx, m["thumb"])
    for m in d["videos"]:
        m["src"], m["poster"] = _abs(ctx, m["src"]), _abs(ctx, m["poster"])
    d["dashboardUrl"] = f"{ctx.base}/dashboard/projects/{p.pk}"
    return d


def project_brief(p: Project) -> dict:
    return {
        "id": p.pk,
        "title": {"ar": p.title_ar, "en": p.title_en},
        "category": p.category,
        "status": p.status,
        "published": p.published,
        "client": (p.client.company or p.client.name) if p.client_id else None,
        "cost": float(p.cost),
        "paid": float(getattr(p, "paid_total", 0) or 0),
        "currency": p.currency,
    }


def _validation_message(exc: drf.ValidationError) -> str:
    def flat(detail, prefix=""):
        if isinstance(detail, dict):
            return [m for k, v in detail.items() for m in flat(v, f"{prefix}{k}: ")]
        if isinstance(detail, list):
            return [m for v in detail for m in flat(v, prefix)]
        return [f"{prefix}{detail}"]

    return "Invalid input — " + "; ".join(flat(exc.detail))


def _check_details(category: str, details: dict) -> dict:
    if not isinstance(details, dict):
        raise ToolError("details must be an object of field_key: value")
    cat = schema.category(category)
    known = {f["key"] for f in cat["fields"]}
    secret = schema.secret_keys(category)
    blocked = sorted(k for k in details if k in secret)
    if blocked:
        raise ToolError(
            f"These fields hold credentials and can only be entered in the dashboard: {', '.join(blocked)}. "
            "Remove them and try again."
        )
    unknown = sorted(k for k in details if k not in known)
    if unknown:
        raise ToolError(f"Unknown fields for category '{category}': {', '.join(unknown)}. Call get_catalog for valid keys.")
    return details


PROJECT_FIELDS = {
    "category": {"type": "string", "description": "Category key from get_catalog (web, mobile, desktop, erp, robotics, training)."},
    "title_ar": {"type": "string", "description": "Project name in Arabic."},
    "title_en": {"type": "string", "description": "Project name in English."},
    "summary_ar": {"type": "string", "description": "Short public description in Arabic (2–4 sentences)."},
    "summary_en": {"type": "string", "description": "Short public description in English (2–4 sentences)."},
    "client_id": {"type": ["integer", "null"], "description": "Client id from search_clients / create_client."},
    "show_client": {"type": "boolean", "description": "Show the client's name on the public website."},
    "status": {"type": "string", "enum": ["planning", "in_progress", "on_hold", "completed"]},
    "progress": {"type": "integer", "minimum": 0, "maximum": 100},
    "featured": {"type": "boolean", "description": "Highlight on the home page."},
    "published": {"type": "boolean", "description": "Visible on the public website. Only set true when the user asks to publish."},
    "start_date": {"type": ["string", "null"], "format": "date", "description": "YYYY-MM-DD"},
    "end_date": {"type": ["string", "null"], "format": "date", "description": "YYYY-MM-DD"},
    "cost": {"type": "number", "minimum": 0, "description": "Total contract value."},
    "currency": {"type": "string", "enum": ["EGP", "SAR", "USD", "AED", "EUR"]},
    "details": {
        "type": "object",
        "description": "Category-specific fields (keys from get_catalog), e.g. {\"live_url\": \"https://…\", \"stack\": [\"Django\", \"React\"]}. "
        "Credential fields are rejected.",
    },
}

ARG_TO_PAYLOAD = {
    "category": "category",
    "client_id": "clientId",
    "show_client": "showClient",
    "status": "status",
    "progress": "progress",
    "featured": "featured",
    "published": "published",
    "start_date": "startDate",
    "end_date": "endDate",
    "cost": "cost",
    "currency": "currency",
}


def _save_project(instance: Project | None, args: dict, ctx: Ctx) -> Project:
    if instance:
        payload = {
            "kind": instance.kind,
            "category": instance.category,
            "title": {"ar": instance.title_ar, "en": instance.title_en},
            "summary": {"ar": instance.summary_ar, "en": instance.summary_en},
            "clientId": instance.client_id,
            "showClient": instance.show_client,
            "status": instance.status,
            "progress": instance.progress,
            "featured": instance.featured,
            "published": instance.published,
            "startDate": instance.start_date.isoformat() if instance.start_date else None,
            "endDate": instance.end_date.isoformat() if instance.end_date else None,
            "cost": str(instance.cost),
            "currency": instance.currency,
            # Existing credentials pass through untouched so an edit never wipes them.
            "details": {**(instance.details or {}), **(instance.secrets or {})},
        }
    else:
        payload = {"status": "planning", "published": False, "summary": {"ar": "", "en": ""}, "details": {}, "title": {"ar": "", "en": ""}}

    for arg, key in ARG_TO_PAYLOAD.items():
        if arg in args:
            payload[key] = args[arg]
    for lang in ("ar", "en"):
        if f"title_{lang}" in args:
            payload["title"][lang] = args[f"title_{lang}"] or ""
        if f"summary_{lang}" in args:
            payload["summary"][lang] = args[f"summary_{lang}"] or ""

    category = payload.get("category")
    if not category or not schema.category(category):
        raise ToolError("category is required and must be one of the keys from get_catalog")
    payload["kind"] = schema.category(category)["kind"]
    if "details" in args:
        payload["details"].update(_check_details(category, args["details"]))

    s = ProjectWriteSerializer(data=payload)
    try:
        s.is_valid(raise_exception=True)
    except drf.ValidationError as exc:
        raise ToolError(_validation_message(exc)) from None
    return s.save_project(instance)


# ------------------------------------------------------------------ catalog & overview
@tool(
    "get_catalog",
    "Get categories and fields",
    "List project categories with their custom fields (keys, types, options), project statuses, currencies and payment "
    "methods. Call this before creating a project so details use valid keys. Credential fields are not listed.",
    read_only=True,
)
def get_catalog(ctx, args):
    data = schema.load_schema()
    cats = []
    for c in data["categories"]:
        fields = []
        for f in c["fields"]:
            if f.get("secret"):
                continue
            item = {"key": f["key"], "type": f["type"], "label": f["label"], "public": bool(f.get("public"))}
            if f.get("options"):
                item["options"] = [o["v"] if isinstance(o, dict) else o for o in f["options"]]
            fields.append(item)
        cats.append({"key": c["key"], "kind": c["kind"], "label": c["label"], "fields": fields})
    return {
        "categories": cats,
        "statuses": [s["key"] for s in data["statuses"]],
        "currencies": data["currencies"],
        "paymentMethods": [m["key"] for m in data["paymentMethods"]],
        "notes": "Public fields appear on the website. Write both Arabic and English titles and summaries.",
    }


@tool(
    "get_overview",
    "Dashboard overview",
    "Project counts by status, money totals per currency (contract value, received, outstanding), unread website "
    "messages and the projects with the largest unpaid balance.",
    read_only=True,
)
def get_overview(ctx, args):
    rows = list(with_money(Project.objects.select_related("client")))
    by_status, money = {}, {}
    for p in rows:
        by_status[p.status] = by_status.get(p.status, 0) + 1
        if p.cost > 0:
            m = money.setdefault(p.currency, {"contract": 0.0, "received": 0.0, "outstanding": 0.0})
            m["contract"] += float(p.cost)
            m["received"] += float(p.paid_total)
            m["outstanding"] += float(max(p.cost - p.paid_total, Decimal("0")))
    unpaid = sorted((p for p in rows if p.cost - p.paid_total > 0), key=lambda p: p.paid_total - p.cost)[:8]
    return {
        "projects": len(rows),
        "byStatus": by_status,
        "money": money,
        "unreadMessages": ContactMessage.objects.filter(is_read=False).count(),
        "largestUnpaid": [{**project_brief(p), "remaining": float(p.cost - p.paid_total)} for p in unpaid],
    }


# ------------------------------------------------------------------ projects
@tool(
    "search_projects",
    "Search projects",
    "Find projects by name or client, optionally filtered. Returns short summaries with ids.",
    {
        "query": {"type": "string", "description": "Part of the project name (Arabic or English) or client name."},
        "category": {"type": "string"},
        "status": {"type": "string", "enum": ["planning", "in_progress", "on_hold", "completed"]},
        "limit": {"type": "integer", "minimum": 1, "maximum": 50, "default": 20},
    },
    read_only=True,
)
def search_projects(ctx, args):
    qs = with_money(Project.objects.select_related("client"))
    if args.get("category"):
        qs = qs.filter(category=args["category"])
    if args.get("status"):
        qs = qs.filter(status=args["status"])
    q = (args.get("query") or "").strip()
    if q:
        qs = qs.filter(Q(title_ar__icontains=q) | Q(title_en__icontains=q) | Q(client__name__icontains=q) | Q(client__company__icontains=q))
    limit = min(max(_int(args.get("limit", 20), "limit"), 1), 50)
    items = [project_brief(p) for p in qs[:limit]]
    return {"count": len(items), "projects": items}


@tool(
    "get_project",
    "Get project",
    "Full project record: texts, client, dates, money (cost, paid, remaining), custom fields, images and videos. "
    "Credentials are never included; hasCredentials tells whether some are stored.",
    {"project_id": {"type": "integer"}},
    ["project_id"],
    read_only=True,
)
def get_project(ctx, args):
    return project_out(_get_project(args.get("project_id")), ctx)


@tool(
    "create_project",
    "Create project",
    "Create a project or training. New projects are hidden from the website (published=false) unless the user asked "
    "to publish. Provide Arabic and English title and summary. Add images afterwards with add_project_image.",
    PROJECT_FIELDS,
    ["category", "title_ar", "title_en"],
)
def create_project(ctx, args):
    p = _save_project(None, args, ctx)
    return {"created": True, "project": project_out(_get_project(p.pk), ctx)}


@tool(
    "update_project",
    "Update project",
    "Change some fields of an existing project. Only the fields you pass change; everything else (including stored "
    "credentials and media) stays as it is. details are merged into the existing custom fields.",
    {"project_id": {"type": "integer"}, **PROJECT_FIELDS},
    ["project_id"],
)
def update_project(ctx, args):
    p = _get_project(args.get("project_id"))
    _save_project(p, {k: v for k, v in args.items() if k != "project_id"}, ctx)
    return {"updated": True, "project": project_out(_get_project(p.pk), ctx)}


# ------------------------------------------------------------------ media
@tool(
    "add_project_image",
    "Add project image",
    "Add one image to a project from a public link (direct image URL, Google Drive or Dropbox share link) or base64 "
    "data. The image is resized and compressed to WebP automatically. Call once per image.",
    {
        "project_id": {"type": "integer"},
        "image_url": {"type": "string", "description": "Public link to the image."},
        "image_base64": {"type": "string", "description": "Image bytes as base64 (alternative to image_url)."},
        "filename": {"type": "string"},
        "make_cover": {"type": "boolean", "description": "Put this image first (cover)."},
    },
    ["project_id"],
)
def add_project_image(ctx, args):
    p = _get_project(args.get("project_id"))
    max_bytes = settings.IMAGE_MAX_UPLOAD_MB * 1024 * 1024
    if args.get("image_url"):
        try:
            data, _, name = fetch.download(args["image_url"], max_bytes)
        except fetch.FetchError as exc:
            raise ToolError(str(exc)) from None
    elif args.get("image_base64"):
        raw = args["image_base64"].split(",", 1)[-1] if args["image_base64"].startswith("data:") else args["image_base64"]
        try:
            data = base64.b64decode(raw, validate=False)
        except (binascii.Error, ValueError):
            raise ToolError("image_base64 is not valid base64") from None
        if len(data) > max_bytes:
            raise ToolError(f"Image is larger than {settings.IMAGE_MAX_UPLOAD_MB} MB")
        name = args.get("filename") or "image"
    else:
        raise ToolError("Pass image_url or image_base64")

    with transaction.atomic():
        count = ProjectImage.objects.select_for_update().filter(project=p).count()
        if count >= settings.MAX_IMAGES_PER_PROJECT:
            raise ToolError(f"This project already has {count} images (limit {settings.MAX_IMAGES_PER_PROJECT}).")
        try:
            processed = image_service.process_upload(SimpleUploadedFile(name or "image", data))
        except image_service.ImageError as exc:
            raise ToolError("The link is not an image Codixa can read" if str(exc) == "not_image" else f"Image rejected: {exc}") from None
        if args.get("make_cover"):
            for img in ProjectImage.objects.filter(project=p):
                img.position += 1
                img.save(update_fields=["position"])
            position = 0
        else:
            position = (ProjectImage.objects.filter(project=p).aggregate(m=Max("position"))["m"] or -1) + 1
        img = ProjectImage.objects.create(project=p, position=position, **processed)
    return {
        "added": True,
        "image": {"id": img.pk, "src": _abs(ctx, img.image.url), "width": img.width, "height": img.height,
                  "originalKB": round(img.original_bytes / 1024), "storedKB": round(img.bytes / 1024)},
        "imagesOnProject": count + 1,
    }


VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm", "video/x-matroska", "video/x-msvideo", "application/octet-stream"}


@tool(
    "add_project_video",
    "Add project video",
    f"Add a short video or reel (max {settings.VIDEO_MAX_SECONDS} seconds, {settings.VIDEO_MAX_UPLOAD_MB} MB) to a "
    "project from a public link. It is converted to 720p MP4 in the background; state becomes 'ready' when done.",
    {"project_id": {"type": "integer"}, "video_url": {"type": "string"}},
    ["project_id", "video_url"],
)
def add_project_video(ctx, args):
    p = _get_project(args.get("project_id"))
    try:
        data, ctype, name = fetch.download(args["video_url"], settings.VIDEO_MAX_UPLOAD_MB * 1024 * 1024)
    except fetch.FetchError as exc:
        raise ToolError(str(exc)) from None
    if ctype and ctype not in VIDEO_TYPES and not ctype.startswith("video/"):
        raise ToolError(f"The link is not a video (got {ctype})")
    if "." not in name:
        name += ".mp4"
    position = (ProjectVideo.objects.filter(project=p).aggregate(m=Max("position"))["m"] or -1) + 1
    video = ProjectVideo.objects.create(project=p, position=position, file=ContentFile(data, name=name), name=name[:200], bytes=len(data))
    meta = video_service.probe(video.file.path)
    if video_service.ffmpeg_available() and not meta["width"]:
        video.delete()
        raise ToolError("The file is not a readable video")
    if meta["duration"] > settings.VIDEO_MAX_SECONDS + 1:
        video.delete()
        raise ToolError(f"Video is {meta['duration']} seconds; the limit is {settings.VIDEO_MAX_SECONDS}")
    video.width, video.height, video.duration = meta["width"], meta["height"], meta["duration"]
    video.save()
    video_service.transcode_async(video.pk)
    return {"added": True, "video": {"id": video.pk, "state": video.state, "duration": video.duration}}


# ------------------------------------------------------------------ clients
CLIENT_FIELDS = {
    "name": {"type": "string", "description": "Contact person or client name."},
    "company": {"type": "string"},
    "email": {"type": "string"},
    "phone": {"type": "string"},
    "country": {"type": "string"},
    "address": {"type": "string"},
    "id_number": {"type": "string", "description": "National ID or commercial registration (used on contracts)."},
    "notes": {"type": "string"},
}
CLIENT_MAP = {"id_number": "idNumber"}


def _client_payload(args):
    return {CLIENT_MAP.get(k, k): v for k, v in args.items() if k in CLIENT_FIELDS}


@tool(
    "search_clients",
    "Search clients",
    "Find clients by name, company, email or phone. Use before create_client to avoid duplicates.",
    {"query": {"type": "string"}, "limit": {"type": "integer", "minimum": 1, "maximum": 50, "default": 20}},
    read_only=True,
)
def search_clients(ctx, args):
    qs = Client.objects.annotate(projects_count=Count("projects"))
    q = (args.get("query") or "").strip()
    if q:
        qs = qs.filter(Q(name__icontains=q) | Q(company__icontains=q) | Q(email__icontains=q) | Q(phone__icontains=q))
    limit = min(max(_int(args.get("limit", 20), "limit"), 1), 50)
    out = []
    for c in qs[:limit]:
        d = ClientSerializer(c).data
        d["projectsCount"] = c.projects_count
        out.append(d)
    return {"count": len(out), "clients": out}


@tool(
    "create_client",
    "Create client",
    "Add a client. If a client with the same name, email or phone exists you get it back instead; pass "
    "allow_duplicate=true only if the user confirms it is a different client.",
    {**CLIENT_FIELDS, "allow_duplicate": {"type": "boolean"}},
    ["name"],
)
def create_client(ctx, args):
    if not args.get("allow_duplicate"):
        cond = Q(name__iexact=args["name"].strip())
        if args.get("email"):
            cond |= Q(email__iexact=args["email"].strip())
        if args.get("phone"):
            cond |= Q(phone=args["phone"].strip())
        existing = Client.objects.filter(cond).first()
        if existing:
            return {"created": False, "reason": "A matching client already exists", "client": ClientSerializer(existing).data}
    s = ClientSerializer(data=_client_payload(args))
    try:
        s.is_valid(raise_exception=True)
    except drf.ValidationError as exc:
        raise ToolError(_validation_message(exc)) from None
    return {"created": True, "client": ClientSerializer(s.save()).data}


@tool(
    "update_client",
    "Update client",
    "Change some fields of a client. Only passed fields change.",
    {"client_id": {"type": "integer"}, **CLIENT_FIELDS},
    ["client_id"],
)
def update_client(ctx, args):
    c = Client.objects.filter(pk=_int(args.get("client_id"), "client_id")).first()
    if not c:
        raise ToolError("No client with that id")
    s = ClientSerializer(c, data=_client_payload(args), partial=True)
    try:
        s.is_valid(raise_exception=True)
    except drf.ValidationError as exc:
        raise ToolError(_validation_message(exc)) from None
    return {"updated": True, "client": ClientSerializer(s.save()).data}


# ------------------------------------------------------------------ payments
@tool(
    "list_payments",
    "List payments",
    "Payments received for a project, with totals.",
    {"project_id": {"type": "integer"}},
    ["project_id"],
    read_only=True,
)
def list_payments(ctx, args):
    p = _get_project(args.get("project_id"))
    pays = Payment.objects.filter(project=p).select_related("project", "project__client").order_by("date", "id")
    return {
        "project": project_brief(p),
        "remaining": float(p.cost - p.paid_total),
        "payments": PaymentSerializer(pays, many=True).data,
    }


@tool(
    "record_payment",
    "Record payment",
    "Record money received for a project. Warns (but still records) if it pays more than the remaining balance.",
    {
        "project_id": {"type": "integer"},
        "amount": {"type": "number", "exclusiveMinimum": 0},
        "date": {"type": "string", "format": "date", "description": "YYYY-MM-DD"},
        "method": {"type": "string", "enum": ["bank", "cash", "instapay", "wallet", "card", "other"]},
        "reference": {"type": "string", "description": "Transfer number or receipt reference."},
        "note": {"type": "string"},
    },
    ["project_id", "amount", "date"],
)
def record_payment(ctx, args):
    p = _get_project(args.get("project_id"))
    try:
        amount = Decimal(str(args["amount"]))
    except (InvalidOperation, KeyError):
        raise ToolError("amount must be a number") from None
    s = PaymentSerializer(
        data={"projectId": p.pk, "amount": str(amount), "date": args.get("date"), "method": args.get("method", "bank"),
              "reference": args.get("reference", ""), "note": args.get("note", "")}
    )
    try:
        s.is_valid(raise_exception=True)
    except drf.ValidationError as exc:
        raise ToolError(_validation_message(exc)) from None
    remaining_before = p.cost - p.paid_total
    pay = s.save()
    out = {"recorded": True, "payment": PaymentSerializer(pay).data, "remaining": float(remaining_before - amount), "currency": p.currency}
    if amount > remaining_before:
        out["warning"] = f"This payment is more than the remaining balance ({float(remaining_before)} {p.currency})."
    return out


# ------------------------------------------------------------------ contracts
@tool(
    "list_contracts",
    "List contracts",
    "Contracts of a project (number, status, value, dates).",
    {"project_id": {"type": "integer"}},
    ["project_id"],
    read_only=True,
)
def list_contracts(ctx, args):
    p = _get_project(args.get("project_id"))
    items = Contract.objects.filter(project=p).select_related("project")
    return {"contracts": [
        {"id": c.pk, "number": c.number, "status": c.status, "title": {"ar": c.title_ar, "en": c.title_en},
         "contractDate": c.contract_date.isoformat(), "totalValue": float(c.total_value), "currency": c.currency}
        for c in items
    ]}


@tool(
    "create_contract",
    "Create contract draft",
    "Create a draft contract for a project, pre-filled from the project and its client (value, dates, standard "
    "30/30/30/10 payment schedule, 90-day warranty, 3 months support). Optional fields override the defaults. "
    "The user reviews and signs it from the dashboard.",
    {
        "project_id": {"type": "integer"},
        "title_ar": {"type": "string"},
        "title_en": {"type": "string"},
        "scope_ar": {"type": "string", "description": "Scope of work in Arabic."},
        "scope_en": {"type": "string", "description": "Scope of work in English."},
        "deliverables": {"type": "array", "items": {"type": "object", "properties": {"ar": {"type": "string"}, "en": {"type": "string"}}}},
        "installments": {
            "type": "array",
            "description": "Payment schedule; percents should add up to 100.",
            "items": {"type": "object", "properties": {
                "labelAr": {"type": "string"}, "labelEn": {"type": "string"}, "percent": {"type": "number"}, "due": {"type": "string"}}},
        },
        "contract_date": {"type": "string", "format": "date"},
        "warranty_days": {"type": "integer", "minimum": 0},
        "support_months": {"type": "integer", "minimum": 0},
        "client_representative": {"type": "string"},
        "notes": {"type": "string"},
    },
    ["project_id"],
)
def create_contract(ctx, args):
    p = _get_project(args.get("project_id"))
    if not p.client_id:
        raise ToolError("The project has no client. Link a client with update_project first.")
    data = draft_for(p)
    total = float(p.cost)
    for lang in ("ar", "en"):
        if f"title_{lang}" in args:
            data["title"][lang] = args[f"title_{lang}"]
        if f"scope_{lang}" in args:
            data["scope"][lang] = args[f"scope_{lang}"]
    if "deliverables" in args:
        data["deliverables"] = args["deliverables"]
    if "installments" in args:
        inst = args["installments"]
        pct = sum(float(i.get("percent") or 0) for i in inst)
        if inst and abs(pct - 100) > 0.01:
            raise ToolError(f"Installment percents add up to {pct}, not 100")
        data["installments"] = [{**i, "amount": round(total * float(i.get("percent") or 0) / 100, 2)} for i in inst]
    simple = {"contract_date": "contractDate", "warranty_days": "warrantyDays", "support_months": "supportMonths",
              "client_representative": "clientRepresentative", "notes": "notes"}
    for arg, key in simple.items():
        if arg in args:
            data[key] = args[arg]
    s = ContractSerializer(data=data)
    try:
        s.is_valid(raise_exception=True)
    except drf.ValidationError as exc:
        raise ToolError(_validation_message(exc)) from None
    contract = s.save(number=next_contract_number())
    return {"created": True, "contract": {"id": contract.pk, "number": contract.number, "status": contract.status,
                                          "totalValue": float(contract.total_value), "currency": contract.currency},
            "pdf": pdf_link(ctx, "contract", contract.pk, "ar")}


# ------------------------------------------------------------------ PDFs
def pdf_link(ctx: Ctx, document: str, obj_id: int, lang: str) -> dict:
    token = signing.dumps({"d": document, "id": obj_id, "l": lang, "u": ctx.user.pk}, salt=PDF_LINK_SALT, compress=True)
    return {"url": f"{ctx.base}/api/pdf/{token}/", "expiresInMinutes": PDF_LINK_MAX_AGE // 60}


@tool(
    "get_pdf_link",
    "Get PDF link",
    "A temporary download link (valid 15 minutes) for a client report, an internal report (without credentials) or a "
    "contract PDF. Give the link to the user; don't fetch it yourself.",
    {
        "document": {"type": "string", "enum": ["client_report", "internal_report", "contract"]},
        "id": {"type": "integer", "description": "Project id for reports, contract id for contracts."},
        "lang": {"type": "string", "enum": ["ar", "en"], "default": "ar"},
    },
    ["document", "id"],
    read_only=True,
)
def get_pdf_link(ctx, args):
    doc = args.get("document")
    obj_id = _int(args.get("id"), "id")
    lang = "en" if args.get("lang") == "en" else "ar"
    if doc == "contract":
        if not Contract.objects.filter(pk=obj_id).exists():
            raise ToolError("No contract with that id")
    elif doc in ("client_report", "internal_report"):
        if not Project.objects.filter(pk=obj_id).exists():
            raise ToolError("No project with that id")
    else:
        raise ToolError("document must be client_report, internal_report or contract")
    return pdf_link(ctx, doc, obj_id, lang)


def read_pdf_token(token: str) -> dict:
    return signing.loads(token, salt=PDF_LINK_SALT, max_age=timedelta(seconds=PDF_LINK_MAX_AGE))


# ------------------------------------------------------------------ store (المتجر)
from store.models import System, SystemImage  # noqa: E402
from store.serializers import SystemWriteSerializer, system_admin  # noqa: E402


def _system_out(s: System, ctx: Ctx) -> dict:
    d = system_admin(s, None)
    for m in d["images"]:
        m["src"], m["thumb"] = _abs(ctx, m["src"]), _abs(ctx, m["thumb"])
    if d.get("cover"):
        d["cover"]["src"], d["cover"]["thumb"] = _abs(ctx, d["cover"]["src"]), _abs(ctx, d["cover"]["thumb"])
    d["publicUrl"] = f"{ctx.base}/store/{s.slug}"
    d["dashboardUrl"] = f"{ctx.base}/dashboard/store/{s.pk}"
    return d


def _get_system(pk) -> System:
    s = System.objects.prefetch_related("images").filter(pk=_int(pk, "system_id")).first()
    if not s:
        raise ToolError(f"No store system with id {pk}. Use search_systems to find it.")
    return s


SYSTEM_FIELDS = {
    "title_ar": {"type": "string"},
    "title_en": {"type": "string"},
    "tagline_ar": {"type": "string", "description": "One-line summary in Arabic (shown on the card and in search results)."},
    "tagline_en": {"type": "string"},
    "description_ar": {"type": "string", "description": "Rich description as HTML: <h2>, <h3>, <p>, <strong>, <em>, <u>, <ul>/<ol>/<li>, <blockquote>, <a href>, and <span style=\"color: #2563eb; font-size: 20px\">. Unsafe markup is removed."},
    "description_en": {"type": "string"},
    "category": {"type": "string", "enum": [c for c, _ in System.Category.choices]},
    "highlights": {"type": "array", "items": {"type": "object", "properties": {"ar": {"type": "string"}, "en": {"type": "string"}}}, "description": "Key features (first 3 show on the card)."},
    "requirements": {"type": "array", "items": {"type": "object", "properties": {"ar": {"type": "string"}, "en": {"type": "string"}}}, "description": "What the client needs: server, database, browsers…"},
    "price": {"type": ["number", "null"], "minimum": 0, "description": "Leave null for 'price on request'."},
    "currency": {"type": "string", "enum": ["EGP", "SAR", "USD", "AED", "EUR"]},
    "price_note_ar": {"type": "string", "description": "e.g. يبدأ من"},
    "price_note_en": {"type": "string", "description": "e.g. Starting from"},
    "demo_url": {"type": "string"},
    "slug": {"type": "string", "description": "Page address in Latin letters, e.g. clinic-manager."},
    "featured": {"type": "boolean"},
    "published": {"type": "boolean", "description": "Visible in the public store. Only true when the user asks to publish."},
}


def _save_system(instance: System | None, args: dict) -> System:
    def pair(name, src=None):
        src = src or name
        cur = {"ar": getattr(instance, f"{src}_ar", "") if instance else "", "en": getattr(instance, f"{src}_en", "") if instance else ""}
        for lang in ("ar", "en"):
            if f"{name}_{lang}" in args:
                cur[lang] = args[f"{name}_{lang}"] or ""
        return cur

    payload = {
        "title": pair("title"),
        "tagline": pair("tagline"),
        "priceNote": pair("price_note"),
        "slug": args.get("slug", instance.slug if instance else ""),
    }
    if instance is None or "description_ar" in args or "description_en" in args:
        payload["description"] = pair("description")
    for arg, key in (("category", "category"), ("highlights", "highlights"), ("requirements", "requirements"), ("price", "price"),
                     ("currency", "currency"), ("demo_url", "demoUrl"), ("featured", "featured"), ("published", "published")):
        if arg in args:
            payload[key] = args[arg]
    if instance is None:
        payload.setdefault("published", False)
    s = SystemWriteSerializer(data=payload)
    try:
        s.is_valid(raise_exception=True)
    except drf.ValidationError as exc:
        raise ToolError(_validation_message(exc)) from None
    return s.save_system(instance)


@tool("search_systems", "Search store systems", "List the ready-made systems in the store (المتجر), optionally filtered by name.",
      {"query": {"type": "string"}}, read_only=True)
def search_systems(ctx, args):
    qs = System.objects.annotate(orders_count=Count("orders", filter=Q(orders__kind="order")))
    q = (args.get("query") or "").strip()
    if q:
        qs = qs.filter(Q(title_ar__icontains=q) | Q(title_en__icontains=q) | Q(slug__icontains=q))
    return {"systems": [{"id": s.pk, "slug": s.slug, "title": {"ar": s.title_ar, "en": s.title_en}, "published": s.published,
                         "price": float(s.price) if s.price is not None else None, "currency": s.currency, "orders": s.orders_count}
                        for s in qs[:50]]}


@tool("get_system", "Get store system", "Full store system record with description HTML, features, requirements and images.",
      {"system_id": {"type": "integer"}}, ["system_id"], read_only=True)
def get_system(ctx, args):
    return _system_out(_get_system(args.get("system_id")), ctx)


@tool("create_system", "Create store system",
      "Add a ready-made system to the store. Hidden from the public store until published=true (ask the user first). "
      "Write Arabic and English title, tagline and description; add images afterwards with add_system_image.",
      SYSTEM_FIELDS, ["title_ar", "title_en"])
def create_system(ctx, args):
    s = _save_system(None, args)
    return {"created": True, "system": _system_out(_get_system(s.pk), ctx)}


@tool("update_system", "Update store system", "Change some fields of a store system; fields you leave out stay as they are.",
      {"system_id": {"type": "integer"}, **SYSTEM_FIELDS}, ["system_id"])
def update_system(ctx, args):
    s = _get_system(args.get("system_id"))
    _save_system(s, {k: v for k, v in args.items() if k != "system_id"})
    return {"updated": True, "system": _system_out(_get_system(s.pk), ctx)}


@tool("add_system_image", "Add store system image",
      "Add a screenshot to a store system from a public link (or base64). Compressed to WebP automatically; the first image is the cover.",
      {"system_id": {"type": "integer"}, "image_url": {"type": "string"}, "image_base64": {"type": "string"},
       "filename": {"type": "string"}, "make_cover": {"type": "boolean"}},
      ["system_id"])
def add_system_image(ctx, args):
    s = _get_system(args.get("system_id"))
    max_bytes = settings.IMAGE_MAX_UPLOAD_MB * 1024 * 1024
    if args.get("image_url"):
        try:
            data, _, name = fetch.download(args["image_url"], max_bytes)
        except fetch.FetchError as exc:
            raise ToolError(str(exc)) from None
    elif args.get("image_base64"):
        try:
            data = base64.b64decode(args["image_base64"].split(",", 1)[-1])
        except (binascii.Error, ValueError):
            raise ToolError("image_base64 is not valid base64") from None
        name = args.get("filename") or "image"
    else:
        raise ToolError("Pass image_url or image_base64")
    with transaction.atomic():
        count = SystemImage.objects.select_for_update().filter(system=s).count()
        if count >= settings.MAX_IMAGES_PER_PROJECT:
            raise ToolError(f"This system already has {count} images.")
        try:
            processed = image_service.process_upload(SimpleUploadedFile(name or "image", data))
        except image_service.ImageError:
            raise ToolError("The link is not an image Codixa can read") from None
        if args.get("make_cover"):
            SystemImage.objects.filter(system=s).update(position=models_F("position") + 1)
            position = 0
        else:
            position = (SystemImage.objects.filter(system=s).aggregate(m=Max("position"))["m"] or -1) + 1
        img = SystemImage.objects.create(system=s, position=position, **processed)
    return {"added": True, "image": {"id": img.pk, "src": _abs(ctx, img.image.url), "width": img.width, "height": img.height}}


@tool("list_orders", "List booking requests",
      "Recent store booking requests and contact messages (name, phone, email, system, status). Use when the user asks who booked.",
      {"kind": {"type": "string", "enum": ["order", "contact"]}, "status": {"type": "string", "enum": ["new", "contacted", "won", "closed"]},
       "limit": {"type": "integer", "minimum": 1, "maximum": 50, "default": 20}},
      read_only=True)
def list_orders(ctx, args):
    qs = ContactMessage.objects.select_related("system")
    if args.get("kind"):
        qs = qs.filter(kind=args["kind"])
    if args.get("status"):
        qs = qs.filter(status=args["status"])
    limit = min(max(_int(args.get("limit", 20), "limit"), 1), 50)
    return {"items": [
        {"id": m.pk, "kind": m.kind, "status": m.status, "system": m.system_title, "name": m.name, "phone": m.phone,
         "email": m.email, "company": m.company, "preferredContact": m.preferred_contact, "message": m.message,
         "createdAt": m.created_at.isoformat()}
        for m in qs[:limit]
    ]}
