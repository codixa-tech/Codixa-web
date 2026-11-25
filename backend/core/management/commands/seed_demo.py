"""Load the same sample content as the frontend demo (projects, clients, payments, sample images)."""
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Client, Payment, Project, ProjectImage, SiteSettings
from core.services.images import process_upload

SEED_DIR = settings.REPO_DIR / "public" / "seed"


def ago(months, day=10):
    d = date.today().replace(day=1)
    y, m = d.year, d.month - months
    while m <= 0:
        m += 12
        y -= 1
    while m > 12:
        m -= 12
        y += 1
    return date(y, m, min(day, 28))


PROJECTS = [
    dict(key="clinic-portal", n=5, kind="project", category="web", title_ar="بوابة حجز العيادات (نموذج)", title_en="Clinic booking portal (sample)",
         summary_ar="موقع وبوابة حجز مواعيد مع لوحة تحكم للأطباء وتقارير يومية.", summary_en="Website and appointment portal with a doctors’ dashboard and daily reports.",
         client=0, status="completed", progress=100, featured=True, start=ago(9, 1), end=ago(7, 15), cost=45000, currency="EGP",
         details={"live_url": "https://example.com", "stack": ["Django", "PostgreSQL", "React"], "domain": "example.com"},
         secrets={"server_ip": "203.0.113.10", "host_user": "root", "admin_user": "admin"}, payments=[(22500, ago(9, 3), "bank"), (22500, ago(7, 15), "bank")]),
    dict(key="erpnext-distribution", n=5, kind="project", category="erp", title_ar="ERPNext لشركة توزيع (نموذج)", title_en="ERPNext for a distribution company (sample)",
         summary_ar="تنفيذ المبيعات والمخازن والمشتريات مع تطبيق Frappe مخصص لخطوط التوزيع.", summary_en="Sales, stock and purchasing with a custom Frappe app for delivery routes.",
         client=1, status="in_progress", progress=60, featured=True, start=ago(5, 1), end=ago(-2, 28), cost=120000, currency="SAR",
         details={"platform": "ERPNext", "modules": ["Selling", "Stock", "Buying", "Accounts"], "users_count": 40, "version": "v15"},
         secrets={"server_ip": "198.51.100.24", "admin_user": "Administrator"}, payments=[(36000, ago(5, 3), "bank"), (24000, ago(2, 10), "bank")]),
    dict(key="field-app", n=5, kind="project", category="mobile", title_ar="تطبيق الفنيين الميدانيين (نموذج)", title_en="Field technician app (sample)",
         summary_ar="تطبيق أندرويد و iOS لأوامر العمل والصور والتوقيع، يعمل بدون إنترنت.", summary_en="Android and iOS app for work orders, photos and sign-off that works offline.",
         client=2, status="in_progress", progress=35, start=ago(3, 10), end=ago(-3, 28), cost=60000, currency="EGP",
         details={"platforms": ["Android", "iOS"], "framework": "Flutter", "current_version": "0.6.0"}, payments=[(20000, ago(3, 12), "instapay")]),
    dict(key="robotic-arm", n=3, kind="project", category="robotics", title_ar="ذراع روبوتية تحاكي حركة الإنسان", title_en="Human arm robot",
         summary_ar="ذراع روبوتية بمحركات سيرفو تحاكي حركة ذراع الإنسان وتُتحكم إلكترونيًا.", summary_en="A servo-driven robotic arm that mimics the motion of a human arm.",
         status="completed", progress=100, featured=True, details={"domain_area": "Robotics", "controller": "Arduino", "components": ["Servo motors", "Motor driver"]}),
    dict(key="training-ai", n=3, kind="training", category="training", title_ar="رواد مصر الرقمية — الذكاء الاصطناعي", title_en="Digital Egypt Pioneers — Artificial Intelligence",
         summary_ar="تدريب الذكاء الاصطناعي ضمن مبادرة وزارة الاتصالات وتكنولوجيا المعلومات.", summary_en="AI training within the Ministry of Communications and IT initiative.",
         status="completed", progress=100, featured=True,
         details={"track": "Artificial Intelligence", "organization": {"ar": "وزارة الاتصالات — رواد مصر الرقمية", "en": "MCIT — Digital Egypt Pioneers"}, "city": {"ar": "مصر", "en": "Egypt"}}),
]

CLIENTS = [
    dict(name="عميل تجريبي 1", company="Sample Clinics Group", email="contact@example.com", phone="+20 100 000 0001", country="Egypt", address="القاهرة"),
    dict(name="عميل تجريبي 2", company="Sample Distribution Co.", email="it@example.com", phone="+966 50 000 0002", country="Saudi Arabia", address="الرياض"),
    dict(name="عميل تجريبي 3", company="Sample Services Ltd.", email="ops@example.com", phone="+20 100 000 0003", country="Egypt"),
]


class Command(BaseCommand):
    help = "Create sample clients, projects, payments and images (safe to run on an empty database)."

    @transaction.atomic
    def handle(self, *args, **opts):
        if Project.objects.exists():
            self.stdout.write("Projects already exist; nothing seeded.")
            return
        SiteSettings.load()
        clients = [Client.objects.create(**c) for c in CLIENTS]
        for spec in PROJECTS:
            p = Project.objects.create(
                kind=spec["kind"], category=spec["category"], title_ar=spec["title_ar"], title_en=spec["title_en"],
                summary_ar=spec["summary_ar"], summary_en=spec["summary_en"],
                client=clients[spec["client"]] if "client" in spec else None, show_client=False,
                status=spec["status"], progress=spec["progress"], featured=spec.get("featured", False), published=True,
                start_date=spec.get("start"), end_date=spec.get("end"), cost=Decimal(spec.get("cost", 0)), currency=spec.get("currency", "EGP"),
                details=spec.get("details", {}), secrets=spec.get("secrets", {}),
            )
            for i in range(spec["n"]):
                path = Path(SEED_DIR) / f"{spec['key']}-{i + 1}.webp"
                if path.exists():
                    data = process_upload(SimpleUploadedFile(path.name, path.read_bytes(), content_type="image/webp"))
                    ProjectImage.objects.create(project=p, position=i, **data)
            for amount, when, method in spec.get("payments", []):
                Payment.objects.create(project=p, amount=Decimal(amount), date=when, method=method, note="Sample")
        self.stdout.write(self.style.SUCCESS(f"Seeded {Project.objects.count()} projects."))
