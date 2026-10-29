-- Phase 7: rain gauge, map pins, head counts, vehicles and diesel, spray conditions, VAT on costs.

-- Rain gauge readings. Anyone on the farm may record rain (workers often read the gauge);
-- the person who recorded it, or an owner, may change it.
create table public.rain_readings (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  date date not null,
  mm numeric(6,1) not null check (mm >= 0),
  gauge text,                         -- e.g. "House", "Bo-kamp", when there are several gauges
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz
);
create index on public.rain_readings (farm_id, date);

-- Pins on the map: broken fence, water point, erosion, weeds... with an optional photo.
create table public.map_pins (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  kind text not null default 'other' check (kind in ('fence', 'water', 'erosion', 'weeds', 'animal', 'other')),
  title text not null,
  lat double precision not null,
  lng double precision not null,
  notes text,
  photo_path text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  unique (farm_id, id)
);
create index on public.map_pins (farm_id);

alter table public.tasks add column if not exists pin_id uuid;
alter table public.tasks add foreign key (farm_id, pin_id) references public.map_pins(farm_id, id) on delete set null (pin_id);
create index on public.tasks (farm_id, pin_id);

-- Head counts: animals counted in a camp against the number the app expected.
create table public.head_counts (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  group_id uuid not null,
  date date not null,
  counted int not null check (counted >= 0),
  expected int not null check (expected >= 0),
  camp_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  foreign key (farm_id, group_id) references public.livestock_groups(farm_id, id) on delete cascade,
  foreign key (farm_id, camp_id) references public.camps(farm_id, id) on delete set null (camp_id)
);
create index on public.head_counts (farm_id, group_id, date);
create index on public.head_counts (farm_id, camp_id);

-- Tractors, bakkies, harvesters... and their fuel and service log.
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  kind text not null default 'tractor' check (kind in ('tractor', 'bakkie', 'truck', 'harvester', 'motorbike', 'other')),
  registration text,
  meter text not null default 'hours' check (meter in ('hours', 'km')),
  service_interval numeric(10,1),      -- hours or km between services
  fuel_item_id uuid,                   -- the store item (diesel tank) fuel is taken from, if any
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  unique (farm_id, id),
  foreign key (farm_id, fuel_item_id) references public.inventory_items(farm_id, id) on delete set null (fuel_item_id)
);

create table public.vehicle_logs (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  vehicle_id uuid not null,
  kind text not null default 'fuel' check (kind in ('fuel', 'service', 'repair')),
  date date not null,
  litres numeric(10,1) check (litres is null or litres >= 0),
  reading numeric(12,1),               -- hour meter or odometer
  from_store boolean not null default true,
  inventory_movement_id uuid,          -- the "used" store movement this fuel made (set by the database)
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  foreign key (farm_id, vehicle_id) references public.vehicles(farm_id, id) on delete cascade
);
create index on public.vehicle_logs (farm_id, vehicle_id, date);
create index on public.vehicle_logs (inventory_movement_id);
create index on public.vehicles (farm_id, fuel_item_id);

-- Weather at spraying time, kept on the spray record as proof of conditions.
alter table public.field_operations
  add column if not exists spray_time time,
  add column if not exists wind_kmh numeric(5,1),
  add column if not exists gust_kmh numeric(5,1),
  add column if not exists wind_dir int check (wind_dir is null or wind_dir between 0 and 360),
  add column if not exists temp_c numeric(4,1),
  add column if not exists humidity int check (humidity is null or humidity between 0 and 100),
  add column if not exists weather_source text check (weather_source is null or weather_source in ('forecast', 'manual'));

-- VAT on costs (from the receipt), for the VAT summary export.
alter table public.costs add column if not exists vat_amount numeric(12,2);

-- Security, change stamps, history ------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['rain_readings', 'map_pins', 'head_counts', 'vehicles', 'vehicle_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function private.set_updated_at()', t);
    execute format('create trigger audit after insert or update or delete on public.%I
                    for each row execute function private.audit_row()', t);
    execute format('create policy "members read" on public.%I for select to authenticated
                    using ((select private.is_member(farm_id)))', t);
    execute format('create policy "owners delete" on public.%I for delete to authenticated
                    using ((select private.is_owner(farm_id)))', t);
  end loop;

  -- Anyone on the farm adds these; the person who added it or an owner changes it.
  foreach t in array array['rain_readings', 'map_pins', 'vehicle_logs'] loop
    execute format('create policy "members insert" on public.%I for insert to authenticated
                    with check ((select private.is_member(farm_id)) and created_by = (select auth.uid()))', t);
    execute format('create policy "own or owner update" on public.%I for update to authenticated
                    using ((select private.is_owner(farm_id)) or (created_by = (select auth.uid()) and (select private.is_member(farm_id))))
                    with check ((select private.is_member(farm_id)))', t);
  end loop;
end $$;

-- Head counts: owners and workers allowed to do animal records.
create policy "permitted insert" on public.head_counts for insert to authenticated
  with check ((select private.can(farm_id, 'animal_records')));
create policy "permitted update" on public.head_counts for update to authenticated
  using ((select private.can(farm_id, 'animal_records'))) with check ((select private.can(farm_id, 'animal_records')));

-- Vehicles: owners manage the list.
create policy "owners insert" on public.vehicles for insert to authenticated
  with check ((select private.is_owner(farm_id)));
create policy "owners update" on public.vehicles for update to authenticated
  using ((select private.is_owner(farm_id))) with check ((select private.is_owner(farm_id)));

-- Only owners may mark a pin as dealt with or change someone else's pin; the creator can fix their own.
-- (Covered by the "own or owner update" policy above.)

-- Fuel taken from the store's diesel: the database keeps one "used" store movement per fuel entry,
-- so workers can log fuel without needing permission to change the store.
create or replace function private.sync_fuel_movement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  item uuid;
  vname text;
  mid uuid;
begin
  select v.fuel_item_id, v.name into item, vname from public.vehicles v
  where v.farm_id = new.farm_id and v.id = new.vehicle_id;

  -- Remove the old movement (if any); a fresh one is made below when still needed.
  if tg_op = 'UPDATE' and old.inventory_movement_id is not null then
    update public.inventory_movements set deleted_at = now()
    where id = old.inventory_movement_id and deleted_at is null;
    new.inventory_movement_id := null;
  end if;

  if new.deleted_at is null and new.kind = 'fuel' and new.from_store and item is not null and coalesce(new.litres, 0) > 0 then
    insert into public.inventory_movements (farm_id, item_id, date, quantity, notes, created_by)
    values (new.farm_id, item, new.date, -new.litres, vname, new.created_by)
    returning id into mid;
    new.inventory_movement_id := mid;
  end if;
  return new;
end $$;

create trigger sync_fuel_movement before insert or update of litres, date, kind, from_store, deleted_at, vehicle_id
  on public.vehicle_logs for each row execute function private.sync_fuel_movement();

-- Photos on map pins: anyone on the farm can add and view them; owners can remove them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pin-photos', 'pin-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "farm members view pin photos" on storage.objects for select to authenticated
  using (bucket_id = 'pin-photos' and (select private.is_member(private.photo_farm(name))));
create policy "farm members add pin photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'pin-photos' and (select private.is_member(private.photo_farm(name))));
create policy "farm owners remove pin photos" on storage.objects for delete to authenticated
  using (bucket_id = 'pin-photos' and (select private.is_owner(private.photo_farm(name))));
