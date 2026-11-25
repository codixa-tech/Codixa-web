// Client-side media processing. Images are resized and re-encoded to WebP before they are
// stored or uploaded, so the server never receives multi-megabyte camera photos.
// Videos are validated here and re-encoded by the backend (ffmpeg) once it is connected.
import { mediaStore } from '../data/idb.js';
import { api } from '../data/api.js';

export const IMAGE_MAX_SIDE = 1920;
export const THUMB_MAX_SIDE = 640;
export const IMAGE_QUALITY = 0.8;
export const MAX_IMAGES = 12;
export const VIDEO_MAX_MB = 80;
export const VIDEO_MAX_SECONDS = 120;

const uid = () => `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

async function decode(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to <img> decoding */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function encode(source, maxSide, quality) {
  const sw = source.width;
  const sh = source.height;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('ENCODE_FAILED'));
        // Safari < 16 cannot encode WebP and silently returns PNG; fall back to JPEG there.
        if (blob.type !== 'image/webp') {
          canvas.toBlob((jpg) => (jpg ? resolve({ blob: jpg, w, h }) : reject(new Error('ENCODE_FAILED'))), 'image/jpeg', quality);
        } else resolve({ blob, w, h });
      },
      'image/webp',
      quality
    );
  });
}

/**
 * Compress one image (WebP, max 1920 px). Uploads it to the backend (`upload`, default: project images),
 * or stores it locally in demo mode.
 */
export async function processImage(file, upload = api.media.uploadImage) {
  const bitmap = await decode(file);
  const full = await encode(bitmap, IMAGE_MAX_SIDE, IMAGE_QUALITY);
  if (api.media.remote) {
    bitmap.close?.();
    const rec = await upload(full.blob, `${(file.name || 'image').replace(/\.[^.]+$/, '')}.webp`);
    return { ...rec, originalBytes: file.size, name: file.name };
  }
  const thumb = await encode(bitmap, THUMB_MAX_SIDE, 0.72);
  bitmap.close?.();
  const id = uid();
  await mediaStore.put(id, full.blob);
  await mediaStore.put(`${id}_t`, thumb.blob);
  return {
    id,
    src: `idb:${id}`,
    thumb: `idb:${id}_t`,
    w: full.w,
    h: full.h,
    bytes: full.blob.size,
    originalBytes: file.size,
    name: file.name,
  };
}

function readVideoMeta(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    v.onloadedmetadata = () => {
      const meta = { duration: v.duration, w: v.videoWidth, h: v.videoHeight };
      v.currentTime = Math.min(1, v.duration / 3 || 0);
      v.onseeked = async () => {
        try {
          const poster = await encode(v, 720, 0.72);
          resolve({ ...meta, poster: poster.blob });
        } catch {
          resolve({ ...meta, poster: null });
        } finally {
          URL.revokeObjectURL(url);
        }
      };
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('VIDEO_UNREADABLE'));
    };
  });
}

/** Validate a video (size, duration), extract a poster frame, store it. Throws coded errors. */
export async function processVideo(file) {
  if (!/^video\/(mp4|quicktime|webm)$/.test(file.type)) throw Object.assign(new Error('NOT_VIDEO'), { code: 'notVideo' });
  if (file.size > VIDEO_MAX_MB * 1024 * 1024) throw Object.assign(new Error('TOO_BIG'), { code: 'tooBig' });
  const meta = await readVideoMeta(file);
  if (meta.duration > VIDEO_MAX_SECONDS + 0.5) throw Object.assign(new Error('TOO_LONG'), { code: 'tooLong' });
  if (api.media.remote) {
    // The server re-encodes to H.264 720p with ffmpeg in the background.
    const rec = await api.media.uploadVideo(file, meta.poster);
    return { ...rec, vertical: meta.h > meta.w, duration: rec.duration || Math.round(meta.duration) };
  }
  const id = uid();
  await mediaStore.put(id, file);
  let poster = '';
  if (meta.poster) {
    await mediaStore.put(`${id}_p`, meta.poster);
    poster = `idb:${id}_p`;
  }
  return {
    id,
    src: `idb:${id}`,
    poster,
    w: meta.w,
    h: meta.h,
    vertical: meta.h > meta.w,
    duration: Math.round(meta.duration),
    bytes: file.size,
    name: file.name,
  };
}
