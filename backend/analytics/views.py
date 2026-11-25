"""Page-view beacon (public) and the visitor statistics shown in the dashboard (staff)."""
import json
from datetime import timedelta

from django.conf import settings
from django.db.models import Count
from django.db.models.functions import ExtractHour
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core.models import ContactMessage
from store.models import System

from . import tracking
from .models import Visit

RANGES = {1, 7, 30, 90, 365}


@csrf_exempt
def track(request):
    """POST {p: path+query, r: referrer, tz: time zone, l: lang, f: 1 on the first page of a visit}. Always 204."""
    if request.method != "POST":
        return HttpResponse(status=405)
    resp = HttpResponse(status=204)
    ua = request.META.get("HTTP_USER_AGENT", "")[:400]
    if not ua or tracking.BOT_RE.search(ua) or request.META.get("HTTP_DNT") == "1" and settings.ANALYTICS_RESPECT_DNT:
        return resp
    try:
        data = json.loads(request.body[:4000] or b"{}")
    except ValueError:
        return resp
    if not isinstance(data, dict):
        return resp
    path = tracking.clean_path(str(data.get("p") or ""))
    if not path:
        return resp
    fwd = request.META.get("HTTP_X_FORWARDED_FOR", "")
    ip = (fwd.split(",")[0].strip() if fwd else request.META.get("REMOTE_ADDR")) or "0.0.0.0"
    if tracking.too_many(ip):
        return resp

    day = timezone.localdate()
    own_host = (settings.PUBLIC_BASE_URL.split("://", 1)[-1].split("/")[0] or request.get_host()).split(":")[0].lower()
    own_host = own_host[4:] if own_host.startswith("www.") else own_host
    source = tracking.source_for(str(data.get("p") or ""), str(data.get("r") or "")[:500], own_host) if data.get("f") else ""
    device, browser, os_name = tracking.parse_ua(ua)
    lang = str(data.get("l") or "")[:2]
    Visit.objects.create(
        day=day,
        path=path,
        visitor=tracking.visitor_id(day, ip, ua),
        source=source,
        device=device,
        browser=browser,
        os=os_name,
        lang=lang if lang in ("ar", "en") else "",
        country=tracking.country_for(request, str(data.get("tz") or "")[:64]),
    )
    return resp


def _visitors(qs) -> int:
    return qs.values("day", "visitor").distinct().count()


def _top(qs, field, limit=10):
    rows = (
        qs.exclude(**{field: ""})
        .values(field)
        .annotate(visitors=Count("visitor", distinct=True), views=Count("id"))
        .order_by("-visitors", "-views")[:limit]
    )
    return [{"key": r[field], "visitors": r["visitors"], "views": r["views"]} for r in rows]


def _change(now: int, before: int):
    if not before:
        return None
    return round((now - before) * 100 / before, 1)


@api_view(["GET"])
def overview(request):
    try:
        days = int(request.query_params.get("days", 30))
    except ValueError:
        days = 30
    days = days if days in RANGES else 30
    today = timezone.localdate()
    start = today - timedelta(days=days - 1)
    prev_start = start - timedelta(days=days)

    cur = Visit.objects.filter(day__gte=start, day__lte=today)
    prev = Visit.objects.filter(day__gte=prev_start, day__lt=start)
    visitors, views = _visitors(cur), cur.count()
    p_visitors, p_views = _visitors(prev), prev.count()

    # Time series: per hour for "today", per day otherwise (missing points filled with zeros).
    if days == 1:
        rows = {
            r["h"]: r
            for r in cur.annotate(h=ExtractHour("created_at", tzinfo=timezone.get_current_timezone()))
            .values("h")
            .annotate(views=Count("id"), visitors=Count("visitor", distinct=True))
        }
        series = [{"t": f"{h:02d}:00", "views": rows.get(h, {}).get("views", 0), "visitors": rows.get(h, {}).get("visitors", 0)} for h in range(24)]
    else:
        rows = {r["day"]: r for r in cur.values("day").annotate(views=Count("id"), visitors=Count("visitor", distinct=True))}
        series = []
        for i in range(days):
            d = start + timedelta(days=i)
            r = rows.get(d, {})
            series.append({"t": d.isoformat(), "views": r.get("views", 0), "visitors": r.get("visitors", 0)})

    since = timezone.now() - timedelta(minutes=5)
    live = Visit.objects.filter(created_at__gte=since).values("visitor").distinct().count()

    msgs = ContactMessage.objects.filter(created_at__date__gte=start)
    orders = msgs.filter(kind=ContactMessage.Kind.ORDER).count()
    contacts = msgs.filter(kind=ContactMessage.Kind.CONTACT).count()

    # Store: page views and orders per system
    store = []
    paths = {}
    for s in System.objects.only("id", "slug", "title_ar", "title_en"):
        paths[f"/store/{s.slug}"] = s
        paths[f"/en/store/{s.slug}"] = s
    view_rows = (
        cur.filter(path__in=list(paths)).values("path").annotate(views=Count("id"), visitors=Count("visitor", distinct=True))
    )
    per = {}
    for r in view_rows:
        s = paths[r["path"]]
        e = per.setdefault(s.pk, {"slug": s.slug, "title": {"ar": s.title_ar, "en": s.title_en}, "views": 0, "visitors": 0, "orders": 0})
        e["views"] += r["views"]
        e["visitors"] += r["visitors"]
    for r in msgs.filter(kind=ContactMessage.Kind.ORDER, system__isnull=False).values("system").annotate(n=Count("id")):
        s = next((x for x in paths.values() if x.pk == r["system"]), None)
        if s:
            e = per.setdefault(s.pk, {"slug": s.slug, "title": {"ar": s.title_ar, "en": s.title_en}, "views": 0, "visitors": 0, "orders": 0})
            e["orders"] = r["n"]
    store = sorted(per.values(), key=lambda x: (-x["orders"], -x["views"]))

    return Response(
        {
            "days": days,
            "totals": {
                "visitors": visitors,
                "views": views,
                "viewsPerVisitor": round(views / visitors, 1) if visitors else 0,
                "live": live,
                "orders": orders,
                "messages": contacts,
                "change": {"visitors": _change(visitors, p_visitors), "views": _change(views, p_views)},
            },
            "series": series,
            "pages": _top(cur, "path", 15),
            "sources": _top(cur, "source", 10),
            "devices": _top(cur, "device", 3),
            "countries": _top(cur, "country", 10),
            "browsers": _top(cur, "browser", 6),
            "languages": _top(cur, "lang", 2),
            "store": store,
        }
    )
