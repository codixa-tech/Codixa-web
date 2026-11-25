"""Domain models: clients, projects (+ media), payments, contracts, contact messages, site settings."""
from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q

from .crypto import EncryptedJSONField


class TimeStamped(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Currency(models.TextChoices):
    EGP = "EGP", "EGP"
    SAR = "SAR", "SAR"
    USD = "USD", "USD"
    AED = "AED", "AED"
    EUR = "EUR", "EUR"


class Client(TimeStamped):
    name = models.CharField(max_length=200)
    company = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    country = models.CharField(max_length=80, blank=True)
    address = models.CharField(max_length=300, blank=True)
    id_number = models.CharField("National ID / commercial registration", max_length=60, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["name"]), models.Index(fields=["company"])]

    def __str__(self):
        return f"{self.company} — {self.name}" if self.company else self.name


class Project(TimeStamped):
    class Kind(models.TextChoices):
        PROJECT = "project", "Project"
        TRAINING = "training", "Training"

    class Status(models.TextChoices):
        PLANNING = "planning", "Planning"
        IN_PROGRESS = "in_progress", "In progress"
        ON_HOLD = "on_hold", "On hold"
        COMPLETED = "completed", "Completed"

    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.PROJECT)
    category = models.CharField(max_length=32)
    title_ar = models.CharField(max_length=250, blank=True)
    title_en = models.CharField(max_length=250, blank=True)
    summary_ar = models.TextField(blank=True)
    summary_en = models.TextField(blank=True)
    client = models.ForeignKey(Client, null=True, blank=True, on_delete=models.SET_NULL, related_name="projects")
    show_client = models.BooleanField(default=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PLANNING)
    progress = models.PositiveSmallIntegerField(default=0, validators=[MaxValueValidator(100)])
    featured = models.BooleanField(default=False)
    published = models.BooleanField(default=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    cost = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"), validators=[MinValueValidator(0)])
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.EGP)
    # Non-secret category fields (public ones are shown on the site).
    details = models.JSONField(default=dict, blank=True)
    # Secret category fields (server IPs, passwords, keys) — encrypted at rest, admin only.
    secrets = EncryptedJSONField(blank=True, default="")

    class Meta:
        ordering = ["-featured", "-start_date", "-created_at"]
        indexes = [
            models.Index(fields=["published", "-featured", "-start_date"], name="prj_public_idx"),
            models.Index(fields=["kind", "category"], name="prj_kind_cat_idx"),
            models.Index(fields=["status"], name="prj_status_idx"),
            models.Index(fields=["client", "status"], name="prj_client_status_idx"),
        ]

    def __str__(self):
        return self.title_en or self.title_ar or f"Project {self.pk}"

    def title(self, lang="ar"):
        return (self.title_ar if lang == "ar" else self.title_en) or self.title_en or self.title_ar

    def summary(self, lang="ar"):
        return (self.summary_ar if lang == "ar" else self.summary_en) or self.summary_en or self.summary_ar


class ProjectImage(TimeStamped):
    project = models.ForeignKey(Project, null=True, blank=True, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="projects/images/%Y/%m/")
    thumb = models.ImageField(upload_to="projects/thumbs/%Y/%m/", blank=True)
    position = models.PositiveSmallIntegerField(default=0)
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    bytes = models.PositiveIntegerField(default=0)
    original_bytes = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]
        indexes = [models.Index(fields=["project", "position"], name="img_project_pos_idx")]


class ProjectVideo(TimeStamped):
    class State(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    project = models.ForeignKey(Project, null=True, blank=True, on_delete=models.CASCADE, related_name="videos")
    file = models.FileField(upload_to="projects/videos/%Y/%m/")
    poster = models.ImageField(upload_to="projects/posters/%Y/%m/", blank=True)
    position = models.PositiveSmallIntegerField(default=0)
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    duration = models.PositiveIntegerField(default=0)
    bytes = models.PositiveBigIntegerField(default=0)
    name = models.CharField(max_length=200, blank=True)
    state = models.CharField(max_length=12, choices=State.choices, default=State.PENDING)
    error = models.TextField(blank=True)

    class Meta:
        ordering = ["position", "id"]
        indexes = [
            models.Index(fields=["project", "position"], name="vid_project_pos_idx"),
            models.Index(fields=["state"], name="vid_state_idx"),
        ]

    @property
    def vertical(self):
        return self.height > self.width


class Payment(TimeStamped):
    class Method(models.TextChoices):
        BANK = "bank", "Bank transfer"
        CASH = "cash", "Cash"
        INSTAPAY = "instapay", "InstaPay"
        WALLET = "wallet", "Mobile wallet"
        CARD = "card", "Card"
        OTHER = "other", "Other"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    date = models.DateField()
    method = models.CharField(max_length=16, choices=Method.choices, default=Method.BANK)
    reference = models.CharField(max_length=120, blank=True)
    note = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-date", "-id"]
        indexes = [
            models.Index(fields=["project", "-date"], name="pay_project_date_idx"),
            models.Index(fields=["-date"], name="pay_date_idx"),
        ]


class Contract(TimeStamped):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENT = "sent", "Sent to client"
        SIGNED = "signed", "Signed"
        CANCELLED = "cancelled", "Cancelled"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="contracts")
    number = models.CharField(max_length=32, unique=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    title_ar = models.CharField(max_length=250, blank=True)
    title_en = models.CharField(max_length=250, blank=True)
    contract_date = models.DateField()
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    duration_days = models.PositiveIntegerField(null=True, blank=True)
    total_value = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.EGP)
    # Second party, captured at signing time so later client edits don't change a signed contract.
    client_name = models.CharField(max_length=200)
    client_company = models.CharField(max_length=200, blank=True)
    client_representative = models.CharField(max_length=200, blank=True)
    client_id_number = models.CharField(max_length=60, blank=True)
    client_address = models.CharField(max_length=300, blank=True)
    client_phone = models.CharField(max_length=40, blank=True)
    client_email = models.EmailField(blank=True)
    # Body
    scope_ar = models.TextField(blank=True)
    scope_en = models.TextField(blank=True)
    deliverables = models.JSONField(default=list, blank=True)  # [{ar, en}]
    installments = models.JSONField(default=list, blank=True)  # [{label_ar, label_en, percent, amount, due}]
    warranty_days = models.PositiveIntegerField(default=90)
    support_months = models.PositiveIntegerField(default=3)
    client_obligations_ar = models.TextField(blank=True)
    client_obligations_en = models.TextField(blank=True)
    extra_terms_ar = models.TextField(blank=True)
    extra_terms_en = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    signed_at = models.DateField(null=True, blank=True)
    signed_file = models.FileField(upload_to="contracts/signed/%Y/", blank=True)

    class Meta:
        ordering = ["-contract_date", "-id"]
        indexes = [
            models.Index(fields=["project", "-contract_date"], name="ctr_project_date_idx"),
            models.Index(fields=["status"], name="ctr_status_idx"),
        ]

    def __str__(self):
        return self.number


