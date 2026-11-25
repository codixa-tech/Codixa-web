"""Money aggregation helpers used by API lists, stats and reports (one query, no N+1)."""
from decimal import Decimal

from django.db.models import DecimalField, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce

ZERO = Value(Decimal("0"), output_field=DecimalField(max_digits=14, decimal_places=2))


def paid_subquery():
    from ..models import Payment

    return Coalesce(
        Subquery(
            Payment.objects.filter(project=OuterRef("pk"))
            .values("project")
            .annotate(total=Sum("amount"))
            .values("total")[:1],
            output_field=DecimalField(max_digits=14, decimal_places=2),
        ),
        ZERO,
    )


def with_money(qs):
    """Annotate a Project queryset with `paid_total` and `payments_count`."""
    from django.db.models import Count

    return qs.annotate(paid_total=paid_subquery(), payments_count=Count("payments", distinct=True))
