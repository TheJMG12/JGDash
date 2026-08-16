-- Restrict cloud rows to the JGDash owner account (defense in depth on top of per-user RLS).
-- Owner email is assembled in SQL (local-part || '@' || domain) to match config.js.
-- Run in Supabase → SQL Editor. "Success. No rows returned" is expected for DDL.

-- user_kv: only the owner email may read/write their rows
drop policy if exists "user_kv_select_own" on public.user_kv;
drop policy if exists "user_kv_insert_own" on public.user_kv;
drop policy if exists "user_kv_update_own" on public.user_kv;
drop policy if exists "user_kv_delete_own" on public.user_kv;
drop policy if exists "user_kv_select_owner" on public.user_kv;
drop policy if exists "user_kv_insert_owner" on public.user_kv;
drop policy if exists "user_kv_update_owner" on public.user_kv;
drop policy if exists "user_kv_delete_owner" on public.user_kv;

create policy "user_kv_select_owner"
  on public.user_kv for select
  using (
    auth.uid() = user_id
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('ngosine83' || '@' || 'gmail.com')
  );

create policy "user_kv_insert_owner"
  on public.user_kv for insert
  with check (
    auth.uid() = user_id
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('ngosine83' || '@' || 'gmail.com')
  );

create policy "user_kv_update_owner"
  on public.user_kv for update
  using (
    auth.uid() = user_id
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('ngosine83' || '@' || 'gmail.com')
  )
  with check (
    auth.uid() = user_id
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('ngosine83' || '@' || 'gmail.com')
  );

create policy "user_kv_delete_owner"
  on public.user_kv for delete
  using (
    auth.uid() = user_id
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('ngosine83' || '@' || 'gmail.com')
  );
