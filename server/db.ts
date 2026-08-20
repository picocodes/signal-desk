import pg from "pg";

const { Pool } = pg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: 10
});

export async function migrate() {
  await pool.query(`
    create table if not exists workspace (
      id integer primary key default 1 check (id = 1),
      site_name text not null default '', site_url text not null default '',
      audience text not null default '', offer text not null default '', tone text not null default '',
      updated_at timestamptz not null default now()
    );
    insert into workspace (id) values (1) on conflict (id) do nothing;
    create table if not exists topics (
      id uuid primary key, title text not null, keyword text not null, intent text not null,
      status text not null check (status in ('opportunity','brief','draft','scheduled','published')),
      score integer not null check (score between 0 and 100), evidence integer not null default 0,
      due text not null, created_at timestamptz not null default now()
    );
  `);
}
