"""Builds template context for PDFs from models (all data loaded up front, no queries in templates)."""
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from .. import schema
from ..models import Contract, Project, SiteSettings
from .strings import T

FONTS_DIR = Path(__file__).resolve().parent.parent / "static" / "core" / "fonts"


def money(value, currency) -> str:
    v = Decimal(value or 0)
    text = f"{v:,.2f}".rstrip("0").rstrip(".") if v % 1 else f"{v:,.0f}"
    return f"{text} {currency}"


def fdate(d) -> str:
    return d.strftime("%d/%m/%Y") if d else "—"


def file_uri(f) -> str:
    try:
        return Path(f.path).as_uri() if f else ""
    except (ValueError, NotImplementedError):
        return ""


def _value_text(category, key, value, lang):
    if isinstance(value, dict) and ("ar" in value or "en" in value):
        return value.get(lang) or value.get("en") or value.get("ar") or ""
    if isinstance(value, list):
        return "، ".join(str(schema.option_label(category, key, v, lang)) for v in value) if lang == "ar" else ", ".join(
            str(schema.option_label(category, key, v, lang)) for v in value
        )
    if isinstance(value, bool):
        return ("نعم" if value else "لا") if lang == "ar" else ("Yes" if value else "No")
    return str(schema.option_label(category, key, value, lang))


def detail_rows(project: Project, lang: str, *, include_internal: bool) -> list[tuple[str, str]]:
    """Ordered (label, value) rows. Client reports get public fields; internal reports get all non-secret ones."""
    cat = schema.category(project.category) or {"fields": []}
    rows = []
    for f in cat["fields"]:
        if f.get("secret"):
            continue
        if not include_internal and not f.get("public"):
            continue
        v = (project.details or {}).get(f["key"])
        if v in (None, "", [], {}):
            continue
        rows.append((f["label"].get(lang) or f["label"]["en"], _value_text(project.category, f["key"], v, lang)))
    return rows


def secret_rows(project: Project, lang: str) -> list[tuple[str, str]]:
    cat = schema.category(project.category) or {"fields": []}
    secrets = project.secrets or {}
    return [
        (f["label"].get(lang) or f["label"]["en"], str(secrets[f["key"]]))
        for f in cat["fields"]
        if f.get("secret") and secrets.get(f["key"]) not in (None, "")
    ]


def company(lang: str) -> dict:
    s = SiteSettings.load()
    return {
        "name": s.company_name_ar if lang == "ar" else s.company_name_en,
        "name_other": s.company_name_en if lang == "ar" else s.company_name_ar,
        "name_ar": s.company_name_ar,
        "ceo": s.ceo_name_ar if lang == "ar" else s.ceo_name_en,
        "ceo_en": s.ceo_name_en,
        "ceo_ar": s.ceo_name_ar,
        "email": s.email,
        "phone": s.phone,
        "website": s.website.replace("https://", "").replace("http://", "").rstrip("/"),
        "address": s.address_ar if lang == "ar" else s.address_en,
        "commercial_reg": s.commercial_reg,
        "tax_id": s.tax_id,
        "signature": file_uri(s.signature),
    }


STAMP_RING = "CODIXA \u2022 TECHNICAL SOLUTIONS \u2022 CAIRO \u2022 EGYPT \u2022 "


def stamp_ring() -> list[dict]:
    """Letters of the circular stamp text with their rotation angles."""
    n = len(STAMP_RING)
    # Angles as strings: template number localisation (Arabic) must not turn "7.66" into "7,66".
    return [{"c": ch, "a": f"{i * 360 / n:.2f}"} for i, ch in enumerate(STAMP_RING)]


def base(lang: str, doc_title: str, doc_no: str = "") -> dict:
    return {
        "stamp_ring": stamp_ring(),
        "lang": lang,
        "dir": "rtl" if lang == "ar" else "ltr",
        "t": T[lang],
        "doc_title": doc_title,
        "doc_no": doc_no,
        "today": fdate(timezone.localdate()),
        "company": company(lang),
        "fonts_dir": FONTS_DIR.as_uri(),
    }


