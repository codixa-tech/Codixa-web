"""E-mail notifications for new website messages and store orders.

Messages are written to EmailOutbox first, so nothing is lost if SMTP is down: they are sent in a
background thread right after the request, and the `send_emails` command (cron) retries failures.
"""
import logging
import re
import threading

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import close_old_connections, transaction
from django.template.loader import render_to_string
from django.utils import timezone

from ..models import ContactMessage, EmailOutbox, SiteSettings

log = logging.getLogger(__name__)
MAX_ATTEMPTS = 5


def recipient(site: SiteSettings) -> str:
    return site.notify_email or site.email


def _wa(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("00"):
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:  # Egyptian local mobile 01xxxxxxxxx
        digits = "2" + digits
    return f"https://wa.me/{digits}" if len(digits) >= 8 else ""


def notify_new_message(msg: ContactMessage) -> EmailOutbox | None:
    site = SiteSettings.load()
    is_order = msg.kind == ContactMessage.Kind.ORDER
    if (is_order and not site.notify_orders) or (not is_order and not site.notify_messages):
        return None
    to = recipient(site)
    if not to:
        return None
    base = settings.PUBLIC_BASE_URL or ""
    ctx = {
        "m": msg,
        "is_order": is_order,
        "wa": _wa(msg.phone),
        "dashboard": f"{base}/dashboard/messages?open={msg.pk}",
        "system_url": f"{base}/store/{msg.system.slug}" if msg.system_id else "",
        "when": timezone.localtime(msg.created_at).strftime("%Y-%m-%d %H:%M"),
    }
    subject = (
        f"طلب حجز جديد: {msg.system_title} — {msg.name}" if is_order else f"رسالة جديدة من الموقع — {msg.name}"
    )
    out = EmailOutbox.objects.create(
        to=to,
        reply_to=msg.email,
        subject=subject[:250],
        text=render_to_string("core/email/new_message.txt", ctx),
        html=render_to_string("core/email/new_message.html", ctx),
        message=msg,
    )
    if settings.EMAIL_SEND_INLINE:
        transaction.on_commit(lambda: _send_in_background(out.pk))
    return out


def _send_in_background(pk: int) -> None:
    def run():
        try:
            send_one(pk)
        finally:
            close_old_connections()

    threading.Thread(target=run, daemon=True, name=f"email-{pk}").start()


def _smtp_missing() -> bool:
    """Production without SMTP settings: keep the e-mail queued instead of printing it to the log."""
    return not settings.EMAIL_CONFIGURED and not settings.DEBUG and settings.EMAIL_BACKEND.endswith("console.EmailBackend")


def send_one(pk: int) -> bool:
    out = EmailOutbox.objects.filter(pk=pk).first()
    if not out or out.status == EmailOutbox.Status.SENT:
        return True
    if _smtp_missing():
        out.status, out.last_error = EmailOutbox.Status.SKIPPED, "EMAIL_HOST is not set"
        out.save(update_fields=["status", "last_error"])
        return False
    out.attempts += 1
    try:
        email = EmailMultiAlternatives(
            subject=out.subject,
            body=out.text,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[out.to],
            reply_to=[out.reply_to] if out.reply_to else None,
        )
        if out.html:
            email.attach_alternative(out.html, "text/html")
        email.send(fail_silently=False)
    except Exception as exc:  # noqa: BLE001 — any SMTP/network error is recorded and retried
        log.warning("E-mail %s failed: %s", out.pk, exc)
        out.status = EmailOutbox.Status.FAILED
        out.last_error = str(exc)[:500]
        out.save(update_fields=["status", "attempts", "last_error"])
        return False
    out.status, out.sent_at, out.last_error = EmailOutbox.Status.SENT, timezone.now(), ""
    out.save(update_fields=["status", "attempts", "sent_at", "last_error"])
    return True


def send_pending() -> tuple[int, int]:
    """Send queued and failed (under the retry limit) e-mails. Returns (sent, failed)."""
    sent = failed = 0
    qs = EmailOutbox.objects.filter(
        status__in=[EmailOutbox.Status.PENDING, EmailOutbox.Status.FAILED, EmailOutbox.Status.SKIPPED],
        attempts__lt=MAX_ATTEMPTS,
    ).order_by("created_at")[:50]
    for out in qs:
        if send_one(out.pk):
            sent += 1
        else:
            failed += 1
    return sent, failed


def send_test(to: str) -> str | None:
    """Send a test e-mail synchronously. Returns an error message, or None on success."""
    if _smtp_missing():
        return "E-mail is not configured on the server (EMAIL_HOST is empty)."
    try:
        EmailMultiAlternatives(
            subject="Codixa — test e-mail / رسالة تجريبية",
            body="E-mail notifications from your website work.\nإشعارات البريد من موقعك تعمل.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[to],
        ).send(fail_silently=False)
    except Exception as exc:  # noqa: BLE001
        return str(exc)[:300]
    return None
