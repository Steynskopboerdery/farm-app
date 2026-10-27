-- Phase 5: who was paid, and a photo of the receipt, on each cost.
alter table public.costs add column if not exists supplier text;
alter table public.costs add column if not exists receipt_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Receipts are money records: owners only. Folder = farm id.
create policy "farm owners view receipts" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (select private.is_owner(private.photo_farm(name))));
create policy "farm owners add receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (select private.is_owner(private.photo_farm(name))));
create policy "farm owners replace receipts" on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and (select private.is_owner(private.photo_farm(name))))
  with check (bucket_id = 'receipts' and (select private.is_owner(private.photo_farm(name))));
create policy "farm owners remove receipts" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (select private.is_owner(private.photo_farm(name))));
