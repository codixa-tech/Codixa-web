from django.urls import path

from . import views

# Mounted under /api/
urlpatterns = [
    path("public/track/", views.track, name="track"),
    path("analytics/overview/", views.overview, name="analytics-overview"),
]
