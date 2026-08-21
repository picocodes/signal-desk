import pg from "pg";
import { hash } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";

const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined, max: 15 });

const migrations: Array<[string, string]> = [["001_multitenant", `
create extension if not exists vector;
create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now());
create table if not exists users (
 id uuid primary key, email text not null unique, name text not null, password_hash text, platform_role text not null default 'customer' check(platform_role in ('super_admin','moderator','customer')),
 timezone text not null default 'UTC', email_verified_at timestamptz, must_change_password boolean not null default false, suspended_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists sessions (id uuid primary key, user_id uuid not null references users(id) on delete cascade, token_hash text not null unique, expires_at timestamptz not null, last_seen_at timestamptz not null default now(), user_agent text, ip text, revoked_at timestamptz, created_at timestamptz not null default now());
create table if not exists auth_tokens (id uuid primary key, user_id uuid not null references users(id) on delete cascade, kind text not null check(kind in ('verify','reset','magic','email_change')), token_hash text not null unique, payload jsonb not null default '{}', expires_at timestamptz not null, used_at timestamptz, created_at timestamptz not null default now());
create table if not exists plans (id uuid primary key, slug text not null unique, name text not null, project_limit int not null, post_limit int not null, trial_days int not null default 0, grace_days int not null default 7, stripe_product_id text, stripe_price_id text, active boolean not null default true, created_at timestamptz not null default now());
create table if not exists organizations (id uuid primary key, name text not null, slug text not null unique, billing_email text not null, plan_id uuid references plans(id), stripe_customer_id text, subscription_status text not null default 'trialing', current_period_start timestamptz not null default now(), current_period_end timestamptz not null default (now()+interval '14 days'), suspended_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists memberships (organization_id uuid not null references organizations(id) on delete cascade, user_id uuid not null references users(id) on delete cascade, role text not null check(role in ('owner','admin','editor','viewer')), created_at timestamptz not null default now(), primary key(organization_id,user_id));
create table if not exists invitations (id uuid primary key, organization_id uuid not null references organizations(id) on delete cascade, email text not null, role text not null, token_hash text not null unique, expires_at timestamptz not null, accepted_at timestamptz, invited_by uuid references users(id), created_at timestamptz not null default now());
create table if not exists projects (
 id uuid primary key, organization_id uuid not null references organizations(id) on delete cascade, name text not null, canonical_url text not null, canonical_host text not null,
 audience text not null default '', offer text not null default '', tone text not null default '', locale text not null default 'en', timezone text not null default 'UTC', author_name text not null default '', content_goals text not null default '', required_terms text[] not null default '{}', forbidden_terms text[] not null default '{}',
 publish_mode text not null default 'draft' check(publish_mode in ('draft','publish')), notify_on_publish boolean not null default true, notification_emails text[] not null default '{}', sitemap_urls text[] not null default '{}', crawl_exclusions text[] not null default '{}', recrawl_hours int not null default 168,
 connector_token_hash text, connector_last_seen_at timestamptz, connector_site jsonb, embedding_model text, embedding_status text not null default 'pending', active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(canonical_host)
);
create table if not exists crawled_pages (id uuid primary key, project_id uuid not null references projects(id) on delete cascade, url text not null, canonical_url text not null, title text not null default '', headings jsonb not null default '[]', body text not null default '', author text, published_at timestamptz, modified_at timestamptz, content_hash text not null, links jsonb not null default '[]', indexed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(project_id,canonical_url));
create table if not exists content_chunks (id uuid primary key, project_id uuid not null references projects(id) on delete cascade, page_id uuid not null references crawled_pages(id) on delete cascade, heading text, content text not null, ordinal int not null, embedding vector, embedding_model text, created_at timestamptz not null default now(), unique(page_id,ordinal));
create table if not exists calendars (id uuid primary key, project_id uuid not null references projects(id) on delete cascade, month date not null, status text not null default 'active', created_at timestamptz not null default now(), unique(project_id,month));
create table if not exists scheduled_items (id uuid primary key, calendar_id uuid not null references calendars(id) on delete cascade, project_id uuid not null references projects(id) on delete cascade, title text not null, keyword text not null, intent text not null, rationale text not null default '', priority int not null default 50, scheduled_for timestamptz not null, status text not null default 'scheduled' check(status in ('scheduled','generating','drafted','published','failed','skipped')), quota_period text not null, attempts int not null default 0, last_error text, locked_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists article_versions (id uuid primary key, scheduled_item_id uuid not null references scheduled_items(id) on delete cascade, version int not null, title text not null, content text not null, citations jsonb not null default '[]', internal_links jsonb not null default '[]', model text not null, input_tokens int not null default 0, output_tokens int not null default 0, created_at timestamptz not null default now(), unique(scheduled_item_id,version));
create table if not exists publication_attempts (id uuid primary key, scheduled_item_id uuid not null references scheduled_items(id) on delete cascade, article_version_id uuid references article_versions(id), idempotency_key text not null unique, attempt int not null, status text not null, response jsonb, error text, created_at timestamptz not null default now());
create table if not exists jobs (id uuid primary key, kind text not null, payload jsonb not null, status text not null default 'queued' check(status in ('queued','running','complete','failed')), run_at timestamptz not null default now(), attempts int not null default 0, max_attempts int not null default 3, locked_at timestamptz, locked_by text, error text, completed_at timestamptz, created_at timestamptz not null default now());
create index if not exists jobs_ready_idx on jobs(status,run_at); create index if not exists scheduled_due_idx on scheduled_items(status,scheduled_for); create index if not exists chunks_project_idx on content_chunks(project_id);
create table if not exists notifications (id uuid primary key, user_id uuid references users(id) on delete cascade, organization_id uuid references organizations(id) on delete cascade, kind text not null, subject text not null, body text not null, status text not null default 'pending', sent_at timestamptz, error text, created_at timestamptz not null default now());
create table if not exists app_settings (key text primary key, value jsonb not null, secret boolean not null default false, updated_by uuid references users(id), updated_at timestamptz not null default now());
create table if not exists audit_events (id uuid primary key, actor_id uuid references users(id), organization_id uuid references organizations(id) on delete set null, action text not null, entity_type text, entity_id text, metadata jsonb not null default '{}', created_at timestamptz not null default now());
create table if not exists stripe_events (id text primary key, type text not null, received_at timestamptz not null default now());
`]];