class ContactMessage(TimeStamped):
    """A message from the website: the contact form or a booking request for a store system."""

    class Kind(models.TextChoices):
        CONTACT = "contact", "Contact"
        ORDER = "order", "Order"

    class Status(models.TextChoices):
        NEW = "new", "New"
        CONTACTED = "contacted", "Contacted"
        WON = "won", "Won"
        CLOSED = "closed", "Closed"

    kind = models.CharField(max_length=8, choices=Kind.choices, default=Kind.CONTACT)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.NEW)
    system = models.ForeignKey("store.System", null=True, blank=True, on_delete=models.SET_NULL, related_name="orders")
    system_title = models.CharField(max_length=160, blank=True)  # kept if the system is deleted later
    name = models.CharField(max_length=150)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    company = models.CharField(max_length=150, blank=True)
    preferred_contact = models.CharField(max_length=10, blank=True)  # whatsapp / call / email
    service = models.CharField(max_length=40, blank=True)
    message = models.TextField(max_length=5000, blank=True)
    lang = models.CharField(max_length=2, default="ar")
    is_read = models.BooleanField(default=False)
    ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["is_read", "-created_at"], name="msg_unread_idx"),
            models.Index(fields=["kind", "-created_at"], name="msg_kind_idx"),
            models.Index(fields=["system", "-created_at"], name="msg_system_idx"),
        ]


class EmailOutbox(models.Model):
    """Outgoing notification e-mails. Sent right away in the background; cron retries failures."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"
        SKIPPED = "skipped", "Skipped (e-mail not configured)"

    to = models.CharField(max_length=254)
    reply_to = models.CharField(max_length=254, blank=True)
    subject = models.CharField(max_length=250)
    text = models.TextField()
    html = models.TextField(blank=True)
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    last_error = models.CharField(max_length=500, blank=True)
    message = models.ForeignKey(ContactMessage, null=True, blank=True, on_delete=models.SET_NULL, related_name="emails")
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "created_at"], name="outbox_status_idx")]


class SiteSettings(models.Model):
    """Singleton (pk=1): public contact data plus the company identity used on PDFs."""

    email = models.EmailField(default="info@codixa.tech")
    phone = models.CharField(max_length=40, default="+201067106891")
    whatsapp = models.CharField(max_length=40, default="+201067106891")
    address_ar = models.CharField(max_length=200, default="القاهرة، مصر")
    address_en = models.CharField(max_length=200, default="Cairo, Egypt")
    partner_name = models.CharField(max_length=120, default="Smart System")
    partner_url = models.URLField(blank=True)
    social = models.JSONField(default=dict, blank=True)
    # Documents
    company_name_ar = models.CharField(max_length=150, default="كوديكسا للحلول التقنية")
    company_name_en = models.CharField(max_length=150, default="Codixa Technical Solutions")
    ceo_name_ar = models.CharField(max_length=150, default="عبدالرحمن مصطفى")
    ceo_name_en = models.CharField(max_length=150, default="Abdulrahman Mustafa")
    commercial_reg = models.CharField(max_length=60, blank=True)
    tax_id = models.CharField(max_length=60, blank=True)
    signature = models.ImageField(upload_to="settings/", blank=True)
    website = models.URLField(default="https://codixa.tech")
    # Notifications
    notify_email = models.EmailField(blank=True)  # empty → the public contact e-mail
    notify_orders = models.BooleanField(default=True)
    notify_messages = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Site settings"
        constraints = [models.CheckConstraint(condition=Q(pk=1), name="site_settings_singleton")]

    @classmethod
    def load(cls) -> "SiteSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
