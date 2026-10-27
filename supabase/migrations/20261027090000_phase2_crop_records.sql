-- Phase 2: seed cost on plantings, and richer sample data (fertiliser, sprays, last season's harvest).

alter table public.plantings add column if not exists seed_cost numeric(12,2);

create or replace function public.load_sample_data(p_farm uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s_id uuid;
  s_prev uuid;
  fid uuid;
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
  insert into public.seasons (farm_id, year, label, notes, is_sample)
  values (p_farm, 2025, '2025 winter crops', 'SAMPLE season: dry start, good rain in August.', true)
  on conflict (farm_id, year) do update set label = coalesce(public.seasons.label, excluded.label)
  returning id into s_prev;

  -- Fields (350 ha cropland): this season's crop with fertiliser and sprays,
  -- and last season's (rotated) crop with its harvest, so there is history to look at.
  for f in
    select * from (values
      ('Field 1', 50, 'wheat',  100, date '2026-05-10', date '2026-11-20', 'canola', 1.05),
      ('Field 2', 60, 'wheat',  100, date '2026-05-12', date '2026-11-22', 'canola', 0.95),
      ('Field 3', 40, 'wheat',  100, date '2026-05-15', date '2026-11-25', 'canola', 1.00),
      ('Field 4', 50, 'canola', 3.5, date '2026-04-25', date '2026-10-30', 'wheat',  1.10),
      ('Field 5', 50, 'canola', 3.5, date '2026-04-28', date '2026-11-02', 'wheat',  0.90),
      ('Field 6', 55, 'barley', 90,  date '2026-05-20', date '2026-11-27', 'wheat',  1.00),
      ('Field 7', 45, 'barley', 90,  date '2026-05-22', date '2026-11-29', 'wheat',  0.97)
    ) as v(name, ha, crop, seed_rate, planted, harvest, prev_crop, factor)
  loop
    insert into public.fields (farm_id, name, hectares, notes, is_sample)
    values (p_farm, f.name, f.ha, 'SAMPLE field: replace the name and size, and draw the outline on the map.', true)
    returning id into fid;

    -- This season
    insert into public.plantings (farm_id, field_id, season_id, crop, seed_kg, seed_cost,
                                  planting_date, expected_harvest_date, notes)
    values (p_farm, fid, s_id, f.crop, f.ha * f.seed_rate,
            round(f.ha * f.seed_rate * case f.crop when 'canola' then 180 else 9 end, 2),
            f.planted, f.harvest, 'SAMPLE planting');

    insert into public.field_operations (farm_id, field_id, season_id, type, date, product, rate, rate_unit,
                                         total_amount, unit, cost, withholding_period_days, notes)
    select p_farm, fid, s_id, o.type, o.d, o.product, o.rate, o.rate_unit, o.rate * f.ha, o.unit,
           round(o.rate * f.ha * o.price, 2), o.whp, 'SAMPLE record'
    from (values
      ('fertiliser', f.planted, 'MAP (sample)',
         case f.crop when 'wheat' then 150 when 'canola' then 120 else 130 end::numeric, 'kg/ha', 'kg', 13.5::numeric, null::int),
      ('fertiliser', f.planted + 60, 'LAN 28 (sample)',
         case f.crop when 'wheat' then 120 else 100 end::numeric, 'kg/ha', 'kg', 9.0::numeric, null::int),
      ('spray', f.planted + 35, 'Herbicide (sample)',
         case f.crop when 'canola' then 1.5 else 2 end::numeric, 'L/ha', 'L', 250::numeric, 56),
      -- Field 4's insecticide is deliberately late, to show the withholding warning.
      ('spray',
         case when f.crop <> 'canola' then f.planted + 115 when f.name = 'Field 4' then date '2026-10-01' else date '2026-09-20' end,
         case when f.crop = 'canola' then 'Insecticide (sample)' else 'Fungicide (sample)' end,
         case when f.crop = 'canola' then 0.3 else 1 end::numeric, 'L/ha', 'L',
         case when f.crop = 'canola' then 600 else 450 end::numeric,
         case when f.crop = 'canola' then 35 else 42 end)
    ) as o(type, d, product, rate, rate_unit, unit, price, whp);

    -- Last season
    insert into public.plantings (farm_id, field_id, season_id, crop, seed_kg, seed_cost,
                                  planting_date, expected_harvest_date, notes)
    values (p_farm, fid, s_prev, f.prev_crop,
            f.ha * case f.prev_crop when 'canola' then 3.5 else 100 end,
            round(f.ha * case f.prev_crop when 'canola' then 3.5 * 170 else 100 * 8.5 end, 2),
            f.planted - 365, f.harvest - 365, 'SAMPLE planting');
    insert into public.field_operations (farm_id, field_id, season_id, type, date, product, rate, rate_unit,
                                         total_amount, unit, cost, notes)
    values (p_farm, fid, s_prev, 'fertiliser', f.planted - 365, 'MAP (sample)', 130, 'kg/ha', 130 * f.ha, 'kg',
            round(130 * f.ha * 12.8, 2), 'SAMPLE record');
    insert into public.harvests (farm_id, field_id, season_id, date, tons, hectares_harvested, notes)
    values (p_farm, fid, s_prev, f.harvest - 362,
            round(f.ha * case f.prev_crop when 'canola' then 1.7 when 'barley' then 2.8 else 2.6 end * f.factor, 1),
            f.ha, 'SAMPLE harvest');
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

  insert into public.breeding_plans (farm_id, group_id, joining_start_date, joining_end_date, gestation_days,
                                     expected_birth_start, expected_birth_end, males_used, notes)
  values (p_farm, g_ewes, date '2026-11-15', date '2026-12-20', 147,
          date '2026-11-15' + 147, date '2026-12-20' + 147, 6, 'SAMPLE joining'),
         (p_farm, g_cows, date '2026-12-01', date '2027-02-28', 283,
          date '2026-12-01' + 283, date '2027-02-28' + 283, 1, 'SAMPLE joining');
  insert into public.shearing_plans (farm_id, group_id, planned_date, notes)
  values (p_farm, g_ewes, date '2027-02-15', 'SAMPLE shearing'),
         (p_farm, g_rams, date '2027-02-15', 'SAMPLE shearing');

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

revoke execute on function public.load_sample_data(uuid) from public, anon;
grant execute on function public.load_sample_data(uuid) to authenticated;
