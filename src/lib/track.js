import { api } from '../data/api.js';

let first = true;
let last = '';

/**
 * Report one page view to the server (cookieless; see backend analytics app). The first page of a visit
 * carries the referrer so the server can tell where the visitor came from.
 */
export function trackPage(pathname, search = '') {
  const url = api.analytics?.trackUrl;
  if (!url || pathname.startsWith('/dashboard')) return;
  try {
    if (localStorage.getItem('codixa.notrack') === '1') return;
  } catch {
    /* storage unavailable: count the visit */
  }
  const page = pathname + search;
  if (page === last) return;
  last = page;
  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    /* old browser */
  }
  const body = JSON.stringify({
    p: page,
    r: first ? document.referrer : '',
    f: first ? 1 : 0,
    tz,
    l: pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'ar',
  });
  first = false;
  const blob = new Blob([body], { type: 'application/json' });
  if (!(navigator.sendBeacon && navigator.sendBeacon(url, blob))) {
    fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
  }
}
