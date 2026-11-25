import base64
import hashlib
import json
import secrets
from urllib.parse import parse_qs, urlsplit

from cryptography.fernet import Fernet
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import Client as HttpClient
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from connector.models import ActivityLog, Grant
from connector.tools import REGISTRY
from core.models import Client, Contract, Payment, Project
from core.tests.test_api import PROJECT, png_bytes

CLAUDE_CB = "https://claude.ai/api/mcp/auth_callback"


def pkce():
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


@override_settings(
    FIELD_ENCRYPTION_KEY=Fernet.generate_key().decode(),
    PUBLIC_BASE_URL="https://codixa.test",
    STORAGES={"default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
              "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"}},
)
class ConnectorBase(TestCase):
    password = "Pass-12345-xyz"

    def setUp(self):
        cache.clear()
        self.staff = User.objects.create_user("owner", password=self.password, is_staff=True)
        self.http = HttpClient()

    def register(self, uris=(CLAUDE_CB,)):
        r = self.http.post("/oauth/register", json.dumps({"client_name": "Claude", "redirect_uris": list(uris)}), content_type="application/json")
        return r

    def authorize(self, client_id, challenge, username="owner", password=None, decision="approve"):
        params = {
            "response_type": "code", "client_id": client_id, "redirect_uri": CLAUDE_CB, "code_challenge": challenge,
            "code_challenge_method": "S256", "state": "st4te",
        }
        return self.http.post("/oauth/authorize", {**params, "username": username, "password": password or self.password, "decision": decision})

    def login_tokens(self):
        client_id = self.register().json()["client_id"]
        verifier, challenge = pkce()
        r = self.authorize(client_id, challenge)
        code = parse_qs(urlsplit(r["Location"]).query)["code"][0]
        t = self.http.post("/oauth/token", {"grant_type": "authorization_code", "code": code, "redirect_uri": CLAUDE_CB,
                                            "client_id": client_id, "code_verifier": verifier})
        self.assertEqual(t.status_code, 200, t.content)
        return t.json()

    def rpc(self, token, method, params=None, msg_id=1):
        body = {"jsonrpc": "2.0", "id": msg_id, "method": method, "params": params or {}}
        return self.http.post("/mcp", json.dumps(body), content_type="application/json", HTTP_AUTHORIZATION=f"Bearer {token}")

    def call(self, token, name, args):
        r = self.rpc(token, "tools/call", {"name": name, "arguments": args})
        self.assertEqual(r.status_code, 200, r.content)
        res = r.json()["result"]
        return res["isError"], json.loads(res["content"][0]["text"])


class EndpointProtectionTests(ConnectorBase):
    """Every dashboard endpoint must reject anonymous users (401) and non-staff users (403)."""

    def test_every_dashboard_endpoint_is_protected(self):
        p = Project.objects.create(category="web", title_en="P")
        c = Client.objects.create(name="C")
        pay = Payment.objects.create(project=p, amount=1, date="2026-01-01")
        ct = Contract.objects.create(project=p, number="CDX-2026-9999", contract_date="2026-01-01", total_value=1, client_name="C")
        urls = [
            ("get", "/api/projects/"), ("post", "/api/projects/"), ("get", f"/api/projects/{p.pk}/"),
            ("put", f"/api/projects/{p.pk}/"), ("delete", f"/api/projects/{p.pk}/"),
            ("get", "/api/clients/"), ("post", "/api/clients/"), ("delete", f"/api/clients/{c.pk}/"),
            ("get", "/api/payments/"), ("delete", f"/api/payments/{pay.pk}/"),
            ("get", "/api/contracts/"), ("get", f"/api/contracts/draft/?projectId={p.pk}"), ("delete", f"/api/contracts/{ct.pk}/"),
            ("get", "/api/messages/"), ("get", "/api/settings/"), ("put", "/api/settings/"),
            ("post", "/api/settings/signature/"), ("get", "/api/stats/overview/"), ("get", "/api/backup/export/"),
            ("post", "/api/media/images/"), ("post", "/api/media/videos/"),
            ("get", f"/api/projects/{p.pk}/report/?type=internal&secrets=1"), ("get", f"/api/contracts/{ct.pk}/pdf/"),
            ("get", "/api/connector/"), ("post", "/api/connector/grants/1/revoke/"), ("get", "/api/activity/"),
            ("get", "/api/auth/me/"),
        ]
        anon = APIClient()
        user = User.objects.create_user("viewer", password=self.password, is_staff=False)
        nonstaff = APIClient()
        nonstaff.force_authenticate(user)
        for method, url in urls:
            with self.subTest(url=url, method=method):
                self.assertEqual(getattr(anon, method)(url).status_code, 401)
                self.assertEqual(getattr(nonstaff, method)(url).status_code, 403)
        self.assertTrue(Project.objects.filter(pk=p.pk).exists())

    def test_public_endpoints_stay_open(self):
        anon = APIClient()
        self.assertEqual(anon.get("/api/public/projects/").status_code, 200)
        self.assertEqual(anon.get("/api/public/settings/").status_code, 200)


