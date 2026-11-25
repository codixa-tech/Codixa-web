"""PDF downloads: per-project internal / client reports and contracts (Arabic or English)."""
from django.db.models import Prefetch
from django.http import HttpResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import Contract, Payment, Project, ProjectImage
from ..pdf.context import contract_context, project_context
from ..pdf.render import render_pdf


def _lang(request):
    return "en" if request.query_params.get("lang") == "en" else "ar"


def _pdf_response(pdf: bytes, filename: str, request) -> HttpResponse:
    resp = HttpResponse(pdf, content_type="application/pdf")
    disposition = "attachment" if request.query_params.get("download") == "1" else "inline"
    resp["Content-Disposition"] = f'{disposition}; filename="{filename}"'
    resp["Cache-Control"] = "private, no-store"
    return resp


def render_project_report(request, pk, kind: str, lang: str, include_secrets: bool = False):
    project = (
        Project.objects.select_related("client")
        .prefetch_related(
            Prefetch("images", queryset=ProjectImage.objects.order_by("position", "id")),
            Prefetch("payments", queryset=Payment.objects.order_by("date", "id")),
            "contracts",
        )
        .filter(pk=pk)
        .first()
    )
    if not project:
        return Response({"error": "not_found"}, status=404)
    ctx = project_context(project, lang, internal=kind == "internal", include_secrets=kind == "internal" and include_secrets)
    template = "core/pdf/internal_report.html" if kind == "internal" else "core/pdf/client_report.html"
    return _pdf_response(render_pdf(template, ctx), f"codixa-{kind}-report-{project.pk}-{lang}.pdf", request)


def render_contract(request, pk, lang: str):
    contract = Contract.objects.select_related("project").filter(pk=pk).first()
    if not contract:
        return Response({"error": "not_found"}, status=404)
    pdf = render_pdf("core/pdf/contract.html", contract_context(contract, lang))
    return _pdf_response(pdf, f"{contract.number}-{lang}.pdf", request)


@api_view(["GET"])
def project_report(request, pk):
    """?type=client|internal&lang=ar|en&secrets=1 (internal only; includes decrypted credentials)."""
    kind = "internal" if request.query_params.get("type") == "internal" else "client"
    return render_project_report(request, pk, kind, _lang(request), include_secrets=request.query_params.get("secrets") == "1")


@api_view(["GET"])
def contract_pdf(request, pk):
    return render_contract(request, pk, _lang(request))
