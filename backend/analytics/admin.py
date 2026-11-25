from django.contrib import admin

from .models import Visit


@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    list_display = ("created_at", "path", "source", "device", "country", "lang")
    list_filter = ("device", "lang", "country")
    date_hierarchy = "day"
