from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from core.services import cache

from .models import System, SystemImage


@receiver([post_save, post_delete], sender=System)
@receiver([post_save, post_delete], sender=SystemImage)
def bump_store_cache(sender, **kwargs):
    cache.bump()


@receiver(post_delete, sender=SystemImage)
def delete_files(sender, instance, **kwargs):
    for f in (instance.image, instance.thumb):
        if f:
            f.delete(save=False)
