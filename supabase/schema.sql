-- Clarity tables + Row Level Security
-- Apply in the Supabase dashboard: SQL Editor -> paste -> Run.

-- ---------- LISTS ----------
create table if not exists public.clarity_lists (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null default '',
  color       text not null default '#6366f1',
  created_at  timestamptz not null default now()
);

create index if not exists clarity_lists_user_idx on public.clarity_lists (user_id);

alter table public.clarity_lists enable row level security;

drop policy if exists "clarity_lists_owner" on public.clarity_lists;
create policy "clarity_lists_owner" on public.clarity_lists
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- TASKS ----------
create table if not exists public.clarity_tasks (
  id           text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null default '',
  description  text not null default '',
  completed    boolean not null default false,
  priority     text not null default 'none',
  due_date     date,
  list_id      text,
  tags         jsonb not null default '[]'::jsonb,
  favorite     boolean not null default false,
  reminder     timestamptz,
  sort_order   bigint not null default 0,
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists clarity_tasks_user_idx on public.clarity_tasks (user_id);
create index if not exists clarity_tasks_updated_idx on public.clarity_tasks (user_id, updated_at);

alter table public.clarity_tasks enable row level security;

drop policy if exists "clarity_tasks_owner" on public.clarity_tasks;
create policy "clarity_tasks_owner" on public.clarity_tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- BRAIN DUMP NOTES ----------
create table if not exists public.clarity_notes (
  id         text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  content    text not null default '',
  tags       jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clarity_notes_user_idx on public.clarity_notes (user_id);
create index if not exists clarity_notes_updated_idx on public.clarity_notes (user_id, updated_at desc);

alter table public.clarity_notes enable row level security;

drop policy if exists "clarity_notes_owner" on public.clarity_notes;
create policy "clarity_notes_owner" on public.clarity_notes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- HABITS ----------
-- completed_dates holds local 'YYYY-MM-DD' strings and is the only tracking
-- state stored; streak, best streak, totals and completion rate are derived on
-- read so they cannot drift away from the log.
create table if not exists public.clarity_habits (
  id              text primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null default '',
  description     text not null default '',
  repetition_type text not null default 'daily'
                    check (repetition_type in ('daily', 'weekly', 'monthly')),
  days_of_week    jsonb not null default '[]'::jsonb,
  dates_of_month  jsonb not null default '[]'::jsonb,
  color           text not null default '#3ddbf0',
  icon            text not null default '',
  target_streak   integer,
  completed_dates jsonb not null default '[]'::jsonb,
  last_completed  timestamptz,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists clarity_habits_user_idx on public.clarity_habits (user_id);

alter table public.clarity_habits enable row level security;

drop policy if exists "clarity_habits_owner" on public.clarity_habits;
create policy "clarity_habits_owner" on public.clarity_habits
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- REALTIME ----------
-- Cross-device sync listens on postgres_changes; without these the client
-- subscribes successfully but never receives an event.
alter publication supabase_realtime add table public.clarity_lists;
alter publication supabase_realtime add table public.clarity_tasks;
alter publication supabase_realtime add table public.clarity_notes;
alter publication supabase_realtime add table public.clarity_habits;

-- REPLICA IDENTITY FULL so DELETE events still carry user_id and the client's
-- `user_id=eq.<uid>` filter matches them.
alter table public.clarity_lists replica identity full;
alter table public.clarity_tasks replica identity full;
alter table public.clarity_notes replica identity full;
alter table public.clarity_habits replica identity full;
