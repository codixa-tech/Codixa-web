from django.contrib import admin

from .models import System, SystemImage


class SystemImageInline(admin.TabularInline):
    model = SystemImage
    extra = 0
    fields = ("image", "position")


@admin.register(System)
class SystemAdmin(admin.ModelAdmin):
    list_display = ("title_ar", "title_en", "category", "published", "featured", "position")
    list_filter = ("published", "category")
    search_fields = ("title_ar", "title_en", "slug")
    inlines = [SystemImageInline]
