# Codixa — Website + Control Panel (React)

Single-page React app (Vite):

- **`/`** — the public one-page site (Arabic / English, RTL / LTR), with the logo loader, services, work (projects + training with category filters and an image slider), ERP & IBM Maximo (with Smart System as partner), training, process, about and contact.
- **`/dashboard`** — the control panel: projects with dynamic fields per category, image compression, reels/videos, access credentials, payments, clients, contact-form messages, backup.

The dashboard is a separate chunk: visitors of the public site never download it.

---

## Backend (Django + DRF)

The `backend/` folder contains the API, PDF reports and contracts — see `backend/README.md`.
Without it the site runs in **demo mode** (data in the browser). To connect it, create `.env.local` in this
folder with `VITE_API_URL=/api`, start Django (`python manage.py runserver`) and run `npm run dev`.

## 1. Run it locally

Requirements: **Node.js 18+** (20 LTS recommended).

```bash
cd codixa-web
npm install
npm run dev
```

Open http://localhost:5173 (the site) and http://localhost:5173/dashboard (the control panel).

Demo login for the dashboard: **admin / codixa**. This is a demo gate only; real authentication comes with the Django backend.

## 2. Production build

```bash
npm run build      # outputs static files to dist/
npm run preview    # serves dist/ at http://localhost:4173 to test the build
```

### Serve `dist/` with Nginx

Each public page has its own static file (`/erpnext/index.html`, `/en/index.html` …); everything else falls back to `index.html` for the React app:

```nginx
server {
    listen 80;
    server_name codixa.tech www.codixa.tech;
    root /var/www/codixa/dist;
    index index.html;

    # Long cache for hashed assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
```

Unknown URLs render the Codixa **404 page** (with search across projects, training and services).
Because this is a single-page app the server still answers 200, so the 404 page adds `noindex` for search engines.

### Offline support
`public/sw.js` (registered only in production builds) caches the app shell, assets and images after the
first visit. If the connection drops — or a visitor refreshes without internet — the site still opens and
shows the **offline screen**, which disappears automatically when the connection returns.
After changing `sw.js`, bump `VERSION` inside it so visitors get the new cache.

When the Django backend is added, proxy `/api/` and `/media/` to Gunicorn in the same server block.

---

## 3. SEO

**Before deploying, set your real domain** in `src/seo/config.js` → `SITE_URL` (used for canonical URLs, hreflang, sitemap and structured data).

What the build does (`npm run build`):
- A **separate URL per language**: Arabic at `/`, English at `/en`, each with `hreflang` alternates.
- **Keyword landing pages** in both languages: `/software-development`, `/erpnext`, `/ibm-maximo`, `/training` (+ `/en/...`). Content lives in `src/seo/pages.js`.
- A **static HTML file per page** (`dist/erpnext/index.html`, …) with its own title, description, canonical, Open Graph/Twitter tags, JSON-LD (Organization, WebSite, Service, Course, BreadcrumbList, FAQPage) and the full page text, so crawlers that do not run JavaScript still read everything.
- `sitemap.xml`, `robots.txt` (blocks `/dashboard`), `404.html`, `manifest.webmanifest`.

After deploying:
1. Add the domain to **Google Search Console**, submit `https://<domain>/sitemap.xml`, and request indexing for the home and the four service pages.
2. Create a **Google Business Profile** (Cairo address, phone +201067106891, category “Software company”); link it to the site.
3. Add the social profile links in **Dashboard → Site settings** (they also feed `sameAs` in structured data on the next build).
4. Get listed and linked from relevant places: Frappe/ERPNext partner directory and forum, LinkedIn company page, Smart System’s site, training partners and Egyptian/Saudi business directories.
5. Publish real project photos and descriptions; consider a blog (ERPNext and Maximo how-tos) once the Django backend is live.

Note: projects added in the dashboard are not in the static HTML until the Django backend serves them; the service pages and home content are.

## 4. Where to change things

