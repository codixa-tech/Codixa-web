from django.contrib import admin

from .models import ActivityLog, Grant, OAuthClient


@admin.register(OAuthClient)
class OAuthClientAdmin(admin.ModelAdmin):
    list_display = ("name", "client_id", "created_at")
    readonly_fields = ("client_id", "redirect_uris", "created_at")


@admin.register(Grant)
class GrantAdmin(admin.ModelAdmin):
    list_display = ("client", "user", "created_at", "last_used_at", "revoked_at")
    list_select_related = ("client", "user")


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "source", "user", "action", "target", "ok")
    list_filter = ("source", "ok")
    search_fields = ("action", "target")
    list_select_related = ("user",)

    def has_change_permission(self, request, obj=None):
        return False

    def has_add_permission(self, request):
        return False
