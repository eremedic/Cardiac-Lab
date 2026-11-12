-- Cardiac Lab database objects (generated from lib/schema.mjs by `npm run db:schema`).
-- Optional: the API creates these automatically on first use. To create them yourself,
-- paste this file into Supabase → SQL Editor and run it. Safe to run more than once.
create schema if not exists ecglab;

create table if not exists ecglab.scores (
  id              uuid primary key,
  name            text not null,
  cohort          text not null default '',
  strips_correct  integer not null default 0,
  strips_answered integer not null default 0,
  strips_total    integer not null default 0,
  mega_correct    integer not null default 0,
  mega_answered   integer not null default 0,
  mega_total      integer not null default 0,
  overall         integer not null default 0,
  details         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists scores_updated_at_idx on ecglab.scores (updated_at desc);
create index if not exists scores_cohort_idx on ecglab.scores (cohort);

-- Row-level security with no policies: Supabase's public anon/authenticated API keys
-- cannot read or write these rows. Only the server, connecting with DATABASE_URL, can.
alter table ecglab.scores enable row level security;
