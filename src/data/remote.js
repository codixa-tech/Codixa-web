// Remote data API — talks to the Django REST backend (VITE_API_URL, e.g. "/api").
// Same surface as local.js. Auth uses JWT (access + refresh) with automatic refresh on 401.

const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const TOKENS = 'codixa.jwt';
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const changed = () => listeners.forEach((fn) => fn());

const tokens = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(TOKENS)) || null;
    } catch {
      return null;
    }
  },
  set(t) {
    localStorage.setItem(TOKENS, JSON.stringify(t));
  },
  clear() {
    localStorage.removeItem(TOKENS);
  },
};

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `HTTP_${status}`);
    this.status = status;
    this.body = body;
  }
}

let refreshing = null;
async function refreshAccess() {
  const t = tokens.get();
  if (!t?.refresh) return false;
  refreshing ||= fetch(`${BASE}/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: t.refresh }),
  })
    .then(async (r) => {
      if (!r.ok) return false;
      const data = await r.json();
      tokens.set({ access: data.access, refresh: data.refresh || t.refresh });
      return true;
    })
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

async function http(path, { method = 'GET', body, auth = true, raw = false, retry = true } = {}) {
  const headers = {};
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const t = tokens.get();
  if (auth && t?.access) headers.Authorization = `Bearer ${t.access}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body) });
  if (res.status === 401 && auth && retry && (await refreshAccess())) return http(path, { method, body, auth, raw, retry: false });
  if (res.status === 401 && auth) {
    tokens.clear();
    window.dispatchEvent(new Event('codixa:logout'));
  }
  if (!res.ok) {
    let data = null;
    try {
      data = await res.json();
    } catch {}
    throw new ApiError(res.status, data);
  }
  if (raw) return res;
  return res.status === 204 ? null : res.json();
}

const qs = (o) => {
  const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const s = p.toString();
  return s ? `?${s}` : '';
};

