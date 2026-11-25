from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import ProjectImage, ProjectVideo


class Command(BaseCommand):
    help = "Delete uploads that were never attached to a project (older than 24 hours)."

    def handle(self, *args, **opts):
        cutoff = timezone.now() - timedelta(hours=24)
        n = 0
        for model in (ProjectImage, ProjectVideo):
            for obj in model.objects.filter(project__isnull=True, created_at__lt=cutoff):
                obj.delete()  # signal removes the files
                n += 1
        self.stdout.write(f"removed {n} orphan uploads")
