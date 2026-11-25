from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from analytics.models import Visit


class Command(BaseCommand):
    help = "Delete page-view rows older than --days (default 400) to keep the table small."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=400)

    def handle(self, *args, **opts):
        cutoff = timezone.localdate() - timedelta(days=opts["days"])
        n, _ = Visit.objects.filter(day__lt=cutoff).delete()
        self.stdout.write(f"deleted {n}")
