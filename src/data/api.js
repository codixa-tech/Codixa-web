// Picks the data source: the Django backend when VITE_API_URL is set, otherwise the browser-only demo store.
import * as local from './local.js';
import * as remote from './remote.js';

export const isRemote = Boolean(import.meta.env.VITE_API_URL);
const impl = isRemote ? remote : local;

export const api = impl.api;
export const subscribe = impl.subscribe;
