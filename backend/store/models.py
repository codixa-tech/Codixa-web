"""Ready-made systems offered in the public store (المتجر)."""
from django.db import models
from django.utils.text import slugify

from core.models import TimeStamped


class System(TimeStamped):
    class Category(models.TextChoices):
        ERP = "erp", "ERP"
        MANAGEMENT = "management", "Management"
        ECOMMERCE = "ecommerce", "E-commerce"
        EDUCATION = "education", "Education"
        HEALTHCARE = "healthcare", "Healthcare"
        MOBILE = "mobile", "Mobile app"
        OTHER = "other", "Other"

    slug = models.SlugField(max_length=80, unique=True)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.MANAGEMENT)
    title_ar = models.CharField(max_length=160)
    title_en = models.CharField(max_length=160)
    tagline_ar = models.CharField(max_length=240, blank=True)
    tagline_en = models.CharField(max_length=240, blank=True)
    # Sanitized HTML from the rich-text editor
    description_ar = models.TextField(blank=True)
    description_en = models.TextField(blank=True)
    highlights = models.JSONField(default=list, blank=True)  # [{"ar": "...", "en": "..."}]
    requirements = models.JSONField(default=list, blank=True)  # [{"ar": "...", "en": "..."}]
    price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="EGP")
    price_note_ar = models.CharField(max_length=120, blank=True)  # e.g. "يبدأ من" / "سنويًا"
    price_note_en = models.CharField(max_length=120, blank=True)
    demo_url = models.URLField(blank=True)
    published = models.BooleanField(default=False)
    featured = models.BooleanField(default=False)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position", "-featured", "-created_at"]
        indexes = [
            models.Index(fields=["published", "position"], name="sys_public_idx"),
            models.Index(fields=["category"], name="sys_category_idx"),
        ]

    def __str__(self):
        return self.title_en or self.title_ar

    @staticmethod
    def unique_slug(base: str, exclude_pk=None) -> str:
        root = slugify(base)[:70] or "system"
        slug, n = root, 2
        qs = System.objects.all()
        if exclude_pk:
            qs = qs.exclude(pk=exclude_pk)
        while qs.filter(slug=slug).exists():
            slug, n = f"{root}-{n}", n + 1
        return slug


class SystemImage(TimeStamped):
    system = models.ForeignKey(System, null=True, blank=True, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="store/images/%Y/%m/")
    thumb = models.ImageField(upload_to="store/thumbs/%Y/%m/", blank=True)
    position = models.PositiveSmallIntegerField(default=0)
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    bytes = models.PositiveIntegerField(default=0)
    original_bytes = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]
        indexes = [models.Index(fields=["system", "position"], name="sysimg_pos_idx")]


class EditorImage(TimeStamped):
    """Image inserted inside a rich-text description."""

    image = models.ImageField(upload_to="editor/%Y/%m/")
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
