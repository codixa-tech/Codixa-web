"""Privacy-friendly page-view log: no cookies and no stored IP addresses.

A visitor is identified per day by a hash of (day, secret, IP, browser), so the same person is counted once a
day and cannot be followed across days.
"""
from django.db import models


class Visit(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    day = models.DateField()
    path = models.CharField(max_length=300)
    visitor = models.CharField(max_length=16)
    source = models.CharField(max_length=80, blank=True)  # "google", "facebook.com", "direct"…
    device = models.CharField(max_length=8)  # mobile / tablet / desktop
    browser = models.CharField(max_length=20, blank=True)
    os = models.CharField(max_length=20, blank=True)
    lang = models.CharField(max_length=2, blank=True)
    country = models.CharField(max_length=2, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["day", "visitor"], name="visit_day_visitor_idx"),
            models.Index(fields=["created_at"], name="visit_created_idx"),
            models.Index(fields=["path", "day"], name="visit_path_day_idx"),
        ]
