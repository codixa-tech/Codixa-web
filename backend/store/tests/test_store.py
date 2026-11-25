import tempfile
from pathlib import Path
from unittest import mock

from django.contrib.auth.models import User
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from core.models import ContactMessage, EmailOutbox, SiteSettings
from core.services import notify
from core.services.richtext import sanitize_html
from core.tests.test_api import png_bytes
from store.models import System

TEMPLATE = (
    '<!doctype html><html lang="ar" dir="rtl"><head><title>Home</title><!--store-head--></head>'
    '<body><div id="root"><!--store-shell--></div></body></html>'
)

SYSTEM = {
    "title": {"ar": "نظام إدارة العيادات", "en": "Clinic Manager"},
    "tagline": {"ar": "مواعيد وملفات مرضى وفواتير", "en": "Appointments, records and billing"},
    "category": "healthcare",
    "description": {
        "ar": '<h2>عن النظام</h2><p style="text-align: center; position: fixed">نص <strong>عريض</strong> '
              '<span style="color: #2563eb; font-size: 24px">ملوّن</span></p><script>alert(1)</script>'
              '<img src="/media/editor/x.webp" onerror="steal()">',
        "en": "<p>Text <em>italic</em></p>",
    },
    "highlights": [{"ar": "حجز مواعيد أونلاين", "en": "Online booking"}, {"ar": "", "en": ""}],
    "requirements": [{"ar": "سيرفر Ubuntu 22.04 و 4GB رام", "en": "Ubuntu 22.04 server, 4 GB RAM"}],
    "price": "15000",
    "currency": "EGP",
    "priceNote": {"ar": "يبدأ من", "en": "Starting from"},
    "published": True,
}

TEST_SETTINGS = dict(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    EMAIL_SEND_INLINE=False,
    PUBLIC_BASE_URL="https://codixa.test",
    STORAGES={"default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
              "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"}},
)


@override_settings(**TEST_SETTINGS)
class StoreBase(TestCase):
    def setUp(self):
        cache.clear()
        self.staff = User.objects.create_user("owner", password="x", is_staff=True)
        self.api = APIClient()
        self.api.force_authenticate(self.staff)
        self.public = APIClient()

    def create_system(self, **over):
        img = self.api.post("/api/store/images/", {"file": png_bytes()}, format="multipart")
        self.assertEqual(img.status_code, 201, img.content)
        r = self.api.post("/api/systems/", {**SYSTEM, "images": [{"id": img.json()["id"]}], **over}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()


class RichTextTests(TestCase):
    def test_keeps_formatting_and_removes_code(self):
        out = sanitize_html(SYSTEM["description"]["ar"])
        self.assertIn("<strong>عريض</strong>", out)
        self.assertIn("color: #2563eb; font-size: 24px", out)
        self.assertIn('style="text-align: center"', out)
        for bad in ("script", "position", "onerror", "steal"):
            self.assertNotIn(bad, out)
        self.assertIn('<img src="/media/editor/x.webp">', out)

    def test_rejects_unsafe_urls_and_sizes(self):
        out = sanitize_html('<a href="javascript:x()">a</a><img src="data:image/png;base64,AAA">'
                            '<span style="font-size: 900px; color: expression(alert(1))">t</span>')
        self.assertNotIn("javascript", out)
        self.assertNotIn("data:", out)
        self.assertNotIn("900px", out)
        self.assertNotIn("expression", out)
        self.assertEqual(sanitize_html("<p></p>"), "")


class StoreApiTests(StoreBase):
    def test_create_and_public_views(self):
        data = self.create_system()
        self.assertEqual(data["slug"], "clinic-manager")
        self.assertEqual(len(data["highlights"]), 1)  # empty row dropped
        self.assertNotIn("<script", data["description"]["ar"])
        self.assertEqual(len(data["images"]), 1)

        listing = self.public.get("/api/public/systems/").json()
        self.assertEqual([s["slug"] for s in listing], ["clinic-manager"])
        self.assertIsNotNone(listing[0]["cover"])
        self.assertNotIn("description", listing[0])

        detail = self.public.get("/api/public/systems/clinic-manager/").json()
        self.assertEqual(detail["price"], {"amount": 15000.0, "currency": "EGP", "note": {"ar": "يبدأ من", "en": "Starting from"}})
        self.assertIn("<strong>", detail["description"]["ar"])

    def test_unpublished_hidden_and_slugs_unique(self):
        first = self.create_system()
        second = self.create_system(published=False)
        self.assertEqual(second["slug"], "clinic-manager-2")
        self.assertEqual(self.public.get("/api/public/systems/clinic-manager-2/").status_code, 404)
        self.assertEqual(len(self.public.get("/api/public/systems/").json()), 1)
        # Editing keeps the slug and the cache is refreshed
        r = self.api.put(f"/api/systems/{first['id']}/", {**SYSTEM, "slug": "clinic-manager", "title": {"ar": "جديد", "en": "New"}}, format="json")
        self.assertEqual(r.json()["slug"], "clinic-manager")
        self.assertEqual(self.public.get("/api/public/systems/").json()[0]["title"]["en"], "New")

    def test_editor_image_upload(self):
        r = self.api.post("/api/store/editor-images/", {"file": png_bytes()}, format="multipart")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.json()["src"].startswith("/media/editor/"))

    def test_dashboard_endpoints_need_staff(self):
        nonstaff = APIClient()
        nonstaff.force_authenticate(User.objects.create_user("v", password="x"))
        for method, url in [("get", "/api/systems/"), ("post", "/api/systems/"), ("post", "/api/store/images/"),
                            ("post", "/api/store/editor-images/"), ("get", "/api/analytics/overview/"),
                            ("post", "/api/settings/test-email/")]:
            with self.subTest(url=url):
                self.assertEqual(getattr(self.public, method)(url).status_code, 401)
                self.assertEqual(getattr(nonstaff, method)(url).status_code, 403)


