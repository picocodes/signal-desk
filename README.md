# SignalDesk

SignalDesk is a WordPress-friendly search growth workspace: establish business context, build a content opportunity plan, move pages through an evidence-led pipeline, and publish through a small connector plugin.

## Current vertical slice

- Persistent business onboarding and topic pipeline
- Deterministic demo planning provider (clearly labelled)
- Responsive dashboard with loading, empty, success, error and disabled states
- PostgreSQL startup migrations and `/health` database check
- Multi-stage Docker build and Coolify-ready Compose service
- WordPress connector with shared-secret authentication and draft publishing

## Local development

Node 22 and PostgreSQL are required.

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
- `WORDPRESS_SHARED_SECRET`
- `APP_URL`

Expose the `app` service on port `3000`. PostgreSQL stays internal. The application runs idempotent schema migrations before listening and reports readiness at `/health`.

## Provider boundary

`LLM_PROVIDER=demo` and `KEYWORD_PROVIDER=demo` are intentional. They make the first deployment testable without presenting invented search data as real. Live LLM research and keyword-data adapters are the next implementation slice.

## WordPress connector

Zip the contents of `wordpress-connector`, install it in WordPress, and save the same shared secret under **Settings → SignalDesk**. The connector exposes:

- `GET /wp-json/signaldesk/v1/status`
- `POST /wp-json/signaldesk/v1/drafts`

Both require `X-SignalDesk-Secret`.
