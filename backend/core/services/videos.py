"""Video pipeline: probe on upload, then re-encode to H.264/AAC 720p with ffmpeg (inline thread or cron)."""
import json
import logging
import os
import shutil
import subprocess
import tempfile
import threading
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.db import close_old_connections

log = logging.getLogger(__name__)


def ffmpeg_available() -> bool:
    return bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))


def probe(path: str) -> dict:
    """Return {'duration', 'width', 'height'} using ffprobe (zeros if unavailable)."""
    if not ffmpeg_available():
        return {"duration": 0, "width": 0, "height": 0}
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", path],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    try:
        data = json.loads(out.stdout or "{}")
        stream = (data.get("streams") or [{}])[0]
        return {
            "duration": int(float(data.get("format", {}).get("duration", 0))),
            "width": int(stream.get("width", 0)),
            "height": int(stream.get("height", 0)),
        }
    except (ValueError, KeyError):
        return {"duration": 0, "width": 0, "height": 0}


def transcode(video) -> None:
    """Re-encode one ProjectVideo in place. Safe to call again on failure."""
    from ..models import ProjectVideo

    if not ffmpeg_available():
        video.state, video.error = ProjectVideo.State.FAILED, "ffmpeg not installed"
        video.save(update_fields=["state", "error", "updated_at"])
        return

    video.state = ProjectVideo.State.PROCESSING
    video.save(update_fields=["state", "updated_at"])
    src = video.file.path
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "out.mp4")
        poster = os.path.join(tmp, "poster.webp")
        cmd = [
            "ffmpeg", "-y", "-i", src,
            "-vf", "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", out,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=900, check=False)
        if result.returncode != 0 or not os.path.exists(out):
            video.state, video.error = ProjectVideo.State.FAILED, result.stderr[-2000:]
            video.save(update_fields=["state", "error", "updated_at"])
            return
        subprocess.run(["ffmpeg", "-y", "-ss", "1", "-i", out, "-frames:v", "1", "-vf", "scale=720:-2", poster], capture_output=True, timeout=120, check=False)

        meta = probe(out)
        old_name = video.file.name
        with open(out, "rb") as fh:
            video.file.save(f"{Path(old_name).stem}.mp4", File(fh), save=False)
        if os.path.exists(poster):
            with open(poster, "rb") as fh:
                video.poster.save(f"{Path(old_name).stem}.webp", File(fh), save=False)
        if old_name != video.file.name:
            video.file.storage.delete(old_name)
        video.bytes = video.file.size
        video.width, video.height, video.duration = meta["width"], meta["height"], meta["duration"] or video.duration
        video.state, video.error = ProjectVideo.State.READY, ""
        video.save()


def transcode_async(video_id: int) -> None:
    """Fire-and-forget re-encode in a daemon thread (VIDEO_TRANSCODE_INLINE=true)."""

    def run():
        from ..models import ProjectVideo

        close_old_connections()
        try:
            video = ProjectVideo.objects.get(pk=video_id)
            transcode(video)
        except Exception:  # noqa: BLE001 - background job must never crash the worker
            log.exception("video transcode failed for %s", video_id)
        finally:
            close_old_connections()

    if settings.VIDEO_TRANSCODE_INLINE:
        threading.Thread(target=run, daemon=True).start()