class OrderTests(StoreBase):
    def order(self, **over):
        body = {"name": "Ahmed Ali", "phone": "01012345678", "email": "ahmed@example.com", "company": "Nile Clinic",
                "preferredContact": "whatsapp", "message": "عايز نسخة لفرعين", "lang": "ar", **over}
        return self.public.post("/api/public/systems/clinic-manager/order/", body, format="json")

    def test_order_lands_in_messages_and_sends_email(self):
        self.create_system()
        r = self.order()
        self.assertEqual(r.status_code, 201, r.content)
        msg = ContactMessage.objects.get()
        self.assertEqual((msg.kind, msg.system_title, msg.status), ("order", "نظام إدارة العيادات", "new"))

        listed = self.api.get("/api/messages/?kind=order").json()
        self.assertEqual(listed[0]["system"]["slug"], "clinic-manager")
        self.assertEqual(self.api.get("/api/messages/?kind=contact").json(), [])

        self.assertEqual(notify.send_pending(), (1, 0))
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertEqual(email.to, ["info@codixa.tech"])
        self.assertEqual(email.reply_to, ["ahmed@example.com"])
        self.assertIn("نظام إدارة العيادات", email.subject)
        html = email.alternatives[0][0]
        self.assertIn("https://wa.me/201012345678", html)
        self.assertIn("https://codixa.test/dashboard/messages?open=", html)
        self.assertEqual(EmailOutbox.objects.get().status, "sent")

        upd = self.api.patch(f"/api/messages/{msg.pk}/", {"status": "contacted", "read": True}, format="json")
        self.assertEqual(upd.json()["status"], "contacted")

    def test_email_is_queued_after_commit(self):
        self.create_system()
        with self.captureOnCommitCallbacks() as callbacks:
            with self.settings(EMAIL_SEND_INLINE=True):
                self.order()
        self.assertEqual(len(callbacks), 1)

    def test_validation_honeypot_and_limits(self):
        self.create_system()
        self.assertEqual(self.order(phone="12").status_code, 400)
        self.assertEqual(self.order(preferredContact="email", email="").status_code, 400)
        self.assertEqual(self.order(website="http://spam").status_code, 201)
        self.assertEqual(ContactMessage.objects.count(), 0)
        self.assertEqual(self.public.post("/api/public/systems/nope/order/", {}, format="json").status_code, 404)
        codes = [self.order().status_code for _ in range(6)]
        self.assertEqual(codes.count(201), 2)  # 6/hour; the four requests above count too
        self.assertEqual(codes[-1], 429)

    def test_notification_settings(self):
        self.create_system()
        s = SiteSettings.load()
        s.notify_email, s.notify_orders = "boss@example.com", False
        s.save()
        self.order()
        self.assertFalse(EmailOutbox.objects.exists())
        r = self.public.post("/api/public/contact/", {"name": "Sara", "email": "s@example.com", "message": "hi"}, format="json")
        self.assertEqual(r.status_code, 201)
        notify.send_pending()
        self.assertEqual(mail.outbox[0].to, ["boss@example.com"])
        self.assertIn("Sara", mail.outbox[0].subject)

    def test_failed_smtp_is_retried(self):
        self.create_system()
        self.order()
        with mock.patch("django.core.mail.EmailMultiAlternatives.send", side_effect=OSError("SMTP down")):
            self.assertEqual(notify.send_pending(), (0, 1))
        out = EmailOutbox.objects.get()
        self.assertEqual((out.status, out.attempts), ("failed", 1))
        self.assertIn("SMTP down", out.last_error)
        self.assertEqual(notify.send_pending(), (1, 0))
        self.assertEqual(len(mail.outbox), 1)

    def test_test_email_endpoint(self):
        r = self.api.post("/api/settings/test-email/", {}, format="json")
        self.assertEqual(r.json(), {"ok": True, "to": "info@codixa.tech", "error": None})
        self.assertEqual(len(mail.outbox), 1)
        settings_data = self.api.get("/api/settings/").json()
        self.assertIn("emailServer", settings_data)
        self.assertTrue(settings_data["notifyOrders"])


