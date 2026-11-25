"""Codixa backend settings. Everything environment-specific comes from env vars (see .env.example)."""
import os
from datetime import timedelta
from pathlib import Path

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BASE_DIR.parent


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader (no extra dependency). Real environment variables win."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [v.strip() for v in os.environ.get(name, default).split(",") if v.strip()]


DEBUG = env_bool("DJANGO_DEBUG", False)
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY") or ("dev-insecure-key" if DEBUG else "")
if not SECRET_KEY:
    raise RuntimeError("DJANGO_SECRET_KEY is required when DJANGO_DEBUG is false")

# Public address of the site, e.g. https://codixa.tech (OAuth metadata, links returned by the connector,
# and the default for ALLOWED_HOSTS / CSRF_TRUSTED_ORIGINS below).
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")
_public_host = PUBLIC_BASE_URL.split("://", 1)[-1].split("/", 1)[0] if PUBLIC_BASE_URL else ""

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
if _public_host:
    ALLOWED_HOSTS += [h for h in (_public_host, f"www.{_public_host}") if h not in ALLOWED_HOSTS]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "django_filters",
    "corsheaders",
    "core",
    "store",
    "analytics",
    "connector",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.middleware.gzip.GZipMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.http.ConditionalGetMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "connector.middleware.DashboardActivityMiddleware",
]

ROOT_URLCONF = "codixa.urls"
WSGI_APPLICATION = "codixa.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=60,
        conn_health_checks=True,
    )
}

_redis = os.environ.get("REDIS_URL")
CACHES = {
    "default": (
        {"BACKEND": "django.core.cache.backends.redis.RedisCache", "LOCATION": _redis}
        if _redis
        else {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "codixa"}
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "ar"
LANGUAGES = [("ar", "العربية"), ("en", "English")]
TIME_ZONE = "Africa/Cairo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", BASE_DIR / "media"))
MEDIA_PUBLIC_BASE = os.environ.get("MEDIA_PUBLIC_BASE", "").rstrip("/")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
DATA_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024  # room for a base64 image sent through the connector
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

# ---- Project specific -------------------------------------------------------
# Shared with the React app: which project fields exist, which are public, which are secret.
CATEGORIES_FILE = Path(os.environ.get("CATEGORIES_FILE", REPO_DIR / "src" / "config" / "categories.json"))
FIELD_ENCRYPTION_KEY = os.environ.get("FIELD_ENCRYPTION_KEY", "")
VIDEO_TRANSCODE_INLINE = env_bool("VIDEO_TRANSCODE_INLINE", True)
IMAGE_MAX_SIDE = 1920
THUMB_MAX_SIDE = 640
IMAGE_MAX_UPLOAD_MB = 15
VIDEO_MAX_UPLOAD_MB = 80
VIDEO_MAX_SECONDS = 120
MAX_IMAGES_PER_PROJECT = 12
PUBLIC_CACHE_SECONDS = 300

# Django admin lives at an unguessable path in production (set DJANGO_ADMIN_URL, e.g. "control-7f3k2/").
ADMIN_URL = os.environ.get("DJANGO_ADMIN_URL", "django-admin/").strip("/") + "/"

# ---- E-mail (new order / message notifications) ---------------------------
# Gmail: EMAIL_HOST=smtp.gmail.com, EMAIL_PORT=587, EMAIL_HOST_USER=you@gmail.com and an App Password
# (Google account → Security → 2-Step Verification → App passwords) in EMAIL_HOST_PASSWORD.
EMAIL_HOST = os.environ.get("EMAIL_HOST", "")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", EMAIL_PORT == 587)
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", EMAIL_PORT == 465)
EMAIL_TIMEOUT = 20
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL") or (f"Codixa Website <{EMAIL_HOST_USER}>" if EMAIL_HOST_USER else "Codixa <noreply@localhost>")
# A host that needs a login (Gmail) only counts as configured once the password is filled in.
EMAIL_CONFIGURED = bool(EMAIL_HOST) and not (EMAIL_HOST.endswith("gmail.com") and not (EMAIL_HOST_USER and EMAIL_HOST_PASSWORD))
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend" if EMAIL_CONFIGURED else "django.core.mail.backends.console.EmailBackend"
# Send notifications in a background thread right after the request (cron `send_emails` retries failures).
EMAIL_SEND_INLINE = env_bool("EMAIL_SEND_INLINE", True)

# Built React site (npm run build); Django fills the store pages from dist/_store.html.
FRONTEND_DIST = os.environ.get("FRONTEND_DIST", str(REPO_DIR / "dist"))

# ---- Visitor analytics -------------------------------------------------------
ANALYTICS_RESPECT_DNT = env_bool("ANALYTICS_RESPECT_DNT", False)

# ---- Claude connector (MCP + OAuth) ----------------------------------------
# Only these redirect addresses can receive authorization codes (plus http://localhost for Claude Code).
CONNECTOR_REDIRECT_URIS = [
    "https://claude.ai/api/mcp/auth_callback",
    "https://claude.com/api/mcp/auth_callback",
    *env_list("CONNECTOR_EXTRA_REDIRECT_URIS", ""),
]
# Tests only: allow downloading media from local addresses.
CONNECTOR_ALLOW_PRIVATE_URLS = False

# ---- API --------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["core.permissions.IsStaff"],
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"]
    + (["rest_framework.renderers.BrowsableAPIRenderer"] if DEBUG else []),
    "DEFAULT_THROTTLE_RATES": {"contact": "5/hour", "order": "6/hour", "login": "10/min"},
    "EXCEPTION_HANDLER": "core.exceptions.api_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "UPDATE_LAST_LOGIN": True,
}

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", "")
if PUBLIC_BASE_URL and PUBLIC_BASE_URL not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append(PUBLIC_BASE_URL)

# ---- Security (production) ---------------------------------------------------
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)  # Nginx also redirects; this is the safety net
    SILENCED_SYSTEM_CHECKS = ["security.W021"]  # HSTS preload list is an opt-in decision, not a default
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
    X_FRAME_OPTIONS = "DENY"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "weasyprint": {"level": "ERROR"},
        "fontTools": {"level": "WARNING"},
    },
}
