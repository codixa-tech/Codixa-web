"""Invalidate the public cache whenever content shown on the site changes."""
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Client, Project, ProjectImage, ProjectVideo, SiteSettings
from .services import cache


@receiver([post_save, post_delete], sender=Project)
@receiver([post_save, post_delete], sender=ProjectImage)
@receiver([post_save, post_delete], sender=ProjectVideo)
@receiver([post_save, post_delete], sender=SiteSettings)
@receiver([post_save, post_delete], sender=Client)
def bump_public_cache(**kwargs):
    cache.bump()


@receiver(post_delete, sender=ProjectImage)
def delete_image_files(sender, instance, **kwargs):
    for f in (instance.image, instance.thumb):
        if f:
            f.storage.delete(f.name)


@receiver(post_delete, sender=ProjectVideo)
def delete_video_files(sender, instance, **kwargs):
    for f in (instance.file, instance.poster):
        if f:
            f.storage.delete(f.name)
