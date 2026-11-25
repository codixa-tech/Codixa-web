from decimal import Decimal

from django.db.models import Q
from rest_framework import serializers

from core.serializers import _url
from core.services.richtext import plain_text, sanitize_html

from .models import System, SystemImage


def image_dict(img: SystemImage, request=None) -> dict:
    return {
        "id": img.pk,
        "src": _url(request, img.image),
        "thumb": _url(request, img.thumb) or _url(request, img.image),
        "w": img.width,
        "h": img.height,
        "bytes": img.bytes,
        "originalBytes": img.original_bytes,
    }


def _pair(obj, field):
    return {"ar": getattr(obj, f"{field}_ar"), "en": getattr(obj, f"{field}_en")}


def _price(s: System):
    return {
        "amount": float(s.price) if s.price is not None else None,
        "currency": s.currency,
        "note": _pair(s, "price_note"),
    }


def system_card(s: System, request=None) -> dict:
    """Compact shape for the store grid."""
    imgs = list(s.images.all())
    return {
        "slug": s.slug,
        "category": s.category,
        "title": _pair(s, "title"),
        "tagline": _pair(s, "tagline"),
        "highlights": s.highlights[:4],
        "price": _price(s),
        "featured": s.featured,
        "cover": image_dict(imgs[0], request) if imgs else None,
    }


def system_public(s: System, request=None) -> dict:
    return {
        **system_card(s, request),
        "highlights": s.highlights,
        "requirements": s.requirements,
        "description": _pair(s, "description"),
        "images": [image_dict(i, request) for i in s.images.all()],
        "demoUrl": s.demo_url,
        "updatedAt": s.updated_at.isoformat(),
    }


def system_admin(s: System, request=None) -> dict:
    return {
        **system_public(s, request),
        "id": s.pk,
        "published": s.published,
        "position": s.position,
        "ordersCount": getattr(s, "orders_count", None),
        "createdAt": s.created_at.isoformat(),
    }


class _PairField(serializers.Serializer):
    ar = serializers.CharField(required=False, allow_blank=True, max_length=600)
    en = serializers.CharField(required=False, allow_blank=True, max_length=600)


class _HtmlPair(serializers.Serializer):
    ar = serializers.CharField(required=False, allow_blank=True, max_length=200_000, trim_whitespace=False)
    en = serializers.CharField(required=False, allow_blank=True, max_length=200_000, trim_whitespace=False)


class SystemWriteSerializer(serializers.Serializer):
    slug = serializers.SlugField(required=False, allow_blank=True, max_length=80)
    category = serializers.ChoiceField(choices=System.Category.choices, required=False)
    title = _PairField()
    tagline = _PairField(required=False)
    description = _HtmlPair(required=False)
    highlights = _PairField(many=True, required=False)
    requirements = _PairField(many=True, required=False)
    price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"), required=False, allow_null=True)
    currency = serializers.ChoiceField(choices=["EGP", "SAR", "USD", "AED", "EUR"], required=False)
    priceNote = _PairField(required=False)
    demoUrl = serializers.URLField(required=False, allow_blank=True)
    published = serializers.BooleanField(required=False)
    featured = serializers.BooleanField(required=False)
    position = serializers.IntegerField(required=False, min_value=0, max_value=32000)
    images = serializers.ListField(child=serializers.DictField(), required=False, max_length=20)

    def validate(self, data):
        title = data.get("title") or {}
        if not (title.get("ar") or "").strip() and not (title.get("en") or "").strip():
            raise serializers.ValidationError({"title": "Arabic or English title is required."})
        return data

    @staticmethod
    def _items(rows):
        out = []
        for r in rows or []:
            ar, en = (r.get("ar") or "").strip(), (r.get("en") or "").strip()
            if ar or en:
                out.append({"ar": ar, "en": en})
        return out

    def save_system(self, instance: System | None = None) -> System:
        d = self.validated_data
        s = instance or System()
        title = d.get("title", {})
        s.title_ar, s.title_en = title.get("ar", "").strip(), title.get("en", "").strip()
        for field in ("tagline", "priceNote"):
            if field in d:
                attr = "price_note" if field == "priceNote" else field
                setattr(s, f"{attr}_ar", d[field].get("ar", "").strip())
                setattr(s, f"{attr}_en", d[field].get("en", "").strip())
        if "description" in d:
            s.description_ar = sanitize_html(d["description"].get("ar", ""))
            s.description_en = sanitize_html(d["description"].get("en", ""))
        if "highlights" in d:
            s.highlights = self._items(d["highlights"])
        if "requirements" in d:
            s.requirements = self._items(d["requirements"])
        for src, attr in (("category", "category"), ("price", "price"), ("currency", "currency"), ("demoUrl", "demo_url"),
                          ("published", "published"), ("featured", "featured"), ("position", "position")):
            if src in d:
                setattr(s, attr, d[src])
        wanted = (d.get("slug") or "").strip()
        if wanted:
            s.slug = System.unique_slug(wanted, exclude_pk=s.pk)
        elif not s.slug:
            s.slug = System.unique_slug(s.title_en or plain_text(s.title_ar, 60), exclude_pk=s.pk)
        s.save()
        if "images" in d:
            self._sync_images(s, d["images"])
        return s

    @staticmethod
    def _sync_images(system, refs):
        ids = [int(r["id"]) for r in refs if str(r.get("id", "")).isdigit()]
        keep = set(ids)
        for obj in SystemImage.objects.filter(system=system).exclude(pk__in=keep):
            obj.delete()
        items = {o.pk: o for o in SystemImage.objects.filter(pk__in=keep).filter(Q(system=system) | Q(system__isnull=True))}
        for pos, pk in enumerate(ids):
            if pk in items:
                items[pk].system, items[pk].position = system, pos
        SystemImage.objects.bulk_update(items.values(), ["system", "position"])
