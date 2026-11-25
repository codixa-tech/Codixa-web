"""Server-side image normalisation: every upload is re-encoded to WebP at a bounded size plus a thumbnail.

The dashboard already compresses in the browser; this is the authoritative step so the server never
stores oversized or unsafe originals (EXIF stripped, orientation applied, decompression-bomb guarded).
"""
import io
import uuid

from django.conf import settings
from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

Image.MAX_IMAGE_PIXELS = 60_000_000  # ~60 MP guard against decompression bombs


class ImageError(ValueError):
    pass


def _encode(img: Image.Image, max_side: int, quality: int) -> tuple[bytes, int, int]:
    im = img.copy()
    im.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=5)
    return buf.getvalue(), im.width, im.height


def process_upload(uploaded) -> dict:
    """Return {'image': ContentFile, 'thumb': ContentFile, width, height, bytes, original_bytes}."""
    if uploaded.size > settings.IMAGE_MAX_UPLOAD_MB * 1024 * 1024:
        raise ImageError("too_big")
    try:
        img = Image.open(uploaded)
        img = ImageOps.exif_transpose(img)
        img.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ImageError("not_image") from exc

    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "A" in img.getbands() else "RGB")

    full, w, h = _encode(img, settings.IMAGE_MAX_SIDE, 80)
    thumb, _, _ = _encode(img, settings.THUMB_MAX_SIDE, 72)
    stem = uuid.uuid4().hex[:16]
    return {
        "image": ContentFile(full, name=f"{stem}.webp"),
        "thumb": ContentFile(thumb, name=f"{stem}_t.webp"),
        "width": w,
        "height": h,
        "bytes": len(full),
        "original_bytes": uploaded.size,
    }