class StoreSeoTests(StoreBase):
    def setUp(self):
        super().setUp()
        self.tmp = tempfile.TemporaryDirectory()
        Path(self.tmp.name, "_store.html").write_text(TEMPLATE, encoding="utf-8")
        self.override = override_settings(FRONTEND_DIST=self.tmp.name)
        self.override.enable()

    def tearDown(self):
        self.override.disable()
        self.tmp.cleanup()

    def test_store_pages_render_head_and_text(self):
        self.create_system()
        self.create_system(published=False, title={"ar": "مخفي", "en": "Hidden"})
        page = self.client.get("/store/clinic-manager")
        html = page.content.decode()
        self.assertEqual(page.status_code, 200)
        self.assertEqual(html.count("<title>"), 1)
        self.assertIn("<title>نظام إدارة العيادات | كوديكسا</title>", html)
        self.assertIn('<link rel="canonical" href="https://codixa.test/store/clinic-manager"', html)
        self.assertIn('"@type": "SoftwareApplication"', html)
        self.assertIn('"price": "15000.00"', html)
        self.assertIn("Ubuntu 22.04", html)
        self.assertNotIn("<script>alert", html)

        en = self.client.get("/en/store/clinic-manager/").content.decode()
        self.assertIn('<html lang="en" dir="ltr">', en)
        self.assertIn("Clinic Manager | Codixa", en)

        listing = self.client.get("/store").content.decode()
        self.assertIn('href="/store/clinic-manager"', listing)
        self.assertNotIn("Hidden", listing)

        self.assertEqual(self.client.get("/store/clinic-manager-2").status_code, 404)
        self.assertEqual(self.client.get("/store/missing").status_code, 404)

        sitemap = self.client.get("/sitemap-store.xml").content.decode()
        self.assertIn("https://codixa.test/en/store/clinic-manager", sitemap)
        self.assertNotIn("clinic-manager-2", sitemap)
