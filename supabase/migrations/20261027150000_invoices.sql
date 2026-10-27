-- Phase 4: sequential invoice numbers and private storage for invoice PDFs.

-- Hands out the next invoice number for a farm (e.g. INV-0001). The row lock makes it safe
-- when two phones create invoices at the same moment: each gets its own number.
create or replace function public.next_invoice_number(p_farm uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  prefix text;
  n int;
begin
  if not private.is_owner(p_farm) then
    raise exception 'Only the farm owner can create invoices';
  end if;
  update public.farm_settings
     set next_invoice_number = next_invoice_number + 1
   where farm_id = p_farm
  returning invoice_prefix, next_invoice_number - 1 into prefix, n;
  if n is null then
    raise exception 'Farm settings not found';
  end if;
  return coalesce(prefix, '') || lpad(n::text, 4, '0');
end $$;
revoke execute on function public.next_invoice_number(uuid) from public, anon;
grant execute on function public.next_invoice_number(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Invoices hold money details, so only owners can see or change them. Folder = farm id.
create policy "farm owners view invoices" on storage.objects for select to authenticated
  using (bucket_id = 'invoices' and (select private.is_owner(private.photo_farm(name))));
create policy "farm owners add invoices" on storage.objects for insert to authenticated
  with check (bucket_id = 'invoices' and (select private.is_owner(private.photo_farm(name))));
create policy "farm owners replace invoices" on storage.objects for update to authenticated
  using (bucket_id = 'invoices' and (select private.is_owner(private.photo_farm(name))))
  with check (bucket_id = 'invoices' and (select private.is_owner(private.photo_farm(name))));
create policy "farm owners remove invoices" on storage.objects for delete to authenticated
  using (bucket_id = 'invoices' and (select private.is_owner(private.photo_farm(name))));
