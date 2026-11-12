// Database objects for Cardiac Lab. Kept in their own `ecglab` schema so they never
// touch other tables in the same Supabase project. Safe to run repeatedly.
// supabase/schema.sql holds the same statements for Supabase's SQL Editor.
export const SCHEMA_SQL = `
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
`;
