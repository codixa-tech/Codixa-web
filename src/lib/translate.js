// Automatic Arabic <-> English translation for dashboard content.
//
// Uses free public translation endpoints from the browser. When the Django backend is connected,
// move this call to the server (e.g. Google Cloud Translation or DeepL) and keep the same signature.

const cache = new Map();

async function myMemory(text, from, to) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP_' + res.status);
  const json = await res.json();
  const out = json?.responseData?.translatedText;
  if (!out || json.responseStatus >= 400 || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out)) throw new Error('MYMEMORY_FAILED');
  return out;
}

async function googleFree(text, from, to) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP_' + res.status);
  const json = await res.json();
  return (json?.[0] || []).map((p) => p[0]).join('');
}

/** Translate `text` from `from` to `to` ('ar' | 'en'). Throws if every provider fails. */
export async function translate(text, from, to) {
  const src = (text || '').trim();
  if (!src || from === to) return src;
  const key = `${from}|${to}|${src}`;
  if (cache.has(key)) return cache.get(key);
  let out = '';
  try {
    out = await googleFree(src, from, to);
  } catch {
    out = await myMemory(src, from, to);
  }
  out = (out || '').trim();
  if (!out) throw new Error('TRANSLATE_FAILED');
  cache.set(key, out);
  return out;
}

/**
 * Fill the empty side of a bilingual value {ar, en} from the other side.
 * Returns the (possibly) completed object; never overwrites text the user typed.
 */
export async function completeBilingual(value) {
  const v = typeof value === 'string' ? { ar: '', en: value } : { ar: value?.ar || '', en: value?.en || '' };
  if (v.ar.trim() && !v.en.trim()) v.en = await translate(v.ar, 'ar', 'en');
  else if (v.en.trim() && !v.ar.trim()) v.ar = await translate(v.en, 'en', 'ar');
  return v;
}

export const isBilingualEmpty = (v) => !v || (typeof v === 'object' && !v.ar?.trim() && !v.en?.trim());
