from django.core.management.base import BaseCommand

from core.models import ProjectVideo
from core.services.videos import transcode


class Command(BaseCommand):
    help = "Re-encode pending/failed videos to H.264 720p (run from cron if VIDEO_TRANSCODE_INLINE=false)."

    def add_arguments(self, parser):
        parser.add_argument("--retry-failed", action="store_true")

    def handle(self, *args, **opts):
        states = [ProjectVideo.State.PENDING] + ([ProjectVideo.State.FAILED] if opts["retry_failed"] else [])
        for video in ProjectVideo.objects.filter(state__in=states):
            transcode(video)
            self.stdout.write(f"video {video.pk}: {video.state}")
