"""Server-rendered <head> and crawlable text for the store pages.

The React app renders the store in the browser; this view gives search engines and link previews the real
title, description, image, JSON-LD and text for every system (nginx sends /store and /en/store here).
"""
import json
from functools import lru_cache
from html import escape
from pathlib import Path

from django.conf import settings
from django.db.models import Prefetch
from django.http import Http404, HttpResponse

from core.services.richtext import plain_text

from .models import System, SystemImage

TEXT = {
    "ar": {
        "title": "متجر الأنظمة الجاهزة | كوديكسا",
        "desc": "أنظمة جاهزة من كوديكسا: ERP وإدارة الشركات والمتاجر الإلكترونية والتعليم والرعاية الصحية. شوف المميزات والمتطلبات واحجز نسختك.",
        "h1": "متجر الأنظمة",
        "store": "المتجر",
        "features": "المميزات",
        "requirements": "المتطلبات",
        "book": "احجز نسختك",
        "locale": "ar_EG",
    },
    "en": {
        "title": "Ready-made business systems | Codixa",
        "desc": "Ready-made systems by Codixa: ERP, company management, e-commerce, education and healthcare. See features and requirements, then book your copy.",
        "h1": "Systems store",
        "store": "Store",
        "features": "Features",
        "requirements": "Requirements",
        "book": "Book your copy",
        "locale": "en_US",
    },
}


def site_url() -> str:
    return (settings.PUBLIC_BASE_URL or "https://codixa.tech").rstrip("/")


def store_path(lang: str, slug: str = "") -> str:
    base = "/en/store" if lang == "en" else "/store"
    return f"{base}/{slug}" if slug else base


@lru_cache(maxsize=4)
def _template(mtime: float) -> str:
    return (Path(settings.FRONTEND_DIST) / "_store.html").read_text(encoding="utf-8")


def template() -> str | None:
    p = Path(settings.FRONTEND_DIST) / "_store.html"
    if not p.exists():
        return None
    return _template(p.stat().st_mtime)


def _meta(lang, title, desc, path, image, jsonld) -> str:
    url = site_url() + path
    ar_path = path[3:] if path.startswith("/en/") else path
    ld = json.dumps(jsonld, ensure_ascii=False).replace("<", "\\u003c")
    tags = [
        f"<title>{escape(title)}</title>",
        f'<meta name="description" content="{escape(desc)}" data-seo>',
        f'<link rel="canonical" href="{escape(url)}" data-seo>',
        f'<link rel="alternate" hreflang="ar" href="{escape(site_url() + ar_path)}" data-seo>',
        f'<link rel="alternate" hreflang="en" href="{escape(site_url() + "/en" + ar_path)}" data-seo>',
        f'<link rel="alternate" hreflang="x-default" href="{escape(site_url() + ar_path)}" data-seo>',
        '<meta property="og:type" content="website" data-seo>',
        '<meta property="og:site_name" content="Codixa" data-seo>',
        f'<meta property="og:title" content="{escape(title)}" data-seo>',
        f'<meta property="og:description" content="{escape(desc)}" data-seo>',
        f'<meta property="og:url" content="{escape(url)}" data-seo>',
        f'<meta property="og:image" content="{escape(image)}" data-seo>',
        f'<meta property="og:locale" content="{TEXT[lang]["locale"]}" data-seo>',
        '<meta name="twitter:card" content="summary_large_image" data-seo>',
        f'<meta name="twitter:title" content="{escape(title)}" data-seo>',
        f'<meta name="twitter:description" content="{escape(desc)}" data-seo>',
        f'<meta name="twitter:image" content="{escape(image)}" data-seo>',
        f'<script type="application/ld+json" data-seo>{ld}</script>',
    ]
    return "\n    ".join(tags)


def _page(tpl: str, lang: str, head: str, shell: str, status: int = 200) -> HttpResponse:
    html = tpl.replace("<!--store-head-->", head).replace("<!--store-shell-->", shell)
    # The template has the Arabic home <title>; the store head brings its own.
    start = html.find("<title>")
    end = html.find("</title>", start)
    if start != -1 and html.count("<title>") > 1:
        html = html[:start] + html[end + len("</title>"):]
    if lang == "en":
        html = html.replace('<html lang="ar" dir="rtl">', '<html lang="en" dir="ltr">', 1)
    resp = HttpResponse(html, status=status, content_type="text/html; charset=utf-8")
    resp["Cache-Control"] = "public, max-age=120"
    return resp


def _pick(obj, field, lang):
    return getattr(obj, f"{field}_{lang}") or getattr(obj, f"{field}_{'en' if lang == 'ar' else 'ar'}")


