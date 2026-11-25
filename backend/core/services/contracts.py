"""Pre-filled contract drafts, shared by the dashboard and the Claude connector."""
from django.utils import timezone

from ..models import Project

STANDARD_SCHEDULE = [
    ("دفعة مقدمة عند توقيع العقد", "Advance payment on signing", 30),
    ("بعد اعتماد التصميم والعرض الأولي", "After design approval and first demo", 30),
    ("عند التسليم للاختبار", "On delivery for acceptance testing", 30),
    ("عند التسليم النهائي", "On final handover", 10),
]


def draft_for(project: Project) -> dict:
    """Unsaved contract payload (ContractSerializer shape) from the project's client, value and dates."""
    c = project.client
    total = float(project.cost)
    return {
        "projectId": project.pk,
        "status": "draft",
        "title": {"ar": f"عقد تنفيذ {project.title_ar or project.title_en}", "en": f"Agreement for {project.title_en or project.title_ar}"},
        "contractDate": timezone.localdate().isoformat(),
        "startDate": project.start_date.isoformat() if project.start_date else "",
        "endDate": project.end_date.isoformat() if project.end_date else "",
        "durationDays": (project.end_date - project.start_date).days if project.start_date and project.end_date else None,
        "totalValue": total,
        "currency": project.currency,
        "clientName": c.name if c else "",
        "clientCompany": c.company if c else "",
        "clientRepresentative": c.name if c else "",
        "clientIdNumber": c.id_number if c else "",
        "clientAddress": c.address if c else "",
        "clientPhone": c.phone if c else "",
        "clientEmail": c.email if c else "",
        "scope": {"ar": project.summary_ar, "en": project.summary_en},
        "deliverables": [],
        "installments": [
            {"labelAr": a, "labelEn": e, "percent": p, "amount": round(total * p / 100, 2), "due": ""} for a, e, p in STANDARD_SCHEDULE
        ],
        "warrantyDays": 90,
        "supportMonths": 3,
        "clientObligations": {"ar": "", "en": ""},
        "extraTerms": {"ar": "", "en": ""},
        "notes": "",
    }
