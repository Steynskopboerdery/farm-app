-- All farm data tables. Every table has farm_id, created/updated stamps and a
-- deleted_at column: the app hides records instead of deleting them, so history is kept.
-- Composite foreign keys (farm_id, x_id) stop a record pointing at another farm's data.

-- Land ---------------------------------------------------------------------

create table public.fields (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  hectares numeric(10,2),
  boundary_geojson jsonb,             -- GeoJSON Polygon / MultiPolygon geometry
  boundary_source text not null default 'manual' check (boundary_source in ('manual', 'auto', 'import')),
  soil_type text,
  notes text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  unique (farm_id, id)
);

create table public.camps (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  hectares numeric(10,2),
  boundary_geojson jsonb,
  boundary_source text not null default 'manual' check (boundary_source in ('manual', 'auto', 'import')),
  pasture_type text,
  notes text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  unique (farm_id, id)
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  year int not null,
  label text,
  notes text,                         -- comments on anything special that year
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  unique (farm_id, id),
  unique (farm_id, year)
);

-- Crops ----------------------------------------------------------------------

create table public.plantings (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  field_id uuid not null,
  season_id uuid not null,
  crop text not null,
  cultivar text,
  seed_kg numeric(12,2),
  planting_date date,
  expected_harvest_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  foreign key (farm_id, field_id) references public.fields(farm_id, id) on delete cascade,
  foreign key (farm_id, season_id) references public.seasons(farm_id, id) on delete cascade
);

create table public.field_operations (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  field_id uuid not null,
  season_id uuid,
  type text not null check (type in ('fertiliser', 'spray', 'other')),
  date date not null,
  product text,
  inventory_item_id uuid,
  rate numeric(12,3),
  rate_unit text,                     -- e.g. kg/ha, L/ha
  total_amount numeric(12,3),
  unit text,                          -- kg, L, t
  cost numeric(12,2),
  withholding_period_days int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  unique (farm_id, id),
  foreign key (farm_id, field_id) references public.fields(farm_id, id) on delete cascade,
  foreign key (farm_id, season_id) references public.seasons(farm_id, id) on delete set null (season_id)
);

create table public.harvests (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  field_id uuid not null,
  season_id uuid,
  date date not null,
  tons numeric(12,3) not null,
  hectares_harvested numeric(10,2),   -- defaults to the field size when recorded
  yield_per_ha numeric(12,3) generated always as
    (case when hectares_harvested > 0 then tons / hectares_harvested end) stored,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  foreign key (farm_id, field_id) references public.fields(farm_id, id) on delete cascade,
  foreign key (farm_id, season_id) references public.seasons(farm_id, id) on delete set null (season_id)
);

-- Planning figures used for demo / budget graphs.
create table public.planning_estimates (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  kind text not null check (kind in ('crop', 'livestock')),
  name text not null,                 -- e.g. wheat, sheep
  yield_t_per_ha numeric(10,3),
  price_per_t numeric(12,2),
  input_cost_per_ha numeric(12,2),
  cost_per_head_per_year numeric(12,2),
  notes text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz
);

-- Livestock ------------------------------------------------------------------

create table public.species_reference (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  species text not null,
  gestation_days int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  unique (farm_id, species)
);

create table public.livestock_groups (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  species text not null check (species in ('sheep', 'cattle')),
  breed text,
  class text not null,                -- ewes, rams, lambs, cows, bulls, calves, heifers, ...
  quantity int not null default 0 check (quantity >= 0),
  camp_id uuid,
  notes text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  unique (farm_id, id),
  foreign key (farm_id, camp_id) references public.camps(farm_id, id) on delete set null (camp_id)
);

create table public.animals (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  group_id uuid,
  species text not null check (species in ('sheep', 'cattle')),
  tag text not null,
  sex text check (sex in ('female', 'male')),
  birth_date date,
  status text not null default 'alive' check (status in ('alive', 'sold', 'dead')),
  notes text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  unique (farm_id, id),
  foreign key (farm_id, group_id) references public.livestock_groups(farm_id, id) on delete cascade
);
create unique index animals_tag_unique on public.animals (farm_id, species, tag) where deleted_at is null;

create table public.animal_events (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  animal_id uuid,
  group_id uuid,
  type text not null check (type in ('birth', 'vaccination', 'dosing', 'weighing', 'sale', 'death', 'moved', 'other')),
  date date not null,
  quantity int,
  weight_kg numeric(10,2),
  product text,
  from_camp_id uuid,
  to_camp_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  check (animal_id is not null or group_id is not null),
  foreign key (farm_id, animal_id) references public.animals(farm_id, id) on delete cascade,
  foreign key (farm_id, group_id) references public.livestock_groups(farm_id, id) on delete cascade,
  foreign key (farm_id, from_camp_id) references public.camps(farm_id, id) on delete set null (from_camp_id),
  foreign key (farm_id, to_camp_id) references public.camps(farm_id, id) on delete set null (to_camp_id)
);

