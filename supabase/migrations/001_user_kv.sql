-- JGDash cloud sync: per-user key/value store for localStorage mirrors.
-- Run in Supabase → SQL Editor → New query → Run.

create table if not exists public.user_kv (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create index if not exists user_kv_user_updated_idx
  on public.user_kv (user_id, updated_at desc);

alter table public.user_kv enable row level security;

drop policy if exists "user_kv_select_own" on public.user_kv;
drop policy if exists "user_kv_insert_own" on public.user_kv;
drop policy if exists "user_kv_update_own" on public.user_kv;
drop policy if exists "user_kv_delete_own" on public.user_kv;

create policy "user_kv_select_own"
  on public.user_kv for select
  using (auth.uid() = user_id);

create policy "user_kv_insert_own"
  on public.user_kv for insert
  with check (auth.uid() = user_id);

create policy "user_kv_update_own"
  on public.user_kv for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_kv_delete_own"
  on public.user_kv for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_kv to authenticated;
