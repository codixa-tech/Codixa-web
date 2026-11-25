"""Turn one page-view beacon into a Visit row (or drop it for bots, staff and floods)."""
import hashlib
import re
from datetime import date
from functools import lru_cache
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from django.conf import settings
from django.core.cache import cache

BOT_RE = re.compile(
    r"bot|crawl|spider|slurp|scrap|headless|lighthouse|pagespeed|preview|monitor|facebookexternalhit|"
    r"whatsapp|telegram|discord|curl|wget|python|httpclient|java/|go-http|axios|node-fetch|phantom|selenium|puppeteer",
    re.I,
)
SKIP_PATHS = ("/dashboard", "/api", "/media", "/static", "/oauth", "/mcp")
MAX_HITS_PER_MINUTE = 60

SEARCH = {"google": "Google", "bing": "Bing", "yahoo": "Yahoo", "duckduckgo": "DuckDuckGo", "yandex": "Yandex", "baidu": "Baidu"}
SOCIAL = {
    "facebook.com": "Facebook", "fb.com": "Facebook", "fb.me": "Facebook", "instagram.com": "Instagram",
    "linkedin.com": "LinkedIn", "lnkd.in": "LinkedIn", "t.co": "X", "twitter.com": "X", "x.com": "X",
    "youtube.com": "YouTube", "youtu.be": "YouTube", "tiktok.com": "TikTok", "wa.me": "WhatsApp",
    "whatsapp.com": "WhatsApp", "t.me": "Telegram", "chatgpt.com": "ChatGPT", "claude.ai": "Claude",
    "github.com": "GitHub", "snapchat.com": "Snapchat",
}
FALLBACK_TZ = {
    "Africa/Cairo": "EG", "Asia/Riyadh": "SA", "Asia/Dubai": "AE", "Asia/Kuwait": "KW", "Asia/Qatar": "QA",
    "Asia/Bahrain": "BH", "Asia/Muscat": "OM", "Asia/Amman": "JO", "Asia/Baghdad": "IQ", "Asia/Beirut": "LB",
    "Africa/Khartoum": "SD", "Africa/Tripoli": "LY", "Africa/Tunis": "TN", "Africa/Algiers": "DZ",
    "Africa/Casablanca": "MA", "Europe/London": "GB", "Europe/Berlin": "DE", "Europe/Paris": "FR",
    "America/New_York": "US", "America/Chicago": "US", "America/Los_Angeles": "US", "Europe/Istanbul": "TR",
}


@lru_cache(maxsize=1)
def _tz_countries() -> dict:
    mapping = dict(FALLBACK_TZ)
    tab = Path("/usr/share/zoneinfo/zone.tab")
    if tab.exists():
        for line in tab.read_text(encoding="utf-8", errors="ignore").splitlines():
            if line and not line.startswith("#"):
                parts = line.split("\t")
                if len(parts) >= 3:
                    mapping.setdefault(parts[2], parts[0])
    return mapping


def country_for(request, tz: str) -> str:
    cf = request.META.get("HTTP_CF_IPCOUNTRY", "")
    if len(cf) == 2 and cf.isalpha() and cf.upper() not in ("XX", "T1"):
        return cf.upper()
    return _tz_countries().get(tz or "", "")


def parse_ua(ua: str) -> tuple[str, str, str]:
    u = ua.lower()
    device = "tablet" if re.search(r"ipad|tablet|kindle|silk", u) else "mobile" if re.search(r"mobi|iphone|android", u) else "desktop"
    if "edg/" in u:
        browser = "Edge"
    elif "opr/" in u or "opera" in u:
        browser = "Opera"
    elif "samsungbrowser" in u:
        browser = "Samsung"
    elif "firefox" in u or "fxios" in u:
        browser = "Firefox"
    elif "chrome" in u or "crios" in u:
        browser = "Chrome"
    elif "safari" in u:
        browser = "Safari"
    else:
        browser = "Other"
    if "windows" in u:
        os_name = "Windows"
    elif "android" in u:
        os_name = "Android"
    elif re.search(r"iphone|ipad|ipod", u):
        os_name = "iOS"
    elif "mac os" in u or "macintosh" in u:
        os_name = "macOS"
    elif "linux" in u:
        os_name = "Linux"
    else:
        os_name = "Other"
    return device, browser, os_name


def source_for(page_url: str, referrer: str, own_host: str) -> str:
    qs = parse_qs(urlsplit(page_url).query)
    utm = (qs.get("utm_source") or qs.get("ref") or [""])[0].strip().lower()
    if utm:
        return utm[:80]
    if not referrer:
        return "direct"
    host = (urlsplit(referrer).hostname or "").lower()
    if not host:
        return "direct"
    host = host[4:] if host.startswith("www.") else host
    if own_host and (host == own_host or host.endswith("." + own_host)):
        return ""  # internal navigation
    for key, name in SEARCH.items():
        if re.search(rf"(^|\.){key}\.", host + "."):
            return name
    for domain, name in SOCIAL.items():
        if host == domain or host.endswith("." + domain):
            return name
    return host[:80]


def clean_path(raw: str) -> str | None:
    if not raw or not raw.startswith("/") or len(raw) > 600:
        return None
    path = urlsplit(raw).path or "/"
    path = re.sub(r"/{2,}", "/", path)
    if len(path) > 1:
        path = path.rstrip("/")
    if path.startswith(SKIP_PATHS):
        return None
    return path[:300]


def visitor_id(day: date, ip: str, ua: str) -> str:
    raw = f"{day.isoformat()}|{settings.SECRET_KEY}|{ip}|{ua}".encode()
    return hashlib.sha256(raw).hexdigest()[:16]


def too_many(ip: str) -> bool:
    key = f"track:{hashlib.sha1(ip.encode()).hexdigest()[:12]}"
    if cache.add(key, 1, 60):
        return False
    try:
        return cache.incr(key) > MAX_HITS_PER_MINUTE
    except ValueError:
        return False
