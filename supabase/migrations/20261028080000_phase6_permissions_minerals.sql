-- Phase 6: per-worker permissions, and default mineral advice rules.

-- Permissions an owner can switch on per worker, e.g. {"field_records": true, "tasks": true}.
--   field_records  : plantings, fertiliser, sprays, harvests (and the store movements they make)
--   animal_records : animal events, tagged animals, joining and shearing, group counts and camp
--   tasks          : create and change tasks
--   pasture        : pasture tests
-- Workers never get access to money tables (sales, invoices, costs, customers, settings).
alter table public.farm_members add column if not exists permissions jsonb not null default '{}'::jsonb;

create or replace function private.can(fid uuid, perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.farm_members m
    where m.farm_id = fid and m.user_id = (select auth.uid()) and m.deleted_at is null
      and (m.role = 'owner' or coalesce((m.permissions ->> perm)::boolean, false))
  )
$$;
grant execute on function private.can(uuid, text) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['plantings', 'field_operations', 'harvests', 'inventory_movements', 'seasons'] loop
    execute format('create policy "permitted workers insert" on public.%I for insert to authenticated
                    with check ((select private.can(farm_id, ''field_records'')))', t);
  end loop;
  foreach t in array array['plantings', 'field_operations', 'harvests', 'inventory_movements'] loop
    execute format('create policy "permitted workers update" on public.%I for update to authenticated
                    using ((select private.can(farm_id, ''field_records''))) with check ((select private.can(farm_id, ''field_records'')))', t);
  end loop;
  foreach t in array array['animal_events', 'animals', 'breeding_plans', 'shearing_plans'] loop
    execute format('create policy "permitted workers insert" on public.%I for insert to authenticated
                    with check ((select private.can(farm_id, ''animal_records'')))', t);
    execute format('create policy "permitted workers update" on public.%I for update to authenticated
                    using ((select private.can(farm_id, ''animal_records''))) with check ((select private.can(farm_id, ''animal_records'')))', t);
  end loop;
end $$;

create policy "permitted workers update" on public.livestock_groups for update to authenticated
  using ((select private.can(farm_id, 'animal_records'))) with check ((select private.can(farm_id, 'animal_records')));
create policy "permitted workers insert" on public.tasks for insert to authenticated
  with check ((select private.can(farm_id, 'tasks')));
create policy "permitted workers insert" on public.pasture_tests for insert to authenticated
  with check ((select private.can(farm_id, 'pasture')));
create policy "permitted workers update" on public.pasture_tests for update to authenticated
  using ((select private.can(farm_id, 'pasture'))) with check ((select private.can(farm_id, 'pasture')));

-- Workers with animal permission may change a group's count and camp, nothing else about the group.
create or replace function private.limit_worker_group_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_owner(new.farm_id) then
    if (to_jsonb(new) - array['quantity', 'camp_id', 'updated_at'])
       is distinct from (to_jsonb(old) - array['quantity', 'camp_id', 'updated_at']) then
      raise exception 'Workers can only change the count and camp of a group';
    end if;
  end if;
  return new;
end $$;
create trigger limit_worker_group_update before update on public.livestock_groups
  for each row execute function private.limit_worker_group_update();

-- Workers with the tasks permission may edit tasks fully; others still only tick them off.
create or replace function private.limit_worker_task_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.can(new.farm_id, 'tasks') then
    if (to_jsonb(new) - array['status', 'done_at', 'notes', 'updated_at'])
       is distinct from (to_jsonb(old) - array['status', 'done_at', 'notes', 'updated_at']) then
      raise exception 'Workers can only change the status and notes of a task';
    end if;
  end if;
  return new;
end $$;

-- Default supplement suggestions (advice only; farmers can edit or switch them off).
create or replace function private.seed_mineral_rules(fid uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.mineral_advice_rules (farm_id, species, nutrient, comparison, threshold, suggestion)
  select fid, r.species, r.nutrient, 'below', r.threshold, r.suggestion
  from (values
    ('any', 'phosphorus_pct', 0.18, 'Phosphorus looks low for grazing animals (below about 0.18%). A phosphate lick is often used on such veld. Ask your vet or animal nutritionist which lick and how much.'),
    ('any', 'protein_pct', 7, 'Crude protein is low (below about 7%). Animals may lose condition; a protein or urea-based winter lick is often used. Take special care with urea and follow the label.'),
    ('sheep', 'protein_pct', 10, 'Protein may be too low for ewes in late pregnancy or with lambs (they need about 10–14%). Consider a production lick or better grazing for these ewes.'),
    ('cattle', 'magnesium_pct', 0.2, 'Magnesium is low: risk of grass tetany (staggers) in cows, especially on lush green pasture in winter and spring. Ask your vet about magnesium, for example in the lick.'),
    ('any', 'calcium_pct', 0.3, 'Calcium is low. A lick with calcium (feed lime) may be needed. Check with your vet or animal nutritionist.')
  ) as r(species, nutrient, threshold, suggestion)
  where not exists (select 1 from public.mineral_advice_rules x where x.farm_id = fid and x.deleted_at is null)
$$;

select private.seed_mineral_rules(id) from public.farms where deleted_at is null;

create or replace function public.create_farm(p_name text, p_location text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  fid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not logged in';
  end if;
  insert into public.farms (name, location_text, created_by)
  values (p_name, p_location, auth.uid()) returning id into fid;
  insert into public.farm_members (farm_id, user_id, role, email)
  values (fid, auth.uid(), 'owner', auth.jwt() ->> 'email');
  insert into public.farm_settings (farm_id, legal_name) values (fid, p_name);
  insert into public.species_reference (farm_id, species, gestation_days)
  values (fid, 'sheep', 147), (fid, 'cattle', 283);
  perform private.seed_mineral_rules(fid);
  return fid;
end $$;
revoke execute on function public.create_farm(text, text) from public, anon;
grant execute on function public.create_farm(text, text) to authenticated;
