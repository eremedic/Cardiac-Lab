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

-- End-of-course survey (added in v1.1): answers, when they were submitted, and whether
-- the student asked for their name to be hidden next to their answers.
alter table ecglab.scores add column if not exists survey jsonb;
alter table ecglab.scores add column if not exists survey_at timestamptz;
alter table ecglab.scores add column if not exists survey_anonymous boolean not null default false;

-- Instructor settings (added in v1.3), e.g. whether the 12-lead practice area is open.
create table if not exists ecglab.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table ecglab.settings enable row level security;

-- Instructor accounts (added in v1.6). Each has a generated password (stored only as a SHA-256 hash; the
-- passwords are long and random, so a fast hash is enough), the cohorts they may see, and their permissions.
create table if not exists ecglab.instructors (
  id         uuid primary key,
  name       text not null,
  pw_hash    text not null unique,
  cohorts    jsonb not null default '[]'::jsonb,
  perms      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_seen  timestamptz
);
alter table ecglab.instructors enable row level security;

create index if not exists scores_updated_at_idx on ecglab.scores (updated_at desc);
create index if not exists scores_cohort_idx on ecglab.scores (cohort);

-- Row-level security with no policies: Supabase's public anon/authenticated API keys
-- cannot read or write these rows. Only the server, connecting with DATABASE_URL, can.
alter table ecglab.scores enable row level security;
