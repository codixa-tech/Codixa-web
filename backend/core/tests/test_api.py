import io
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from cryptography.fernet import Fernet
from PIL import Image
from rest_framework.test import APIClient

from core.models import Client, Contract, Payment, Project, ProjectImage


def png_bytes(w=2400, h=1600):
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (37, 99, 235)).save(buf, "PNG")
    buf.seek(0)
    buf.name = "photo.png"
    return buf


PROJECT = {
    "kind": "project",
    "category": "web",
    "title": {"ar": "موقع تجريبي", "en": ""},
    "summary": {"ar": "وصف", "en": "Summary"},
    "status": "in_progress",
    "progress": 40,
    "published": True,
    "cost": "10000",
    "currency": "EGP",
    "startDate": "2026-01-01",
    "endDate": "",
    "details": {"live_url": "https://example.com", "stack": ["Django"], "admin_password": "S3cret!", "server_ip": "10.0.0.1", "unknown": "x"},
}


@override_settings(FIELD_ENCRYPTION_KEY=Fernet.generate_key().decode())
class Base(TestCase):
    def setUp(self):
        cache.clear()
        self.staff = User.objects.create_user("admin", password="pass-12345-xyz", is_staff=True)
        self.api = APIClient()
        self.api.force_authenticate(self.staff)
        self.anon = APIClient()


class AuthTests(Base):
    def test_dashboard_requires_staff(self):
        self.assertEqual(self.anon.get("/api/projects/").status_code, 401)
        user = User.objects.create_user("bob", password="pass-12345-xyz")
        c = APIClient()
        c.force_authenticate(user)
        self.assertEqual(c.get("/api/projects/").status_code, 403)

    def test_jwt_login(self):
        r = self.anon.post("/api/auth/token/", {"username": "admin", "password": "pass-12345-xyz"}, format="json")
        self.assertEqual(r.status_code, 200)
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        self.assertEqual(c.get("/api/auth/me/").data["username"], "admin")


class ProjectTests(Base):
    def test_create_splits_and_encrypts_secrets(self):
        r = self.api.post("/api/projects/", PROJECT, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["details"]["admin_password"], "S3cret!")
        self.assertNotIn("unknown", r.data["details"])
        p = Project.objects.get()
        self.assertEqual(p.secrets["server_ip"], "10.0.0.1")
        self.assertNotIn("admin_password", p.details)
        with connection.cursor() as cur:
            cur.execute("SELECT secrets FROM core_project")
            raw = cur.fetchone()[0]
        self.assertNotIn("S3cret", raw)  # encrypted at rest

    def test_public_endpoint_hides_private_data(self):
        client = Client.objects.create(name="Ali", email="ali@example.com")
        self.api.post("/api/projects/", {**PROJECT, "clientId": client.pk, "showClient": False}, format="json")
        r = self.anon.get("/api/public/projects/")
        self.assertEqual(r.status_code, 200)
        item = r.data[0]
        self.assertEqual(set(item["details"]), {"live_url", "stack"})
        self.assertNotIn("cost", item)
        self.assertIsNone(item["client"])
        self.assertNotIn("S3cret", str(r.data))

    def test_public_cache_is_invalidated_on_change(self):
        self.api.post("/api/projects/", PROJECT, format="json")
        self.assertEqual(len(self.anon.get("/api/public/projects/").data), 1)
        p = Project.objects.get()
        self.api.put(f"/api/projects/{p.pk}/", {**PROJECT, "published": False}, format="json")
        self.assertEqual(len(self.anon.get("/api/public/projects/").data), 0)

    def test_list_has_money_and_no_n_plus_one(self):
        for i in range(5):
            p = Project.objects.create(category="web", title_en=f"P{i}", cost=Decimal("1000"))
            Payment.objects.create(project=p, amount=Decimal("250"), date="2026-01-01")
        with CaptureQueriesContext(connection) as ctx:
            r = self.api.get("/api/projects/")
        self.assertEqual(r.data[0]["paid"], 250.0)
        self.assertEqual(r.data[0]["remaining"], 750.0)
        self.assertLessEqual(len(ctx.captured_queries), 6)

    def test_image_upload_is_resized_to_webp_and_attached_in_order(self):
        a = self.api.post("/api/media/images/", {"file": png_bytes()}, format="multipart")
        b = self.api.post("/api/media/images/", {"file": png_bytes(800, 600)}, format="multipart")
        self.assertEqual(a.status_code, 201, a.data)
        self.assertLessEqual(max(a.data["w"], a.data["h"]), 1920)
        self.assertTrue(a.data["src"].endswith(".webp"))
        r = self.api.post("/api/projects/", {**PROJECT, "images": [{"id": b.data["id"]}, {"id": a.data["id"]}]}, format="json")
        self.assertEqual([i["id"] for i in r.data["images"]], [b.data["id"], a.data["id"]])
        r = self.api.put(f"/api/projects/{r.data['id']}/", {**PROJECT, "images": [{"id": a.data["id"]}]}, format="json")
        self.assertEqual(ProjectImage.objects.count(), 1)

    def test_rejects_non_image(self):
        f = io.BytesIO(b"not an image")
        f.name = "x.png"
        self.assertEqual(self.api.post("/api/media/images/", {"file": f}, format="multipart").status_code, 400)