def project_context(project: Project, lang: str, *, internal: bool, include_secrets: bool = False) -> dict:
    t = T[lang]
    cat = schema.category(project.category) or {}
    payments = list(project.payments.all().order_by("date", "id"))
    paid = sum((p.amount for p in payments), Decimal("0"))
    c = project.client
    title = t["internal_report"] if internal else t["client_report"]
    ctx = base(lang, title, f"PRJ-{project.pk:05d}")
    ctx.update(
        {
            "internal": internal,
            "project": {
                "title": project.title(lang),
                "summary": project.summary(lang),
                "category": (cat.get("single") or {}).get(lang, project.category),
                "status": schema.status_label(project.status, lang),
                "progress": project.progress,
                "start": fdate(project.start_date),
                "end": fdate(project.end_date),
            },
            "client": (
                {
                    "name": c.name,
                    "company": c.company,
                    "email": c.email,
                    "phone": c.phone,
                    "country": c.country,
                    "address": c.address,
                    "id_number": c.id_number,
                }
                if c
                else None
            ),
            "details": detail_rows(project, lang, include_internal=internal),
            # Thumbnails (640 px) are sharp at the printed size and keep the PDF small.
            "images": [file_uri(i.thumb or i.image) for i in project.images.all()[:4] if (i.thumb or i.image)],
            "has_money": project.cost > 0,
            "total": money(project.cost, project.currency),
            "paid": money(paid, project.currency),
            "remaining": money(project.cost - paid, project.currency),
            "paid_pct": int(min(100, (paid / project.cost * 100))) if project.cost else 0,
            "payments": [
                {
                    "date": fdate(p.date),
                    "amount": money(p.amount, project.currency),
                    "method": schema.payment_method_label(p.method, lang),
                    "reference": p.reference,
                    "note": p.note,
                }
                for p in payments
            ],
            "contracts": [
                {"number": k.number, "date": fdate(k.contract_date), "status": k.get_status_display(), "value": money(k.total_value, k.currency)}
                for k in project.contracts.all()
            ]
            if internal
            else [],
            "secrets": secret_rows(project, lang) if (internal and include_secrets) else [],
            "secrets_hidden": internal and not include_secrets and bool(project.secrets),
        }
    )
    return ctx


def contract_context(contract: Contract, lang: str) -> dict:
    t = T[lang]
    k = contract
    title = (k.title_ar if lang == "ar" else k.title_en) or t["contract"]
    ctx = base(lang, t["contract"], k.number)
    days = t["c_days"].format(n=k.duration_days) if k.duration_days else ""
    total = money(k.total_value, k.currency)
    project_title = k.project.title(lang)
    clauses = [
        (t["c_subject"], [t["c_subject_text"].format(project=project_title)], None),
    ]
    scope = (k.scope_ar if lang == "ar" else k.scope_en) or (k.scope_en or k.scope_ar)
    if scope:
        clauses.append((t["c_scope"], [p for p in scope.splitlines() if p.strip()], None))
    deliverables = [(d.get(lang) or d.get("en") or d.get("ar")) for d in (k.deliverables or [])]
    deliverables = [d for d in deliverables if d]
    if deliverables:
        clauses.append((t["c_deliverables"], [], deliverables))
    clauses.append(
        (t["c_duration"], [t["c_duration_text"].format(start=fdate(k.start_date or k.contract_date), end=fdate(k.end_date), days=days)], None)
    )
    clauses.append(("__payments__", [t["c_value_text"].format(value=total)], None))
    obligations = (k.client_obligations_ar if lang == "ar" else k.client_obligations_en) or t["c_obligations_default"]
    clauses += [
        (t["c_obligations"], [p for p in obligations.splitlines() if p.strip()], None),
        (t["c_changes"], [t["c_changes_text"]], None),
        (t["c_ip"], [t["c_ip_text"]], None),
        (t["c_confidential"], [t["c_confidential_text"]], None),
        (t["c_warranty"], [t["c_warranty_text"].format(warranty=k.warranty_days, support=k.support_months)], None),
        (t["c_termination"], [t["c_termination_text"]], None),
    ]
    extra = k.extra_terms_ar if lang == "ar" else k.extra_terms_en
    if extra:
        clauses.append((t["c_extra"], [p for p in extra.splitlines() if p.strip()], None))
    clauses.append((t["c_copies"], [t["c_copies_text"]], None))

    ctx.update(
        {
            "contract": {
                "number": k.number,
                "title": title,
                "date": fdate(k.contract_date),
                "total": total,
                "status": k.status,
            },
            "party": {
                "name": k.client_name,
                "company": k.client_company,
                "representative": k.client_representative,
                "id_number": k.client_id_number,
                "address": k.client_address,
                "phone": k.client_phone,
                "email": k.client_email,
            },
            "project_title": project_title,
            "preamble": t["preamble"].format(date=fdate(k.contract_date)),
            "clauses": clauses,
            "installments": [
                {
                    "label": (i.get("labelAr") if lang == "ar" else i.get("labelEn")) or i.get("labelEn") or i.get("labelAr") or "",
                    "percent": f"{i.get('percent', 0):g}%",
                    "amount": money(i.get("amount", 0), k.currency),
                    "due": i.get("due", ""),
                }
                for i in (k.installments or [])
            ],
        }
    )
    return ctx
