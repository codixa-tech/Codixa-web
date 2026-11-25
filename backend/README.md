# Codixa backend — Django + Django REST Framework

API for the Codixa website and dashboard: projects (with images/videos), clients, payments,
contracts, contact messages, site settings, and PDF reports/contracts generated with WeasyPrint.

## Run locally (Windows / macOS / Linux)

Requires Python 3.10+ (tested with 3.12 and 3.13).

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate      macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env        # Linux/macOS: cp .env.example .env  — then set DJANGO_DEBUG=true for local work
python manage.py migrate
python manage.py createsuperuser   # your dashboard login
python manage.py seed_demo         # optional sample content
python manage.py runserver
```

Then in the project root create `.env.local` with `VITE_API_URL=/api` and run `npm run dev`.
Vite forwards `/api` and `/media` to Django on port 8000, so the dashboard and site use the real API.

**WeasyPrint on Windows** needs the GTK/Pango runtime. If `import weasyprint` fails, install MSYS2 and run
`pacman -S mingw-w64-x86_64-pango`, then add `C:\msys64\mingw64\bin` to PATH
(see https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#windows). On Ubuntu servers:
`sudo apt install libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0`.

## Tests

```bash
python manage.py test core
```

Covers permissions, encryption of credentials at rest, no private data in public responses, cache
invalidation, money totals without N+1 queries, image processing, contract numbering, PDF endpoints,
contact throttling and stats.

## API overview

| Endpoint | Who | Purpose |
|---|---|---|
| `POST /api/auth/token/`, `/auth/token/refresh/` | anyone | JWT login (10/min throttle) |
| `GET /api/public/projects/`, `/public/settings/` | anyone | Website content (cached, versioned) |
| `POST /api/public/contact/` | anyone | Contact form (5/hour per IP) |
| `/api/projects/`, `/clients/`, `/payments/`, `/contracts/`, `/messages/` | staff | Dashboard CRUD |
| `POST /api/media/images/`, `/media/videos/` | staff | Uploads (images → WebP ≤1920 px + thumbnail; videos → H.264 720p) |
| `GET /api/contracts/draft/?projectId=` | staff | Pre-filled contract for a project |
| `GET /api/projects/{id}/report/?type=client|internal&lang=ar|en[&secrets=1]` | staff | PDF reports |
| `GET /api/contracts/{id}/pdf/?lang=ar|en` | staff | Contract PDF |
| `GET|PUT /api/settings/`, `POST|DELETE /api/settings/signature/` | staff | Site & document settings, signature |
| `GET /api/stats/overview/`, `/backup/export/` | staff | Dashboard stats, JSON backup |

## Design notes

- **Credentials** (server IPs, passwords, keys) are stored in `Project.secrets`, encrypted with Fernet
  (`FIELD_ENCRYPTION_KEY`). They never appear in public responses or client reports. **Back up the key** —
  without it the stored credentials cannot be decrypted.
- **Which fields are secret/public** comes from `src/config/categories.json`, shared with the React app.
- **Performance**: indexes on every filter/sort path (see `core/migrations/0001_initial.py`), money totals
  via a single annotated subquery, `select_related`/`prefetch_related` everywhere, versioned cache for
  public endpoints (invalidated by signals on save/delete), GZip and conditional GET (ETag) middleware.
- **PDFs**: templates in `core/templates/core/pdf/`, fonts bundled in `core/static/core/fonts/`
  (IBM Plex Sans Arabic), stamp and signature in `_stamp.html` / `_signatures.html`.

## Claude connector (MCP)

`connector/` adds a remote MCP server at `/mcp` so Claude can work in the dashboard:

- **OAuth 2.1** (`connector/oauth.py`): discovery metadata, Dynamic Client Registration limited to Claude's
  callback URLs (plus loopback for Claude Code), authorization code + mandatory PKCE S256, login and consent
  page for staff users only, refresh-token rotation with reuse detection, hashed tokens, login attempt limits.
- **Tools** (`connector/tools.py`): catalog, overview, search/get/create/update projects, add images and
  videos (public link or base64, SSRF-guarded download), clients, payments, contract drafts, signed PDF links.
  Project credentials are never returned or accepted, and there are no delete tools.
- **Activity log**: every connector call and every dashboard change (middleware) is stored in `ActivityLog`
  and shown in the dashboard under "Claude & activity", where access can also be revoked.

## Deploy

See [`../deploy/README.md`](../deploy/README.md): `deploy/setup_server.sh` prepares a fresh Ubuntu server
(PostgreSQL, Redis, Gunicorn, Nginx, HTTPS, cron, backups); `deploy/deploy.sh` applies updates.
