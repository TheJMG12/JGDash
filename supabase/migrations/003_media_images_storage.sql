-- JGDash MyMind / Media: private Storage bucket for uploaded image blobs.
-- Run in Supabase → SQL Editor after 001_user_kv.sql (and optionally 002).
-- Blobs are stored at: {user_id}/{image_id}.{jpg|png|webp|gif}
-- Metadata still syncs via user_kv (jg_media_data_v1); this bucket carries the bytes
-- so phone uploads are visible on laptop (and vice versa).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media-images',
  'media-images',
  false,
  20971520, -- 20 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/octet-stream']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media_images_select_own" on storage.objects;
drop policy if exists "media_images_insert_own" on storage.objects;
drop policy if exists "media_images_update_own" on storage.objects;
drop policy if exists "media_images_delete_own" on storage.objects;

create policy "media_images_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'media-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "media_images_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "media_images_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'media-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'media-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "media_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'media-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