/** Fetch a PDF with the auth header and open it in a new tab (falls back to download). */
async function openPdf(path) {
  const win = window.open('', '_blank');
  try {
    const res = await http(path, { raw: true });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (win) win.location.href = url;
    else {
      const a = document.createElement('a');
      a.href = url;
      a.download = path.split('/').filter(Boolean).slice(-2).join('-') + '.pdf';
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    win?.close();
    throw e;
  }
}

const mutate = async (p) => {
  const r = await p;
  changed();
  return r;
};

export const api = {
  projects: {
    list: (f = {}) =>
      f.publishedOnly ? http('/public/projects/', { auth: false }).then((rows) => (f.kind ? rows.filter((r) => r.kind === f.kind) : rows)) : http(`/projects/${qs({ kind: f.kind, category: f.category, status: f.status, q: f.q })}`),
    get: (id) => http(`/projects/${id}/`).catch((e) => (e.status === 404 ? null : Promise.reject(e))),
    save: (data) => mutate(data.id ? http(`/projects/${data.id}/`, { method: 'PUT', body: data }) : http('/projects/', { method: 'POST', body: data })),
    remove: (id) => mutate(http(`/projects/${id}/`, { method: 'DELETE' })),
  },
  payments: {
    list: (f = {}) => http(`/payments/${qs(f)}`),
    save: (data) => {
      const body = { projectId: data.projectId, amount: data.amount, date: data.date, method: data.method, reference: data.reference || '', note: data.note || '' };
      return mutate(data.id ? http(`/payments/${data.id}/`, { method: 'PUT', body }) : http('/payments/', { method: 'POST', body }));
    },
    remove: (id) => mutate(http(`/payments/${id}/`, { method: 'DELETE' })),
  },
  clients: {
    list: (f = {}) => http(`/clients/${qs(f)}`),
    save: (data) => {
      const { projectsCount, totals, createdAt, ...body } = data;
      return mutate(data.id ? http(`/clients/${data.id}/`, { method: 'PUT', body }) : http('/clients/', { method: 'POST', body }));
    },
    remove: (id) => mutate(http(`/clients/${id}/`, { method: 'DELETE' })),
  },
  messages: {
    list: (f = {}) => http(`/messages/${qs(f)}`),
    setStatus: (id, status) => mutate(http(`/messages/${id}/`, { method: 'PATCH', body: { status, read: true } })),
    create: (data) => http('/public/contact/', { method: 'POST', body: data, auth: false }),
    markRead: (id) => mutate(http(`/messages/${id}/`, { method: 'PATCH', body: { read: true } })),
    remove: (id) => mutate(http(`/messages/${id}/`, { method: 'DELETE' })),
  },
  contracts: {
    list: (f = {}) => http(`/contracts/${qs(f)}`),
    draft: (projectId) => http(`/contracts/draft/${qs({ projectId })}`),
    save: (data) => {
      const { project, signedFile, createdAt, number, ...body } = data;
      return mutate(data.id ? http(`/contracts/${data.id}/`, { method: 'PUT', body }) : http('/contracts/', { method: 'POST', body }));
    },
    remove: (id) => mutate(http(`/contracts/${id}/`, { method: 'DELETE' })),
    uploadSigned: (id, file) => {
      const fd = new FormData();
      fd.append('file', file);
      return mutate(http(`/contracts/${id}/signed-file/`, { method: 'POST', body: fd }));
    },
    openPdf: (id, lang) => openPdf(`/contracts/${id}/pdf/${qs({ lang })}`),
  },
  reports: {
    available: true,
    open: (projectId, { type = 'client', lang = 'ar', secrets = false } = {}) =>
      openPdf(`/projects/${projectId}/report/${qs({ type, lang, secrets: secrets ? 1 : '' })}`),
  },
  media: {
    remote: true,
    uploadImage: (blob, name = 'image.webp') => {
      const fd = new FormData();
      fd.append('file', blob, name);
      return http('/media/images/', { method: 'POST', body: fd });
    },
    uploadVideo: (file, posterBlob) => {
      const fd = new FormData();
      fd.append('file', file, file.name);
      if (posterBlob) fd.append('poster', posterBlob, 'poster.webp');
      return http('/media/videos/', { method: 'POST', body: fd });
    },
  },
  stats: { overview: () => http('/stats/overview/') },
  settings: {
    get: () => http('/public/settings/', { auth: false }),
    getAdmin: () => http('/settings/'),
    save: (data) => mutate(http('/settings/', { method: 'PUT', body: data })),
    uploadSignature: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return mutate(http('/settings/signature/', { method: 'POST', body: fd }));
    },
    removeSignature: () => mutate(http('/settings/signature/', { method: 'DELETE' })),
    testEmail: () => http('/settings/test-email/', { method: 'POST', body: {} }),
  },
  store: {
    available: true,
    list: () => http('/public/systems/', { auth: false }),
    get: (slug) => http(`/public/systems/${encodeURIComponent(slug)}/`, { auth: false }).catch((e) => (e.status === 404 ? null : Promise.reject(e))),
    order: (slug, data) => http(`/public/systems/${encodeURIComponent(slug)}/order/`, { method: 'POST', body: data, auth: false }),
    admin: {
      list: () => http('/systems/'),
      get: (id) => http(`/systems/${id}/`).catch((e) => (e.status === 404 ? null : Promise.reject(e))),
      save: (data) => mutate(data.id ? http(`/systems/${data.id}/`, { method: 'PUT', body: data }) : http('/systems/', { method: 'POST', body: data })),
      remove: (id) => mutate(http(`/systems/${id}/`, { method: 'DELETE' })),
      uploadImage: (blob, name = 'image.webp') => {
        const fd = new FormData();
        fd.append('file', blob, name);
        return http('/store/images/', { method: 'POST', body: fd });
      },
      uploadEditorImage: (blob, name = 'image.webp') => {
        const fd = new FormData();
        fd.append('file', blob, name);
        return http('/store/editor-images/', { method: 'POST', body: fd });
      },
    },
  },
  analytics: {
    available: true,
    overview: (days = 30) => http(`/analytics/overview/${qs({ days })}`),
    trackUrl: `${BASE}/public/track/`,
  },
  connector: {
    available: true,
    info: () => http('/connector/'),
    revoke: (id) => http(`/connector/grants/${id}/revoke/`, { method: 'POST' }),
  },
  activity: {
    list: (params = {}) => http(`/activity/${qs(params)}`),
  },
  backup: {
    export: () => http('/backup/export/'),
    canRestore: false,
  },
  auth: {
    async login(username, password) {
      const data = await http('/auth/token/', { method: 'POST', body: { username, password }, auth: false });
      tokens.set({ access: data.access, refresh: data.refresh });
      return true;
    },
    logout() {
      tokens.clear();
    },
    isAuthed: () => !!tokens.get()?.refresh,
    demo: false,
  },
};
