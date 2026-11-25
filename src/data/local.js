// Local (browser-only) data API — used when no backend is configured (VITE_API_URL unset).
// Same surface as remote.js so the UI does not care which one is active.
//
// Every function is async and returns plain JSON-like objects shaped like the future
// Django REST Framework endpoints, e.g.:
//   GET    /api/projects/?kind=&category=&status=&q=     -> api.projects.list(filters)
//   GET    /api/projects/:id/                             -> api.projects.get(id)
//   POST   /api/projects/  |  PUT /api/projects/:id/      -> api.projects.save(data)
//   DELETE /api/projects/:id/                             -> api.projects.remove(id)
//   ...same for /api/payments/, /api/clients/, /api/messages/
//
// Today it persists to localStorage (+ IndexedDB for media) so the whole product works
// before the backend exists. Replacing the bodies below with fetch() calls is the only
// change the UI needs when the backend is ready.

import { SEED } from './seed.js';
import { forgetMedia, mediaStore } from './idb.js';
import { CATEGORY_MAP } from '../config/categories.js';

const KEY = 'codixa.db.v2';
const listeners = new Set();
let cache = null;

function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      cache = JSON.parse(raw);
      // Keep older stores working when new top-level collections are added.
      cache.settings = { ...SEED.settings, ...(cache.settings || {}), social: { ...SEED.settings.social, ...(cache.settings?.social || {}) } };
      ['projects', 'clients', 'payments', 'messages', 'contracts'].forEach((k) => (cache[k] ||= []));
      return cache;
    }
  } catch {}
  cache = structuredClone(SEED);
  persist();
  return cache;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('[api] could not persist', e);
    throw new Error('STORAGE_FULL');
  }
  listeners.forEach((fn) => fn());
}