class OAuthTests(ConnectorBase):
    def test_discovery(self):
        r = self.http.get("/.well-known/oauth-protected-resource/mcp").json()
        self.assertEqual(r["resource"], "https://codixa.test/mcp")
        m = self.http.get("/.well-known/oauth-authorization-server").json()
        self.assertEqual(m["code_challenge_methods_supported"], ["S256"])
        mcp = self.http.post("/mcp", "{}", content_type="application/json")
        self.assertEqual(mcp.status_code, 401)
        self.assertIn("resource_metadata=", mcp["WWW-Authenticate"])

    def test_register_rejects_foreign_redirects(self):
        self.assertEqual(self.register(["https://evil.example/cb"]).status_code, 400)
        self.assertEqual(self.register([CLAUDE_CB]).status_code, 201)
        self.assertEqual(self.register(["http://localhost:4567/callback"]).status_code, 201)

    def test_authorize_page_and_unknown_client(self):
        client_id = self.register().json()["client_id"]
        _, challenge = pkce()
        q = f"?response_type=code&client_id={client_id}&redirect_uri={CLAUDE_CB}&code_challenge={challenge}&code_challenge_method=S256"
        page = self.http.get("/oauth/authorize" + q)
        self.assertEqual(page.status_code, 200)
        self.assertContains(page, "can't read or change project passwords")
        bad = self.http.get(q.replace(client_id, "nope").join(["/oauth/authorize", ""]))
        self.assertEqual(bad.status_code, 400)
        redirect_elsewhere = self.http.get("/oauth/authorize" + q.replace(CLAUDE_CB, "https://evil.example/cb"))
        self.assertEqual(redirect_elsewhere.status_code, 400)  # shown as an error, never redirected

    def test_non_staff_and_wrong_password_cannot_approve(self):
        User.objects.create_user("viewer", password=self.password, is_staff=False)
        client_id = self.register().json()["client_id"]
        _, challenge = pkce()
        self.assertEqual(self.authorize(client_id, challenge, password="wrong").status_code, 400)
        self.assertEqual(self.authorize(client_id, challenge, username="viewer").status_code, 400)
        denied = self.authorize(client_id, challenge, decision="deny")
        self.assertIn("error=access_denied", denied["Location"])
        self.assertFalse(Grant.objects.exists())

    def test_login_attempts_are_limited(self):
        client_id = self.register().json()["client_id"]
        _, challenge = pkce()
        for _ in range(8):
            self.authorize(client_id, challenge, password="wrong")
        self.assertEqual(self.authorize(client_id, challenge).status_code, 429)

    def test_pkce_and_code_replay(self):
        client_id = self.register().json()["client_id"]
        verifier, challenge = pkce()
        code = parse_qs(urlsplit(self.authorize(client_id, challenge)["Location"]).query)["code"][0]
        wrong = self.http.post("/oauth/token", {"grant_type": "authorization_code", "code": code, "redirect_uri": CLAUDE_CB,
                                                "client_id": client_id, "code_verifier": pkce()[0]})
        self.assertEqual(wrong.status_code, 400)
        # The code was consumed by the failed attempt; replaying it revokes the grant.
        again = self.http.post("/oauth/token", {"grant_type": "authorization_code", "code": code, "redirect_uri": CLAUDE_CB,
                                                "client_id": client_id, "code_verifier": verifier})
        self.assertEqual(again.status_code, 400)
        self.assertIsNotNone(Grant.objects.get().revoked_at)

    def test_refresh_rotation_and_reuse_detection(self):
        t = self.login_tokens()
        r1 = self.http.post("/oauth/token", {"grant_type": "refresh_token", "refresh_token": t["refresh_token"]})
        self.assertEqual(r1.status_code, 200)
        r2 = self.http.post("/oauth/token", {"grant_type": "refresh_token", "refresh_token": t["refresh_token"]})
        self.assertEqual(r2.status_code, 400)
        self.assertEqual(self.rpc(r1.json()["access_token"], "ping").status_code, 401)

    def test_revoke_from_dashboard_and_losing_staff_cut_access(self):
        t = self.login_tokens()
        self.assertEqual(self.rpc(t["access_token"], "ping").status_code, 200)
        api = APIClient()
        api.force_authenticate(self.staff)
        info = api.get("/api/connector/").json()
        self.assertEqual(info["url"], "https://codixa.test/mcp")
        api.post(f"/api/connector/grants/{info['grants'][0]['id']}/revoke/")
        self.assertEqual(self.rpc(t["access_token"], "ping").status_code, 401)

        t2 = self.login_tokens()
        self.staff.is_staff = False
        self.staff.save()
        self.assertEqual(self.rpc(t2["access_token"], "ping").status_code, 401)


