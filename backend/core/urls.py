from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import admin as a
from .views import public as p
from .views import reports as r
from connector import views as cv


class ThrottledLogin(TokenObtainPairView):
    throttle_scope = "login"

    def get_throttles(self):
        from rest_framework.throttling import ScopedRateThrottle

        return [ScopedRateThrottle()]


router = DefaultRouter(trailing_slash=True)
router.register("projects", a.ProjectViewSet, basename="project")
router.register("clients", a.ClientViewSet, basename="client")
router.register("payments", a.PaymentViewSet, basename="payment")
router.register("contracts", a.ContractViewSet, basename="contract")
router.register("messages", a.MessageViewSet, basename="message")

urlpatterns = [
    # Auth
    path("auth/token/", ThrottledLogin.as_view(), name="token"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/me/", a.me, name="me"),
    # Public website
    path("public/projects/", p.public_projects, name="public-projects"),
    path("public/settings/", p.public_settings, name="public-settings"),
    path("public/contact/", p.public_contact, name="public-contact"),
    # Dashboard
    path("media/images/", a.upload_image, name="upload-image"),
    path("media/videos/", a.upload_video, name="upload-video"),
    path("settings/", a.site_settings, name="settings"),
    path("settings/test-email/", a.site_test_email, name="settings-test-email"),
    path("settings/signature/", a.site_signature, name="settings-signature"),
    path("stats/overview/", a.stats_overview, name="stats"),
    path("backup/export/", a.backup_export, name="backup"),
    path("projects/<int:pk>/report/", r.project_report, name="project-report"),
    path("contracts/<int:pk>/pdf/", r.contract_pdf, name="contract-pdf"),
    # Claude connector & activity log
    path("connector/", cv.connector_info, name="connector-info"),
    path("connector/grants/<int:pk>/revoke/", cv.connector_revoke, name="connector-revoke"),
    path("activity/", cv.activity_list, name="activity"),
    path("pdf/<str:token>/", cv.signed_pdf, name="signed-pdf"),
    path("", include(router.urls)),
]
