"""Sequential, human-readable contract numbers: CDX-2026-0001."""
from django.db import transaction
from django.utils import timezone

PREFIX = "CDX"


def next_contract_number() -> str:
    from ..models import Contract

    year = timezone.localdate().year
    stem = f"{PREFIX}-{year}-"
    with transaction.atomic():
        last = (
            Contract.objects.select_for_update()
            .filter(number__startswith=stem)
            .order_by("-number")
            .values_list("number", flat=True)
            .first()
        )
        seq = int(last.rsplit("-", 1)[1]) + 1 if last else 1
        return f"{stem}{seq:04d}"