class ToolTests(ConnectorBase):
    def setUp(self):
        super().setUp()
        self.token = self.login_tokens()["access_token"]

    def test_initialize_and_no_delete_tools(self):
        init = self.rpc(self.token, "initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "t", "version": "1"}}).json()
        self.assertEqual(init["result"]["protocolVersion"], "2025-06-18")
        names = [t["name"] for t in self.rpc(self.token, "tools/list").json()["result"]["tools"]]
        self.assertIn("create_project", names)
        self.assertFalse([n for n in names if "delete" in n or "remove" in n])
        self.assertFalse([n for n in REGISTRY if "secret" in n or "credential" in n])

    def test_credentials_are_never_read_or_written(self):
        api = APIClient()
        api.force_authenticate(self.staff)
        pid = api.post("/api/projects/", PROJECT, format="json").json()["id"]

        err, out = self.call(self.token, "get_project", {"project_id": pid})
        self.assertFalse(err)
        self.assertTrue(out["hasCredentials"])
        self.assertNotIn("admin_password", out["details"])
        self.assertNotIn("S3cret!", json.dumps(out))

        err, out = self.call(self.token, "update_project", {"project_id": pid, "details": {"admin_password": "hacked"}})
        self.assertTrue(err)

        err, _ = self.call(self.token, "update_project", {"project_id": pid, "progress": 90, "title_en": "Renamed"})
        self.assertFalse(err)
        p = Project.objects.get(pk=pid)
        self.assertEqual(p.secrets["admin_password"], "S3cret!")  # untouched by the edit
        self.assertEqual((p.progress, p.title_en, p.title_ar), (90, "Renamed", "موقع تجريبي"))

    def test_create_project_with_image_payment_and_contract(self):
        err, c = self.call(self.token, "create_client", {"name": "Client A", "phone": "+20100"})
        self.assertFalse(err)
        err, p = self.call(self.token, "create_project", {
            "category": "erp", "title_ar": "نظام", "title_en": "System", "client_id": c["client"]["id"], "cost": 1000})
        self.assertFalse(err)
        pid = p["project"]["id"]
        self.assertFalse(p["project"]["published"])  # hidden until the user publishes

        img = base64.b64encode(png_bytes().getvalue()).decode()
        err, out = self.call(self.token, "add_project_image", {"project_id": pid, "image_base64": img, "make_cover": True})
        self.assertFalse(err)
        self.assertEqual(out["image"]["width"], 1920)

        err, out = self.call(self.token, "add_project_image", {"project_id": pid, "image_url": "http://127.0.0.1/x.png"})
        self.assertTrue(err)

        err, out = self.call(self.token, "record_payment", {"project_id": pid, "amount": 1500, "date": "2026-11-01"})
        self.assertFalse(err)
        self.assertIn("warning", out)

        err, out = self.call(self.token, "create_contract", {"project_id": pid})
        self.assertFalse(err)
        pdf = self.http.get(urlsplit(out["pdf"]["url"]).path)
        self.assertEqual(pdf["Content-Type"], "application/pdf")
        self.assertEqual(self.http.get(urlsplit(out["pdf"]["url"]).path[:-4] + "xx/").status_code, 404)

        logged = list(ActivityLog.objects.filter(source="connector").values_list("action", flat=True))
        for action in ("create_client", "create_project", "add_project_image", "record_payment", "create_contract"):
            self.assertIn(action, logged)
        self.assertTrue(ActivityLog.objects.filter(action="add_project_image", ok=False).exists())

    def test_dashboard_changes_are_logged(self):
        api = APIClient()
        api.force_authenticate(self.staff)
        pid = api.post("/api/projects/", PROJECT, format="json").json()["id"]
        api.delete(f"/api/projects/{pid}/")
        actions = list(ActivityLog.objects.filter(source="dashboard").values_list("action", "target"))
        self.assertIn(("projects.create", ""), actions)
        self.assertIn(("projects.delete", f"projects #{pid}"), actions)
        self.assertEqual(api.get("/api/activity/?source=dashboard").status_code, 200)


class StoreToolTests(ToolTests):
    def test_store_tools(self):
        err, out = self.call(self.token, "create_system", {
            "title_ar": "نظام المخازن", "title_en": "Inventory", "category": "erp",
            "description_ar": "<p><strong>مخزون</strong></p><script>x()</script>",
            "highlights": [{"ar": "باركود", "en": "Barcode"}], "price": 9000})
        self.assertFalse(err, out)
        sid = out["system"]["id"]
        self.assertFalse(out["system"]["published"])
        self.assertNotIn("script", out["system"]["description"]["ar"])
        self.assertTrue(out["system"]["publicUrl"].endswith("/store/inventory"))
        img = base64.b64encode(png_bytes().getvalue()).decode()
        err, out = self.call(self.token, "add_system_image", {"system_id": sid, "image_base64": img})
        self.assertFalse(err, out)
        err, out = self.call(self.token, "update_system", {"system_id": sid, "published": True, "tagline_en": "Stock control"})
        self.assertFalse(err)
        self.assertEqual(out["system"]["description"]["ar"], "<p><strong>مخزون</strong></p>")  # untouched
        self.assertEqual(len(out["system"]["images"]), 1)
        self.client.post(f"/api/public/systems/inventory/order/", {"name": "Ali", "phone": "01011112222"}, content_type="application/json")
        err, out = self.call(self.token, "list_orders", {"kind": "order"})
        self.assertEqual(out["items"][0]["system"], "نظام المخازن")
