from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from store import seo as store_seo

admin.site.site_header = "Codixa"
admin.site.site_title = "Codixa"

urlpatterns = [
    path("api/", include("core.urls")),
    path("api/", include("store.urls")),
    path("api/", include("analytics.urls")),
    path(settings.ADMIN_URL, admin.site.urls),
    path("", include("connector.urls")),
    # Store pages with server-rendered SEO (nginx routes /store and /en/store here)
    re_path(r"^store/?$", store_seo.store_page, {"lang": "ar"}),
    re_path(r"^store/(?P<slug>[-\w]+)/?$", store_seo.store_page, {"lang": "ar"}),
    re_path(r"^en/store/?$", store_seo.store_page, {"lang": "en"}),
    re_path(r"^en/store/(?P<slug>[-\w]+)/?$", store_seo.store_page, {"lang": "en"}),
    path("sitemap-store.xml", store_seo.sitemap),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
