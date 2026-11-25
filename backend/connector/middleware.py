"""Write dashboard changes (POST/PUT/PATCH/DELETE on /api/) to the activity log.

DRF copies the authenticated user onto the Django request, so after the view runs we know who made the change.
"""
import re

from .models import ActivityLog

SKIP = ("/api/auth/", "/api/public/", "/api/pdf/")
WRITE = {"POST", "PUT", "PATCH", "DELETE"}
VERB = {"POST": "create", "PUT": "update", "PATCH": "update", "DELETE": "delete"}


class DashboardActivityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            self._log(request, response)
        except Exception:  # noqa: BLE001 — logging must never break a request
            pass
        return response

    @staticmethod
    def _log(request, response):
        path = request.path
        if request.method not in WRITE or not path.startswith("/api/") or path.startswith(SKIP):
            return
        if path.startswith("/api/connector/"):
            return  # logged explicitly by the view
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated or response.status_code >= 400:
            return
        parts = [p for p in path[len("/api/"):].split("/") if p]
        resource = parts[0] if parts else "api"
        ident = next((p for p in parts[1:] if re.fullmatch(r"\d+", p)), "")
        extra = "/".join(p for p in parts[1:] if not re.fullmatch(r"\d+", p))
        action = f"{resource}.{extra or VERB[request.method]}"
        fwd = request.META.get("HTTP_X_FORWARDED_FOR")
        ActivityLog.objects.create(
            user=user,
            source=ActivityLog.Source.DASHBOARD,
            action=action[:80],
            target=f"{resource} #{ident}" if ident else "",
            detail={"method": request.method, "status": response.status_code},
            ip=(fwd.split(",")[0].strip() if fwd else request.META.get("REMOTE_ADDR")) or None,
        )
