-- Home-screen photo: stored privately in Storage under <farm_id>/..., path saved on the farm.

alter table public.farms add column if not exists hero_photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('farm-photos', 'farm-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- The first folder of every file is the farm id. Members can view; owners can add, replace, remove.
create or replace function private.photo_farm(object_name text)
returns uuid language sql immutable set search_path = '' as $$
  select case when (storage.foldername(object_name))[1] ~ '^[0-9a-f-]{36}$'
              then (storage.foldername(object_name))[1]::uuid end
$$;
grant execute on function private.photo_farm(text) to authenticated;

create policy "farm members view photos" on storage.objects for select to authenticated
  using (bucket_id = 'farm-photos' and (select private.is_member(private.photo_farm(name))));
create policy "farm owners add photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'farm-photos' and (select private.is_owner(private.photo_farm(name))));
create policy "farm owners replace photos" on storage.objects for update to authenticated
  using (bucket_id = 'farm-photos' and (select private.is_owner(private.photo_farm(name))))
  with check (bucket_id = 'farm-photos' and (select private.is_owner(private.photo_farm(name))));
create policy "farm owners remove photos" on storage.objects for delete to authenticated
  using (bucket_id = 'farm-photos' and (select private.is_owner(private.photo_farm(name))));