class ContractAndReportTests(Base):
    def setUp(self):
        super().setUp()
        self.client_obj = Client.objects.create(name="Sara", company="ACME", id_number="CR-1")
        self.project = Project.objects.create(category="erp", title_ar="نظام", title_en="System", cost=Decimal("50000"), client=self.client_obj)

    def test_draft_and_sequential_numbers(self):
        d = self.api.get("/api/contracts/draft/", {"projectId": self.project.pk}).data
        self.assertEqual(d["clientCompany"], "ACME")
        self.assertEqual(sum(i["percent"] for i in d["installments"]), 100)
        r1 = self.api.post("/api/contracts/", d, format="json")
        r2 = self.api.post("/api/contracts/", d, format="json")
        self.assertEqual(r1.status_code, 201, r1.data)
        self.assertTrue(r1.data["number"].endswith("-0001"))
        self.assertTrue(r2.data["number"].endswith("-0002"))

    def test_pdfs(self):
        Payment.objects.create(project=self.project, amount=Decimal("15000"), date="2026-02-01")
        d = self.api.get("/api/contracts/draft/", {"projectId": self.project.pk}).data
        k = self.api.post("/api/contracts/", d, format="json").data
        for url in (
            f"/api/projects/{self.project.pk}/report/?type=client&lang=ar",
            f"/api/projects/{self.project.pk}/report/?type=internal&lang=en",
            f"/api/contracts/{k['id']}/pdf/?lang=ar",
        ):
            r = self.api.get(url)
            self.assertEqual(r.status_code, 200, url)
            self.assertEqual(r["Content-Type"], "application/pdf")
            self.assertTrue(r.content.startswith(b"%PDF"))
        self.assertEqual(self.anon.get(f"/api/contracts/{k['id']}/pdf/").status_code, 401)


class ContactTests(Base):
    def test_contact_is_saved_and_throttled(self):
        payload = {"name": "Ahmed", "email": "a@example.com", "message": "Hi", "service": "erp", "lang": "ar"}
        codes = [self.anon.post("/api/public/contact/", payload, format="json").status_code for _ in range(6)]
        self.assertEqual(codes[:5], [201] * 5)
        self.assertEqual(codes[5], 429)
        self.assertEqual(self.api.get("/api/messages/").data[0]["name"], "Ahmed")


class StatsTests(Base):
    def test_overview_groups_by_currency(self):
        a = Project.objects.create(category="web", title_en="A", cost=Decimal("1000"), currency="EGP", status="in_progress")
        Project.objects.create(category="web", title_en="B", cost=Decimal("500"), currency="SAR")
        Payment.objects.create(project=a, amount=Decimal("400"), date="2026-03-05")
        d = self.api.get("/api/stats/overview/").data
        self.assertEqual(d["byCurrency"]["EGP"]["outstanding"], 600.0)
        self.assertEqual(d["byCurrency"]["SAR"]["contract"], 500.0)
        self.assertEqual(d["byCurrency"]["EGP"]["byMonth"]["2026-03"], 400.0)
        self.assertEqual(d["active"], 1)