export function subscribe(fn) {
  listeners.add(fn);
  const onStorage = (e) => {
    if (e.key === KEY) {
      cache = null;
      fn();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}

const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const delay = (v) => Promise.resolve(structuredClone(v));
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function enrich(project, db) {
  const payments = db.payments.filter((p) => p.projectId === project.id);
  const paid = round2(payments.reduce((s, p) => s + Number(p.amount || 0), 0));
  const cost = round2(project.cost);
  const client = db.clients.find((c) => c.id === project.clientId) || null;
  return {
    ...project,
    paid,
    remaining: round2(cost - paid),
    paymentsCount: payments.length,
    client: client ? { id: client.id, name: client.name, company: client.company } : null,
  };
}

function matchesQuery(p, q) {
  if (!q) return true;
  const s = q.trim().toLowerCase();
  return [p.title?.ar, p.title?.en, p.client?.name, p.client?.company].some((v) => v && v.toLowerCase().includes(s));
}

export const api = {
  projects: {
    async list({ kind, category, status, q, publishedOnly } = {}) {
      const db = load();
      const rows = db.projects
        .map((p) => enrich(p, db))
        .filter((p) => (!kind || p.kind === kind) && (!category || p.category === category) && (!status || p.status === status))
        .filter((p) => !publishedOnly || p.published)
        .filter((p) => matchesQuery(p, q))
        .sort((a, b) => (b.featured - a.featured) || String(b.startDate || b.createdAt).localeCompare(String(a.startDate || a.createdAt)));
      if (publishedOnly) {
        // Public payload never includes money, client contact data or credentials.
        return delay(rows.map(publicProject));
      }
      return delay(rows);
    },
    async get(id) {
      const db = load();
      const p = db.projects.find((x) => x.id === id);
      return p ? delay(enrich(p, db)) : null;
    },
    async save(data) {
      const db = load();
      const now = new Date().toISOString();
      const clean = { ...data };
      delete clean.paid;
      delete clean.remaining;
      delete clean.paymentsCount;
      delete clean.client;
      clean.cost = round2(clean.cost);
      if (clean.id) {
        const i = db.projects.findIndex((x) => x.id === clean.id);
        if (i === -1) throw new Error('NOT_FOUND');
        db.projects[i] = { ...db.projects[i], ...clean, updatedAt: now };
      } else {
        clean.id = uid('prj');
        clean.createdAt = now;
        clean.updatedAt = now;
        db.projects.push(clean);
      }
      persist();
      return api.projects.get(clean.id);
    },
    async remove(id) {
      const db = load();
      const p = db.projects.find((x) => x.id === id);
      if (!p) return;
      [...(p.images || []), ...(p.videos || [])].forEach((m) => {
        forgetMedia(m.src);
        if (m.poster) forgetMedia(m.poster);
        if (m.thumb) forgetMedia(m.thumb);
      });
      db.projects = db.projects.filter((x) => x.id !== id);
      db.payments = db.payments.filter((x) => x.projectId !== id);
      persist();
    },
  },

  payments: {
    async list({ projectId, clientId } = {}) {
      const db = load();
      const rows = db.payments
        .filter((p) => (!projectId || p.projectId === projectId))
        .map((p) => {
          const prj = db.projects.find((x) => x.id === p.projectId);
          const client = prj && db.clients.find((c) => c.id === prj.clientId);
          return { ...p, project: prj ? { id: prj.id, title: prj.title, currency: prj.currency } : null, client: client ? { id: client.id, name: client.name } : null };
        })
        .filter((p) => !clientId || p.client?.id === clientId)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return delay(rows);
    },
    async save(data) {
      const db = load();
      const amount = round2(data.amount);
      if (!(amount > 0)) throw new Error('INVALID_AMOUNT');
      if (!db.projects.some((p) => p.id === data.projectId)) throw new Error('INVALID_PROJECT');
      const row = { ...data, amount };
      if (row.id) {
        const i = db.payments.findIndex((x) => x.id === row.id);
        db.payments[i] = { ...db.payments[i], ...row };
      } else {
        row.id = uid('pay');
        row.createdAt = new Date().toISOString();
        db.payments.push(row);
      }
      persist();
      return delay(row);
    },
    async remove(id) {
      const db = load();
      db.payments = db.payments.filter((x) => x.id !== id);
      persist();
    },
  },

  clients: {
    async list({ q } = {}) {
      const db = load();
      const s = (q || '').trim().toLowerCase();
      const rows = db.clients
        .filter((c) => !s || [c.name, c.company, c.email, c.phone].some((v) => v && v.toLowerCase().includes(s)))
        .map((c) => {
          const projects = db.projects.filter((p) => p.clientId === c.id).map((p) => enrich(p, db));
          const totals = {};
          projects.forEach((p) => {
            const t = (totals[p.currency] ||= { cost: 0, paid: 0 });
            t.cost = round2(t.cost + p.cost);
            t.paid = round2(t.paid + p.paid);
          });
          return { ...c, projectsCount: projects.length, totals };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      return delay(rows);
    },
    async save(data) {
      const db = load();
      const row = { ...data, name: (data.name || '').trim() };
      if (!row.name) throw new Error('NAME_REQUIRED');
      delete row.projectsCount;
      delete row.totals;
      if (row.id) {
        const i = db.clients.findIndex((x) => x.id === row.id);
        db.clients[i] = { ...db.clients[i], ...row };
      } else {
        row.id = uid('cli');
        row.createdAt = new Date().toISOString();
        db.clients.push(row);
      }
      persist();
      return delay(row);
    },
    async remove(id) {
      const db = load();
      db.clients = db.clients.filter((x) => x.id !== id);
      db.projects.forEach((p) => {
        if (p.clientId === id) p.clientId = null;
      });
      persist();
    },
  },

  messages: {
    async list() {
      const db = load();
      return delay([...db.messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    },
    async create(data) {
      const db = load();
      const row = { ...data, id: uid('msg'), read: false, createdAt: new Date().toISOString() };
      db.messages.push(row);
      persist();
      return delay(row);
    },
    async markRead(id) {
      const db = load();
      const m = db.messages.find((x) => x.id === id);
      if (m) m.read = true;
      persist();
    },
    async remove(id) {
      const db = load();
      db.messages = db.messages.filter((x) => x.id !== id);
      persist();
    },
  },

  stats: {
    async overview() {
      const db = load();
      const projects = db.projects.map((p) => enrich(p, db));
      const byCurrency = {};
      projects
        .filter((p) => p.cost > 0)
        .forEach((p) => {
          const c = (byCurrency[p.currency] ||= { contract: 0, received: 0, outstanding: 0, byMonth: {} });
          c.contract = round2(c.contract + p.cost);
          c.received = round2(c.received + p.paid);
          c.outstanding = round2(c.outstanding + Math.max(0, p.remaining));
        });
      db.payments.forEach((pay) => {
        const prj = db.projects.find((p) => p.id === pay.projectId);
        if (!prj) return;
        const c = (byCurrency[prj.currency] ||= { contract: 0, received: 0, outstanding: 0, byMonth: {} });
        const k = String(pay.date).slice(0, 7);
        c.byMonth[k] = round2((c.byMonth[k] || 0) + Number(pay.amount || 0));
      });
      return delay({
        byCurrency,
        active: projects.filter((p) => p.status === 'in_progress').length,
        completed: projects.filter((p) => p.status === 'completed').length,
        total: projects.length,
        attention: projects.filter((p) => p.cost > 0 && p.remaining > 0).sort((a, b) => b.remaining - a.remaining).slice(0, 6),
        unread: db.messages.filter((m) => !m.read).length,
      });
    },
  },

  contracts: {
    async list({ projectId } = {}) {
      const db = load();
      return delay((db.contracts || []).filter((c) => !projectId || c.projectId === projectId).sort((a, b) => String(b.contractDate).localeCompare(String(a.contractDate))));
    },
    async draft(projectId) {
      const db = load();
      const p = db.projects.find((x) => x.id === projectId);
      const c = p && db.clients.find((x) => x.id === p.clientId);
      const total = Number(p?.cost) || 0;
      const rows = [
        ['دفعة مقدمة عند توقيع العقد', 'Advance payment on signing', 30],
        ['بعد اعتماد التصميم والعرض الأولي', 'After design approval and first demo', 30],
        ['عند التسليم للاختبار', 'On delivery for acceptance testing', 30],
        ['عند التسليم النهائي', 'On final handover', 10],
      ];
      return delay({
        projectId,
        status: 'draft',
        title: { ar: `عقد تنفيذ ${p?.title?.ar || p?.title?.en || ''}`, en: `Agreement for ${p?.title?.en || p?.title?.ar || ''}` },
        contractDate: new Date().toISOString().slice(0, 10),
        startDate: p?.startDate || '',
        endDate: p?.endDate || '',
        durationDays: null,
        totalValue: total,
        currency: p?.currency || 'EGP',
        clientName: c?.name || '',
        clientCompany: c?.company || '',
        clientRepresentative: c?.name || '',
        clientIdNumber: c?.idNumber || '',
        clientAddress: c?.address || '',
        clientPhone: c?.phone || '',
        clientEmail: c?.email || '',
        scope: { ...(p?.summary || { ar: '', en: '' }) },
        deliverables: [],
        installments: rows.map(([labelAr, labelEn, percent]) => ({ labelAr, labelEn, percent, amount: round2((total * percent) / 100), due: '' })),
        warrantyDays: 90,
        supportMonths: 3,
        clientObligations: { ar: '', en: '' },
        extraTerms: { ar: '', en: '' },
        notes: '',
      });
    },
    async save(data) {
      const db = load();
      db.contracts ||= [];
      const row = { ...data };
      if (row.id) {
        const i = db.contracts.findIndex((x) => x.id === row.id);
        db.contracts[i] = { ...db.contracts[i], ...row };
      } else {
        const year = new Date().getFullYear();
        const seq = db.contracts.filter((x) => String(x.number).startsWith(`CDX-${year}-`)).length + 1;
        row.id = uid('ctr');
        row.number = `CDX-${year}-${String(seq).padStart(4, '0')}`;
        row.createdAt = new Date().toISOString();
        db.contracts.push(row);
      }
      persist();
      return delay(row);
    },
    async remove(id) {
      const db = load();
      db.contracts = (db.contracts || []).filter((x) => x.id !== id);
      persist();
    },
  },

  // PDFs are produced by the Django backend (WeasyPrint); not available in local mode.
  reports: { available: false },
  connector: { available: false },
  // The store, booking and visitor statistics need the Django server.
  store: { available: false, list: async () => [], get: async () => null, order: async () => ({ id: 0 }) },
  analytics: { available: false, trackUrl: '' },
  activity: { list: async () => [] },

  media: {
    // Local mode keeps processed media in IndexedDB (see lib/media.js).
    remote: false,
  },

  auth: {
    async login(username, password) {
      if (username.trim() === 'admin' && password === 'codixa') {
        sessionStorage.setItem('codixa.auth', '1');
        return true;
      }
      throw new Error('INVALID_CREDENTIALS');
    },
    logout() {
      sessionStorage.removeItem('codixa.auth');
    },
    isAuthed() {
      return sessionStorage.getItem('codixa.auth') === '1';
    },
    demo: true,
  },

  settings: {
    async get() {
      return delay(load().settings);
    },
    async getAdmin() {
      return delay(load().settings);
    },
    async save(data) {
      const db = load();
      db.settings = { ...db.settings, ...data, social: { ...db.settings.social, ...(data.social || {}) } };
      persist();
      return delay(db.settings);
    },
  },

  backup: {
    async export() {
      return delay({ app: 'codixa', version: 1, exportedAt: new Date().toISOString(), data: load() });
    },
    async import(json) {
      if (!json || json.app !== 'codixa' || !json.data || !Array.isArray(json.data.projects)) throw new Error('INVALID_BACKUP');
      const { projects, clients = [], payments = [], messages = [], contracts = [], settings = {} } = json.data;
      cache = { projects, clients, payments, messages, contracts, settings: { ...SEED.settings, ...settings } };
      persist();
    },
    canRestore: true,
    async reset() {
      await mediaStore.clear().catch(() => {});
      cache = structuredClone(SEED);
      persist();
    },
  },
};

function publicProject(p) {
  return {
    id: p.id,
    kind: p.kind,
    category: p.category,
    title: p.title,
    summary: p.summary,
    status: p.status,
    progress: p.progress,
    featured: p.featured,
    startDate: p.startDate,
    endDate: p.endDate,
    images: p.images || [],
    videos: p.videos || [],
    details: publicDetails(p),
    client: p.client && p.showClient !== false ? { name: p.client.company || p.client.name } : null,
  };
}

function publicDetails(p) {
  const fields = CATEGORY_MAP[p.category]?.fields || [];
  const out = {};
  fields.forEach((f) => {
    const v = p.details?.[f.key];
    if (f.public && !f.secret && v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)) out[f.key] = v;
  });
  return out;
}
