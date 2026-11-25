import { useState } from 'react';
import { useMediaUrl } from '../lib/useMedia.js';

/** Image that resolves `idb:` refs, lazy-loads, and fades in once decoded (no layout shift: pass w/h). */
export function Img({ src, alt = '', w, h, className = '', eager = false, sizes, ...rest }) {
  const url = useMediaUrl(src);
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={url || undefined}
      alt={alt}
      width={w}
      height={h}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchpriority={eager ? 'high' : undefined}
      sizes={sizes}
      className={`img ${loaded ? 'is-loaded' : ''} ${className}`}
      onLoad={() => setLoaded(true)}
      {...rest}
    />
  );
}

export function Video({ src, poster, className = '', ...rest }) {
  const url = useMediaUrl(src);
  const posterUrl = useMediaUrl(poster);
  return <video src={url || undefined} poster={posterUrl || undefined} className={className} preload="none" playsInline controls {...rest} />;
}