def _crumbs(lang, items):
    return {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": name, "item": site_url() + path} for i, (name, path) in enumerate(items)
        ],
    }


def store_page(request, lang="ar", slug=None):
    tpl = template()
    if tpl is None:
        raise Http404("Build the website first (npm run build).")
    t = TEXT[lang]
    home = "/en" if lang == "en" else "/"
    systems = System.objects.filter(published=True).prefetch_related(
        Prefetch("images", queryset=SystemImage.objects.order_by("position", "id"))
    )
    default_image = f"{site_url()}/brand/og-cover.jpg"

    if not slug:
        items = list(systems)
        jsonld = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "CollectionPage",
                    "name": t["title"],
                    "url": site_url() + store_path(lang),
                    "inLanguage": lang,
                    "mainEntity": {
                        "@type": "ItemList",
                        "itemListElement": [
                            {"@type": "ListItem", "position": i + 1, "url": site_url() + store_path(lang, s.slug), "name": _pick(s, "title", lang)}
                            for i, s in enumerate(items)
                        ],
                    },
                },
                _crumbs(lang, [("Codixa", home), (t["store"], store_path(lang))]),
            ],
        }
        head = _meta(lang, t["title"], t["desc"], store_path(lang), default_image, jsonld)
        links = "".join(
            f'<li><a href="{store_path(lang, s.slug)}">{escape(_pick(s, "title", lang))}</a> — {escape(_pick(s, "tagline", lang))}</li>'
            for s in items
        )
        shell = f'<div class="seo-shell"><a href="{home}" class="ss-brand">Codixa</a><h1>{t["h1"]}</h1><p>{escape(t["desc"])}</p><ul>{links}</ul></div>'
        return _page(tpl, lang, head, shell)

    s = systems.filter(slug=slug).first()
    if not s:
        head = '<meta name="robots" content="noindex"><title>404 | Codixa</title>'
        return _page(tpl, lang, head, "", status=404)

    title = _pick(s, "title", lang)
    tagline = _pick(s, "tagline", lang)
    desc_html = _pick(s, "description", lang)
    desc = (tagline or plain_text(desc_html, 155) or t["desc"])[:160]
    imgs = list(s.images.all())
    image = site_url() + imgs[0].image.url if imgs else default_image
    path = store_path(lang, s.slug)
    product = {
        "@type": "SoftwareApplication",
        "name": title,
        "description": desc,
        "url": site_url() + path,
        "image": [site_url() + i.image.url for i in imgs] or [default_image],
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "inLanguage": lang,
        "publisher": {"@type": "Organization", "name": "Codixa", "url": site_url() + "/"},
    }
    if s.price is not None:
        product["offers"] = {"@type": "Offer", "price": str(s.price), "priceCurrency": s.currency, "url": site_url() + path,
                             "availability": "https://schema.org/InStock"}
    jsonld = {
        "@context": "https://schema.org",
        "@graph": [product, _crumbs(lang, [("Codixa", home), (t["store"], store_path(lang)), (title, path)])],
    }
    head = _meta(lang, f"{title} | {'كوديكسا' if lang == 'ar' else 'Codixa'}", desc, path, image, jsonld)

    def li(rows):
        return "".join(f"<li>{escape(r.get(lang) or r.get('en' if lang == 'ar' else 'ar') or '')}</li>" for r in rows)

    shell = (
        f'<div class="seo-shell"><a href="{store_path(lang)}" class="ss-brand">Codixa — {t["store"]}</a>'
        f"<h1>{escape(title)}</h1><p>{escape(tagline)}</p>{desc_html}"
        + (f'<h2>{t["features"]}</h2><ul>{li(s.highlights)}</ul>' if s.highlights else "")
        + (f'<h2>{t["requirements"]}</h2><ul>{li(s.requirements)}</ul>' if s.requirements else "")
        + "</div>"
    )
    return _page(tpl, lang, head, shell)


def sitemap(request):
    rows = []
    for lang in ("ar", "en"):
        rows.append(f"  <url><loc>{site_url()}{store_path(lang)}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>")
    for s in System.objects.filter(published=True).only("slug", "updated_at"):
        for lang in ("ar", "en"):
            rows.append(
                f"  <url><loc>{site_url()}{store_path(lang, s.slug)}</loc><lastmod>{s.updated_at.date().isoformat()}</lastmod>"
                f"<changefreq>monthly</changefreq><priority>0.7</priority></url>"
            )
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(rows) + "\n</urlset>\n"
    return HttpResponse(xml, content_type="application/xml")
