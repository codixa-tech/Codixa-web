// Minimal IndexedDB blob store for compressed images, video files and posters.
// localStorage is limited to ~5 MB, so media lives here and records only keep `idb:<id>` references.
const DB_NAME = 'codixa-media';
const STORE = 'blobs';
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        const out = fn(store);
        t.oncomplete = () => resolve(out?.result ?? out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export const mediaStore = {
  put: (id, blob) => tx('readwrite', (s) => s.put(blob, id)),
  get: (id) => tx('readonly', (s) => s.get(id)),
  remove: (id) => tx('readwrite', (s) => s.delete(id)),
  clear: () => tx('readwrite', (s) => s.clear()),
};

const urlCache = new Map();

/** Resolve a media src to something an <img>/<video> can use. */
export async function resolveMedia(src) {
  if (!src) return '';
  if (!src.startsWith('idb:')) return src;
  const id = src.slice(4);
  if (urlCache.has(id)) return urlCache.get(id);
  const blob = await mediaStore.get(id);
  if (!blob) return '';
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

export function forgetMedia(src) {
  if (!src?.startsWith('idb:')) return;
  const id = src.slice(4);
  const url = urlCache.get(id);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(id);
  return mediaStore.remove(id).catch(() => {});
}
