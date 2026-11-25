from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter(trailing_slash=True)
router.register("systems", views.SystemViewSet, basename="system")

# Mounted under /api/
urlpatterns = [
    path("public/systems/", views.public_systems, name="public-systems"),
    path("public/systems/<slug:slug>/", views.public_system, name="public-system"),
    path("public/systems/<slug:slug>/order/", views.public_order, name="public-order"),
    path("store/images/", views.upload_system_image, name="store-image"),
    path("store/editor-images/", views.upload_editor_image, name="editor-image"),
    *router.urls,
]