create table public.breeding_plans (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  group_id uuid not null,
  joining_start_date date not null,
  joining_end_date date,
  gestation_days int not null,
  expected_birth_start date,          -- calculated in the app, editable
  expected_birth_end date,
  males_used int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  foreign key (farm_id, group_id) references public.livestock_groups(farm_id, id) on delete cascade
);

create table public.shearing_plans (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  group_id uuid not null,
  planned_date date not null,
  done_date date,
  kg_wool numeric(10,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  foreign key (farm_id, group_id) references public.livestock_groups(farm_id, id) on delete cascade
);

-- Grazing and minerals -------------------------------------------------------

create table public.pasture_tests (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  camp_id uuid not null,
  date date not null,
  protein_pct numeric(6,2),
  phosphorus_pct numeric(6,3),
  calcium_pct numeric(6,3),
  magnesium_pct numeric(6,3),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  foreign key (farm_id, camp_id) references public.camps(farm_id, id) on delete cascade
);

create table public.mineral_advice_rules (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  species text not null check (species in ('sheep', 'cattle', 'any')),
  nutrient text not null check (nutrient in ('protein_pct', 'phosphorus_pct', 'calcium_pct', 'magnesium_pct')),
  comparison text not null check (comparison in ('below', 'above')),
  threshold numeric(8,3) not null,
  suggestion text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz
);

-- Inventory and costs --------------------------------------------------------

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  category text not null check (category in ('seed', 'fertiliser', 'chemical', 'feed', 'other')),
  name text not null,
  unit text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  unique (farm_id, id)
);

alter table public.field_operations
  add foreign key (farm_id, inventory_item_id)
  references public.inventory_items(farm_id, id) on delete set null (inventory_item_id);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  item_id uuid not null,
  date date not null,
  quantity numeric(12,3) not null,    -- positive = received, negative = used
  unit_cost numeric(12,2),
  field_operation_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  foreign key (farm_id, item_id) references public.inventory_items(farm_id, id) on delete cascade,
  foreign key (farm_id, field_operation_id) references public.field_operations(farm_id, id) on delete set null (field_operation_id)
);

create table public.costs (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  category text not null check (category in ('fuel', 'labour', 'machinery', 'other')),
  date date not null,
  amount numeric(12,2) not null,
  description text,
  field_id uuid,
  group_id uuid,
  season_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  foreign key (farm_id, field_id) references public.fields(farm_id, id) on delete set null (field_id),
  foreign key (farm_id, group_id) references public.livestock_groups(farm_id, id) on delete set null (group_id),
  foreign key (farm_id, season_id) references public.seasons(farm_id, id) on delete set null (season_id)
);

-- Sales and invoices ---------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  contact_person text,
  email text,
  phone text,
  address text,
  vat_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  unique (farm_id, id)
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  customer_id uuid,
  season_id uuid,
  date date not null,
  description text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  unique (farm_id, id),
  foreign key (farm_id, customer_id) references public.customers(farm_id, id) on delete set null (customer_id),
  foreign key (farm_id, season_id) references public.seasons(farm_id, id) on delete set null (season_id)
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  sale_id uuid not null,
  description text not null,
  quantity numeric(12,3) not null,
  unit text,
  unit_price numeric(12,2) not null,
  vat_applicable boolean not null default true,
  field_id uuid,
  group_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  foreign key (farm_id, sale_id) references public.sales(farm_id, id) on delete cascade,
  foreign key (farm_id, field_id) references public.fields(farm_id, id) on delete set null (field_id),
  foreign key (farm_id, group_id) references public.livestock_groups(farm_id, id) on delete set null (group_id)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  sale_id uuid,
  customer_id uuid,
  invoice_number text not null,
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid')),
  vat_rate numeric(5,2),
  subtotal numeric(12,2),
  vat_amount numeric(12,2),
  total numeric(12,2),
  pdf_path text,
  sent_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  unique (farm_id, id),
  unique (farm_id, invoice_number),
  foreign key (farm_id, sale_id) references public.sales(farm_id, id) on delete set null (sale_id),
  foreign key (farm_id, customer_id) references public.customers(farm_id, id) on delete set null (customer_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  invoice_id uuid not null,
  date date not null,
  amount numeric(12,2) not null,
  method text,
  reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  foreign key (farm_id, invoice_id) references public.invoices(farm_id, id) on delete cascade
);

-- Tasks ----------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  type text not null default 'general',   -- plant, spray, fertilise, harvest, lambing, shearing, general ...
  title text not null,
  due_date date,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  field_id uuid,
  camp_id uuid,
  group_id uuid,
  assigned_to uuid references auth.users(id) on delete set null,
  notes text,
  done_at timestamptz,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  foreign key (farm_id, field_id) references public.fields(farm_id, id) on delete set null (field_id),
  foreign key (farm_id, camp_id) references public.camps(farm_id, id) on delete set null (camp_id),
  foreign key (farm_id, group_id) references public.livestock_groups(farm_id, id) on delete set null (group_id)
);
create index on public.tasks (farm_id, status, due_date);
