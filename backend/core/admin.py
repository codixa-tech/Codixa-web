from django.contrib import admin

from .models import Client, ContactMessage, Contract, Payment, Project, ProjectImage, ProjectVideo, SiteSettings


class ImageInline(admin.TabularInline):
    model = ProjectImage
    extra = 0
    fields = ("image", "position", "width", "height", "bytes")
    readonly_fields = ("width", "height", "bytes")


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("__str__", "category", "status", "client", "cost", "currency", "published", "featured")
    list_filter = ("kind", "category", "status", "published", "featured")
    search_fields = ("title_ar", "title_en", "client__name", "client__company")
    list_select_related = ("client",)
    exclude = ("secrets",)
    inlines = [ImageInline, PaymentInline]


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("name", "company", "email", "phone", "country")
    search_fields = ("name", "company", "email", "phone")


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("project", "amount", "date", "method", "reference")
    list_filter = ("method",)
    list_select_related = ("project",)
    date_hierarchy = "date"


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ("number", "project", "client_name", "total_value", "currency", "status", "contract_date")
    list_filter = ("status",)
    search_fields = ("number", "client_name", "client_company")
    list_select_related = ("project",)


@admin.register(ContactMessage)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "service", "is_read", "created_at")
    list_filter = ("is_read", "service")


admin.site.register(ProjectVideo)
admin.site.register(SiteSettings)
