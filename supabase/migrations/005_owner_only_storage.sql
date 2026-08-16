-- Owner-only Storage policies for training-videos + media-images.
-- Owner email assembled as local-part || '@' || domain (same as 004 / config.js).
-- Run after 002/003.

-- training-videos
drop policy if exists "training_videos_select_own" on storage.objects;
drop policy if exists "training_videos_insert_own" on storage.objects;
drop policy if exists "training_videos_update_own" on storage.objects;
drop policy if exists "training_videos_delete_own" on storage.objects;
drop policy if exists "training_videos_select_owner" on storage.objects;
drop policy if exists "training_videos_insert_owner" on storage.objects;
drop policy if exists "training_videos_update_owner" on storage.objects;
drop policy if exists "training_videos_delete_owner" on storage.objects;

create policy "training_videos_select_owner"
  on storage.objects for select
  using (
    bucket_id = 'training-videos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('ngosine83' || '@' || 'gmail.com')
  );

create policy "training_videos_insert_owner"
  on storage.objects for insert
  with check (
    bucket_id = 'training-videos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('ngosine83' || '@' || 'gmail.com')
  );

create policy "training_videos_update_owner"
  on storage.objects for update
  using (
    bucket_id = 'training-videos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('ngosine83' || '@' || 'gmail.com')
  )
  with check (
    bucket_id = 'training-videos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('ngosine83' || '@' || 'gmail.com')
  );

create policy "training_videos_delete_owner"
  on storage.objects for delete
  using (
    bucket_id = 'training-videos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('ngosine83' || '@' || 'gmail.com')
  );

-- media-images
drop policy if exists "media_images_select_own" on storage.objects;
drop policy if exists "media_images_insert_own" on storage.objects;
drop policy if exists "media_images_update_own" on storage.objects;
drop policy if exists "media_images_delete_own" on storage.objects;
drop policy if exists "media_images_select_owner" on storage.objects;
drop policy if exists "media_images_insert_owner" on storage.objects;
drop policy if exists "media_images_update_owner" on storage.objects;
drop policy if exists "media_images_delete_owner" on storage.objects;

create policy "media_images_select_owner"
  on storage.objects for select
  using (
    bucket_id = 'media-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('ngosine83' || '@' || 'gmail.com')
  );

create policy "media_images_insert_owner"
  on storage.objects for insert
  with check (
    bucket_id = 'media-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('ngosine83' || '@' || 'gmail.com')
  );

create policy "media_images_update_owner"
  on storage.objects for update
  using (
    bucket_id = 'media-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('ngosine83' || '@' || 'gmail.com')
  )
  with check (
    bucket_id = 'media-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('ngosine83' || '@' || 'gmail.com')
  );

create policy "media_images_delete_owner"
  on storage.objects for delete
  using (
    bucket_id = 'media-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('ngosine83' || '@' || 'gmail.com')
  );
