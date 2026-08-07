-- JGDash Training Video Library: private Storage bucket for .mp4 blobs.
-- Run in Supabase → SQL Editor after 001_user_kv.sql.
-- Blobs are stored at: {user_id}/{video_id}.mp4
-- Metadata still syncs via user_kv (jg_training_data_v1); this bucket carries the bytes.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'training-videos',
  'training-videos',
  false,
  104857600, -- 100 MB
  array['video/mp4', 'application/octet-stream']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "training_videos_select_own" on storage.objects;
drop policy if exists "training_videos_insert_own" on storage.objects;
drop policy if exists "training_videos_update_own" on storage.objects;
drop policy if exists "training_videos_delete_own" on storage.objects;

create policy "training_videos_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'training-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "training_videos_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'training-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "training_videos_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'training-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'training-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "training_videos_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'training-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
