-- App functions: create a farm, accept invites, load sample data.
-- Removing sample data is done from the app (owner-only, rows marked is_sample).

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
  return fid;
end $$;

-- Called after login: joins any farm whose owner invited this email address.
create or replace function public.accept_invites()
returns int language plpgsql security definer set search_path = '' as $$
declare
  em text := lower(auth.jwt() ->> 'email');
  n int := 0;
  inv record;
begin
  if auth.uid() is null or em is null then
    return 0;
  end if;
  for inv in
    select * from public.farm_invites
    where lower(email) = em and accepted_at is null and deleted_at is null
  loop
    insert into public.farm_members (farm_id, user_id, role, email, created_by)
    values (inv.farm_id, auth.uid(), inv.role, em, inv.created_by)
    on conflict (farm_id, user_id) do update set deleted_at = null, role = excluded.role;
    update public.farm_invites set accepted_at = now() where id = inv.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Sample data for demos. Every row is marked is_sample so it can be removed in one go.
create or replace function public.load_sample_data(p_farm uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s_id uuid;
  f record;
  camp_a uuid;
  camp_b uuid;
  g_ewes uuid;
  g_rams uuid;
  g_cows uuid;
  g_bulls uuid;
begin
  if not private.is_owner(p_farm) then
    raise exception 'Only the farm owner can load sample data';
  end if;
  if exists (select 1 from public.fields where farm_id = p_farm and is_sample and deleted_at is null) then
    raise exception 'Sample data is already loaded';
  end if;

  update public.farms set total_hectares = coalesce(total_hectares, 500),
         location_text = coalesce(location_text, 'Near Swellendam, Western Cape')
  where id = p_farm;

  insert into public.seasons (farm_id, year, label, notes, is_sample)
  values (p_farm, 2026, '2026 winter crops', 'SAMPLE season. Use this box for anything special about the year (rain, pests, prices).', true)
  on conflict (farm_id, year) do update set label = coalesce(public.seasons.label, excluded.label)
  returning id into s_id;

  -- Fields (350 ha cropland) with this season's planting.
  for f in
    select * from (values
      ('Field 1', 50, 'wheat', 100, date '2026-05-10', date '2026-11-20'),
      ('Field 2', 60, 'wheat', 100, date '2026-05-12', date '2026-11-22'),
      ('Field 3', 40, 'wheat', 100, date '2026-05-15', date '2026-11-25'),
      ('Field 4', 50, 'canola', 3.5, date '2026-04-25', date '2026-10-30'),
      ('Field 5', 50, 'canola', 3.5, date '2026-04-28', date '2026-11-02'),
      ('Field 6', 55, 'barley', 90, date '2026-05-20', date '2026-11-27'),
      ('Field 7', 45, 'barley', 90, date '2026-05-22', date '2026-11-29')
    ) as v(name, ha, crop, seed_rate, planted, harvest)
  loop
    with nf as (
      insert into public.fields (farm_id, name, hectares, notes, is_sample)
      values (p_farm, f.name, f.ha, 'SAMPLE field: replace the name and size, and draw the outline on the map.', true)
      returning id
    )
    insert into public.plantings (farm_id, field_id, season_id, crop, cultivar, seed_kg,
                                  planting_date, expected_harvest_date, notes)
    select p_farm, nf.id, s_id, f.crop, null, f.ha * f.seed_rate, f.planted, f.harvest,
           'SAMPLE planting'
    from nf;
  end loop;

  -- Camps (150 ha ridges / veld).
  insert into public.camps (farm_id, name, hectares, pasture_type, notes, is_sample)
  values (p_farm, 'Camp A', 80, 'Ridge veld', 'SAMPLE camp', true) returning id into camp_a;
  insert into public.camps (farm_id, name, hectares, pasture_type, notes, is_sample)
  values (p_farm, 'Camp B', 70, 'Ridge veld', 'SAMPLE camp', true) returning id into camp_b;

  -- Livestock: sheep as group counts, cattle also as individual tagged animals.
  insert into public.livestock_groups (farm_id, name, species, breed, class, quantity, camp_id, notes, is_sample)
  values (p_farm, 'Ewes', 'sheep', 'Dohne Merino', 'ewes', 600, camp_a, 'SAMPLE group', true)
  returning id into g_ewes;
  insert into public.livestock_groups (farm_id, name, species, breed, class, quantity, camp_id, notes, is_sample)
  values (p_farm, 'Rams', 'sheep', 'Dohne Merino', 'rams', 6, camp_b, 'SAMPLE group', true)
  returning id into g_rams;
  insert into public.livestock_groups (farm_id, name, species, breed, class, quantity, camp_id, notes, is_sample)
  values (p_farm, 'Cows', 'cattle', 'Angus', 'cows', 100, camp_b, 'SAMPLE group', true)
  returning id into g_cows;
  insert into public.livestock_groups (farm_id, name, species, breed, class, quantity, camp_id, notes, is_sample)
  values (p_farm, 'Bulls', 'cattle', 'Angus', 'bulls', 2, camp_b, 'SAMPLE group: one working bull and one young bull being raised', true)
  returning id into g_bulls;

  insert into public.animals (farm_id, group_id, species, tag, sex, status, notes, is_sample)
  select p_farm, g_cows, 'cattle', 'SAMPLE-' || lpad(n::text, 3, '0'), 'female', 'alive', 'SAMPLE cow', true
  from generate_series(1, 100) as n;
  insert into public.animals (farm_id, group_id, species, tag, sex, birth_date, status, notes, is_sample)
  values (p_farm, g_bulls, 'cattle', 'SAMPLE-B1', 'male', date '2021-09-15', 'alive', 'SAMPLE working bull', true),
         (p_farm, g_bulls, 'cattle', 'SAMPLE-B2', 'male', date '2025-09-01', 'alive', 'SAMPLE young bull being raised', true);

  -- Breeding and shearing plans (dates are examples; edit them to your own).
  insert into public.breeding_plans (farm_id, group_id, joining_start_date, joining_end_date, gestation_days,
                                     expected_birth_start, expected_birth_end, males_used, notes)
  values (p_farm, g_ewes, date '2026-11-15', date '2026-12-20', 147,
          date '2026-11-15' + 147, date '2026-12-20' + 147, 6, 'SAMPLE joining'),
         (p_farm, g_cows, date '2026-12-01', date '2027-02-28', 283,
          date '2026-12-01' + 283, date '2027-02-28' + 283, 1, 'SAMPLE joining');
  insert into public.shearing_plans (farm_id, group_id, planned_date, notes)
  values (p_farm, g_ewes, date '2027-02-15', 'SAMPLE shearing'),
         (p_farm, g_rams, date '2027-02-15', 'SAMPLE shearing');

  -- Planning estimates for the demo graphs.
  insert into public.planning_estimates (farm_id, kind, name, yield_t_per_ha, price_per_t,
                                         input_cost_per_ha, cost_per_head_per_year, notes, is_sample)
  values (p_farm, 'crop', 'wheat', 2.6, 5500, 8500, null, 'SAMPLE estimate', true),
         (p_farm, 'crop', 'canola', 1.7, 8200, 8200, null, 'SAMPLE estimate', true),
         (p_farm, 'crop', 'barley', 2.8, 4800, 7800, null, 'SAMPLE estimate (malting barley)', true),
         (p_farm, 'livestock', 'sheep', null, null, null, 450, 'SAMPLE estimate per ewe', true),
         (p_farm, 'livestock', 'cattle', null, null, null, 2200, 'SAMPLE estimate per cow', true);

  insert into public.tasks (farm_id, type, title, due_date, field_id, is_sample)
  select p_farm, 'harvest', 'Check canola for harvest readiness (SAMPLE)', date '2026-10-28', id, true
  from public.fields where farm_id = p_farm and name = 'Field 4' and is_sample;
  insert into public.tasks (farm_id, type, title, due_date, group_id, is_sample)
  values (p_farm, 'general', 'Check rams before joining (SAMPLE)', date '2026-11-01', g_rams, true);
end $$;

revoke execute on function public.create_farm(text, text) from public, anon;
revoke execute on function public.accept_invites() from public, anon;
revoke execute on function public.load_sample_data(uuid) from public, anon;
grant execute on function public.create_farm(text, text) to authenticated;
grant execute on function public.accept_invites() to authenticated;
grant execute on function public.load_sample_data(uuid) to authenticated;
