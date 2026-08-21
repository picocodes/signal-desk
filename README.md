# SignalDesk

SignalDesk is a multi-tenant, WordPress-friendly search growth SaaS. Organizations connect sites, index existing content, reserve an AI-assisted publishing calendar, and generate each article only when it becomes due.

## MVP capabilities

- Password and magic-link authentication, secure sessions, tenant and platform roles
- Organizations, plan limits, projects, invitations, Stripe checkout/portal/webhooks
- Cloudflare AI Gateway generation and Workers AI embeddings
- PostgreSQL + pgvector content index and database-backed worker queue
- Monthly calendars with due-date-only generation, retries, quota reservation, and notifications
- Revocable WordPress pairing with idempotent Gutenberg draft/live publishing
- Encrypted super-admin settings and operational views

## Local development

Node 22 and PostgreSQL 17 with pgvector are required.

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd run dev
```

The Vite development UI runs on `http://localhost:5173` and proxies API calls to port 3000.

## Coolify deployment

Create a Docker Compose resource from this repository and set:

- `POSTGRES_PASSWORD`
- `SESSION_SECRET` (32+ random characters)
- `APP_ENCRYPTION_KEY` (32+ random characters)
- `APP_URL`
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the initial super-admin

Expose the `app` service on port `3000`. The `worker` and PostgreSQL services stay internal. Both application processes run advisory-lock-protected migrations. Health and readiness are available at `/health` and `/ready`.

Cloudflare and Stripe can be configured through the super-admin UI. Without Cloudflare credentials, calendar and article generation use clearly non-production fallback content so infrastructure can still be tested; no fabricated keyword-volume metrics are presented.

## WordPress connector

Zip the contents of `wordpress-connector`, install it in WordPress, generate a pairing token in the project, and paste the project endpoint and token under **Settings → SignalDesk**. The connector exposes:

- `GET /wp-json/signaldesk/v1/status`
- `GET /wp-json/signaldesk/v1/content`
- `POST /wp-json/signaldesk/v1/drafts`

All routes require `X-SignalDesk-Token`.
