import json
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from analytics.models import Visit
from core.models import ContactMessage
from store.models import System

CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"
IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"


@override_settings(PUBLIC_BASE_URL="https://codixa.test")
class TrackTests(TestCase):
    def setUp(self):
        cache.clear()

    def hit(self, path="/", ua=CHROME, ip="41.33.1.1", **extra):
        body = {"p": path, "r": "", "tz": "Africa/Cairo", "l": "ar", "f": 1, **extra}
        return self.client.post("/api/public/track/", json.dumps(body), content_type="application/json",
                                 HTTP_USER_AGENT=ua, REMOTE_ADDR=ip)

    def test_records_a_page_view(self):
        self.assertEqual(self.hit("/erpnext/?utm_campaign=x").status_code, 204)
        v = Visit.objects.get()
        self.assertEqual((v.path, v.source, v.device, v.browser, v.os, v.country, v.lang),
                         ("/erpnext", "direct", "desktop", "Chrome", "Windows", "EG", "ar"))
        self.assertEqual(len(v.visitor), 16)

    def test_ignores_bots_dashboard_and_junk(self):
        self.hit(ua="Mozilla/5.0 (compatible; Googlebot/2.1)")
        self.hit(ua="")
        self.hit("/dashboard/projects")
        self.hit("https://evil.example/")
        self.client.post("/api/public/track/", "not json", content_type="application/json", HTTP_USER_AGENT=CHROME)
        self.assertEqual(Visit.objects.count(), 0)

    def test_visitors_sources_and_devices(self):
        self.hit("/", r="https://www.google.com.eg/")
        self.hit("/store", f=0, r="https://codixa.test/")
        self.hit("/", ua=IPHONE, ip="5.5.5.5", r="https://l.facebook.com/x", tz="Asia/Riyadh")
        self.hit("/en", ip="6.6.6.6", r="https://codixa.test/en/erpnext")
        rows = list(Visit.objects.order_by("id").values_list("visitor", "source", "device", "country"))
        self.assertEqual(rows[0][0], rows[1][0])  # same person, same day
        self.assertNotEqual(rows[0][0], rows[2][0])
        self.assertEqual([r[1] for r in rows], ["Google", "", "Facebook", ""])
        self.assertEqual(rows[2][2:], ("mobile", "SA"))

    def test_flood_limit(self):
        for _ in range(70):
            self.hit()
        self.assertEqual(Visit.objects.count(), 60)


@override_settings(PUBLIC_BASE_URL="https://codixa.test")
class OverviewTests(TestCase):
    def test_overview_numbers(self):
        staff = User.objects.create_user("owner", password="x", is_staff=True)
        api = APIClient()
        api.force_authenticate(staff)
        today = timezone.localdate()
        s = System.objects.create(slug="crm", title_ar="سي آر إم", title_en="CRM", published=True)
        rows = [
            (today, "/", "a", "Google"), (today, "/store/crm", "a", ""), (today, "/en/store/crm", "b", "direct"),
            (today - timedelta(days=1), "/", "a", "direct"),  # same hash, another day → another visit
            (today - timedelta(days=40), "/", "z", "direct"),  # previous 30-day period
        ]
        for day, path, visitor, source in rows:
            Visit.objects.create(day=day, path=path, visitor=visitor, source=source, device="desktop")
        ContactMessage.objects.create(kind="order", system=s, system_title="CRM", name="x", phone="0100")
        ContactMessage.objects.create(kind="contact", name="y", email="y@x.com", message="m")

        d = api.get("/api/analytics/overview/?days=30").json()
        self.assertEqual(d["totals"]["visitors"], 3)
        self.assertEqual(d["totals"]["views"], 4)
        self.assertEqual((d["totals"]["orders"], d["totals"]["messages"]), (1, 1))
        self.assertEqual(len(d["series"]), 30)
        self.assertEqual(d["series"][-1], {"t": today.isoformat(), "views": 3, "visitors": 2})
        self.assertEqual(d["pages"][0]["key"], "/")
        self.assertEqual({x["key"] for x in d["sources"]}, {"Google", "direct"})
        self.assertEqual(d["store"], [{"slug": "crm", "title": {"ar": "سي آر إم", "en": "CRM"}, "views": 2, "visitors": 2, "orders": 1}])

        today_only = api.get("/api/analytics/overview/?days=1").json()
        self.assertEqual(len(today_only["series"]), 24)
        self.assertEqual(today_only["totals"]["visitors"], 2)
