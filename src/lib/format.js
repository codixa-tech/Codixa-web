export function money(value, currency = 'EGP', locale = 'en-US') {
  const n = Number(value) || 0;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  } catch {
    return `${n.toLocaleString(locale)} ${currency}`;
  }
}

export function number(value, locale = 'en-US') {
  return new Intl.NumberFormat(locale).format(Number(value) || 0);
}

export function date(value, locale = 'en-US', opts = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!value) return '—';
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, opts).format(d);
}

export function bytes(n) {
  if (!n && n !== 0) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i ? 1 : 0)} ${u[i]}`;
}

export function today() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function yearOf(p) {
  const v = p.endDate || p.startDate;
  return v ? v.slice(0, 4) : '';
}