export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(72190411)");
    await client.query("create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())");
    for (const [id, sql] of migrations) {
      const done = await client.query("select 1 from schema_migrations where id=$1", [id]);
      if (!done.rowCount) { await client.query("begin"); try { await client.query(sql); await client.query("insert into schema_migrations(id) values($1)",[id]); await client.query("commit"); } catch(e) { await client.query("rollback"); throw e; } }
    }
    await seed(client);
  } finally { await client.query("select pg_advisory_unlock(72190411)").catch(()=>{}); client.release(); }
}

async function seed(client: pg.PoolClient) {
  const seeded = [["starter","Starter",1,10,0],["growth","Growth",5,50,14],["agency","Agency",25,250,0]] as const;
  for (const [slug,name,projects,posts,trial] of seeded) await client.query("insert into plans(id,slug,name,project_limit,post_limit,trial_days) values($1,$2,$3,$4,$5,$6) on conflict(slug) do nothing",[randomUUID(),slug,name,projects,posts,trial]);
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase(), password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const existing = await client.query("select id from users where email=$1",[email]);
    if (!existing.rowCount) await client.query("insert into users(id,email,name,password_hash,platform_role,email_verified_at,must_change_password) values($1,$2,$3,$4,'super_admin',now(),true)",[randomUUID(),email,process.env.ADMIN_NAME||"SignalDesk Admin",await hash(password)]);
  }
  await importLegacy(client);
}

async function importLegacy(client: pg.PoolClient) {
  const table = await client.query("select to_regclass('public.workspace') as name"); if (!table.rows[0]?.name) return;
  const marker = await client.query("select 1 from app_settings where key='legacy_imported'"); if (marker.rowCount) return;
  const admin = await client.query("select id,email from users where platform_role='super_admin' order by created_at limit 1"); if (!admin.rowCount) return;
  const old = await client.query("select * from workspace where id=1"); if (!old.rowCount || !old.rows[0].site_url) return;
  const plan = await client.query("select id from plans where slug='agency'"); const org=randomUUID(), project=randomUUID();
  await client.query("insert into organizations(id,name,slug,billing_email,plan_id,subscription_status,current_period_end) values($1,$2,$3,$4,$5,'active',now()+interval '10 years')",[org,old.rows[0].site_name||"SignalDesk",`legacy-${org.slice(0,8)}`,admin.rows[0].email,plan.rows[0].id]);
  await client.query("insert into memberships values($1,$2,'owner',now())",[org,admin.rows[0].id]);
  const url=new URL(old.rows[0].site_url); await client.query("insert into projects(id,organization_id,name,canonical_url,canonical_host,audience,offer,tone,timezone) values($1,$2,$3,$4,$5,$6,$7,$8,'UTC')",[project,org,old.rows[0].site_name,url.origin,url.hostname,old.rows[0].audience,old.rows[0].offer,old.rows[0].tone]);
  const topicsTable=await client.query("select to_regclass('public.topics') as name");if(topicsTable.rows[0]?.name){const calendar=randomUUID(),month=new Date().toISOString().slice(0,7);await client.query("insert into calendars(id,project_id,month) values($1,$2,$3::date)",[calendar,project,`${month}-01`]);const topics=await client.query("select * from topics order by created_at");for(let n=0;n<topics.rows.length;n++){const t=topics.rows[n],status=t.status==="published"?"published":t.status==="draft"||t.status==="brief"?"drafted":"scheduled";await client.query("insert into scheduled_items(id,calendar_id,project_id,title,keyword,intent,rationale,priority,scheduled_for,status,quota_period) values($1,$2,$3,$4,$5,$6,'Imported from the original SignalDesk workspace.',$7,now()+($8||' days')::interval,$9,$10)",[randomUUID(),calendar,project,t.title,t.keyword,t.intent,t.score,String(n+1),status,month])}}
  await client.query("insert into app_settings(key,value) values('legacy_imported','true')");
}