| What | File |
|---|---|
| Contact email, phone, WhatsApp, address, social links, partner | **Dashboard → Site settings** (no code change needed) |
| All Arabic / English copy | `src/i18n/ar.js`, `src/i18n/en.js` |
| Colors, type scale, spacing | `src/styles/tokens.css` |
| Project categories and **their fields** (what each project type stores) | `src/config/categories.js` |
| Sample data loaded on first run | `src/data/seed.js` |
| Logo (vector) | `src/components/Logo.jsx` |

### Adding a field to a category
Add one line to that category in `src/config/categories.js`, e.g.:

```js
{ key: 'cpanel_url', label: L('رابط cPanel', 'cPanel URL'), type: 'url', secret: true },
```

The dashboard form, the credentials tab and the public project page pick it up automatically.
`public: true` shows it on the website; `secret: true` puts it under “Access & credentials” and never sends it to the site.

### Home page showcase
The image showcase next to the headline shows projects and trainings marked
**“Show in home page showcase”** in the project editor (first image of each). The Training section
shows photos from published training projects.

### Automatic translation (Arabic ⇄ English)
Write a project's name, description and bilingual details (e.g. organization, city) in one language;
the other language is filled in automatically when you save, or press **Translate automatically**.
Text you typed yourself is never overwritten. Visitors see each project in the language they chose.
Translation runs from the browser through free public endpoints (`src/lib/translate.js`); move it to
the Django backend (Google Cloud Translation / DeepL) for production.

### Sample content
The sample projects/clients marked “(sample)” / “Sample …” and their images in `public/seed/` are placeholders.
Delete or edit them from the dashboard, or use **Settings → Reset demo data** to restore them.

---

## 5. How data works today (before the backend)

`src/data/api.js` is the only file that knows where data lives. Today it stores records in
`localStorage` (key `codixa.db.v2`) and images/videos in IndexedDB (browser only, per device). Every function is async
and shaped like the planned REST endpoints:

| UI call | Planned Django REST endpoint |
|---|---|
| `api.projects.list(filters)` | `GET /api/projects/?kind=&category=&status=&q=` |
| `api.projects.list({ publishedOnly: true })` | `GET /api/public/projects/` (no money, no credentials) |
| `api.projects.get(id)` / `save()` / `remove()` | `GET / POST / PUT / DELETE /api/projects/:id/` |
| `api.payments.*` | `/api/payments/` |
| `api.clients.*` | `/api/clients/` |
| `api.messages.create()` | `POST /api/contact/` (public, rate-limited) |
| `api.stats.overview()` | `GET /api/stats/overview/` |
| `api.settings.get()` / `save()` | `GET / PUT /api/settings/` |

When the backend is ready, replace the function bodies with `fetch()` calls; no component changes are needed.

### Media pipeline
- **Images** are resized to max 1920 px and re-encoded to WebP (quality 0.8) **in the browser before upload**, plus a 640 px thumbnail for grids. A 7.7 MB phone photo became ~300 KB in testing.
- **Videos/reels** are validated (MP4/MOV/WebM, ≤ 80 MB, ≤ 120 s) and get a poster frame in the browser. Real compression belongs on the server: the backend should re-encode with ffmpeg, e.g.
  `ffmpeg -i in.mp4 -vf "scale='min(720,iw)':-2" -c:v libx264 -preset veryfast -crf 28 -c:a aac -b:a 96k -movflags +faststart out.mp4`

### Security note
Credentials entered in demo mode are stored in this browser only, unencrypted. Do not enter real
server passwords until the backend is connected. The backend should encrypt secret fields at rest
(e.g. Fernet / `django-cryptography`), restrict them to admin users, and require 2FA to reveal them.

---

## 6. Project structure

```
src/
  main.jsx, App.jsx           entry + routes (dashboard lazy-loaded)
  config/                      site settings + category schema
  i18n/                        AR/EN dictionaries + provider (sets dir/lang)
  data/                        api.js (data layer), seed.js, idb.js (media store)
  lib/                         formatting, image/video processing, hooks
  components/                  Logo, Loader, Dialog, Toast, Media, icons
  site/                        public one-page sections + DiamondField hero canvas
  dashboard/                   control panel pages, forms, dynamic fields, media manager
public/
  brand/                       favicon, touch icon, social share image
  seed/                        placeholder project images (WebP)
```
