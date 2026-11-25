from django.core.management.base import BaseCommand

from core.services.notify import send_pending


class Command(BaseCommand):
    help = "Send queued notification e-mails and retry failed ones (run from cron every few minutes)."

    def handle(self, *args, **opts):
        sent, failed = send_pending()
        if sent or failed:
            self.stdout.write(f"sent {sent}, failed {failed}")
