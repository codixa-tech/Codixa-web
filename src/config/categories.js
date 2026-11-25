// Category schema — single source of truth shared with the Django backend (backend reads the same JSON).
// The dashboard builds its forms from it; the public site shows only fields marked `public`;
// fields marked `secret` are stored encrypted by the backend and never sent to the public API.
// Field types: text | url | textarea | number | date | select | multiselect | tags | bool | secret
import schema from './categories.json';

export const STATUSES = schema.statuses;
export const CATEGORIES = schema.categories;
export const PAYMENT_METHODS = schema.paymentMethods;
export const CURRENCIES = schema.currencies;

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
export const PROJECT_CATEGORIES = CATEGORIES.filter((c) => c.kind === 'project');

/** Value of an option (plain string or {v, ar, en}). */
export const optValue = (o) => (typeof o === 'string' ? o : o.v);

/** Translated label for a stored select/multiselect value. */
export function optLabel(field, value, lang) {
  const o = field?.options?.find((x) => optValue(x) === value);
  if (!o || typeof o === 'string') return value;
  return o[lang] || o.v;
}
