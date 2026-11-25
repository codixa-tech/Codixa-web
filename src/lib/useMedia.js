import { useEffect, useState } from 'react';
import { resolveMedia } from '../data/idb.js';

/** Resolve `idb:` media references to object URLs; plain URLs pass through. */
export function useMediaUrl(src) {
  const [url, setUrl] = useState(() => (src && !src.startsWith('idb:') ? src : ''));
  useEffect(() => {
    let alive = true;
    if (!src) {
      setUrl('');
      return;
    }
    if (!src.startsWith('idb:')) {
      setUrl(src);
      return;
    }
    resolveMedia(src).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [src]);
  return url;
}
