-- Phase 10: yearly budget and cash flow, price alerts, phone-alert log, prediction snapshots,
-- livestock plan figures and grazing capacity.

-- One budget per farm per year: money in and out, with the months it moves in.
create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  year int not null check (year between 2000 and 2100),
  kind text not null check (kind in ('income', 'expense')),
  category text not null default 'other',
  label text not null,
  amount numeric(14,2) not null check (amount >= 0),
  months int[] not null default '{1,2,3,4,5,6,7,8,9,10,11,12}' check (cardinality(months) between 1 and 12 and months <@ '{1,2,3,4,5,6,7,8,9,10,11,12}'),
  notes text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz
);
create index on public.budget_lines (farm_id, year);

-- Money in the bank at the start of each budget year (for the running balance).
create table public.budget_years (
  farm_id uuid not null references public.farms(id) on delete cascade,
  year int not null check (year between 2000 and 2100),
  opening_balance numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  primary key (farm_id, year)
);

-- "Tell me when canola goes above R10 000/t." Series are the World Bank keys used on the Predictions tab.
create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  series text not null,
  direction text not null check (direction in ('above', 'below')),
  target numeric(14,2) not null check (target > 0),      -- Rand per unit of the series (per t or per kg)
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz
);
create index on public.price_alerts (farm_id);

-- What the Predictions tab said, saved once a month, so the end-of-season scorecard can compare with what happened.
create table public.prediction_snapshots (
  farm_id uuid not null references public.farms(id) on delete cascade,
  year int not null,
  made_month text not null check (made_month ~ '^\d{4}-\d{2}$'),
  data jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  primary key (farm_id, year, made_month)
);

-- Which automatic phone alerts have gone out, so each is sent once. Only the server uses this.
create table public.alert_log (
  farm_id uuid not null references public.farms(id) on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (farm_id, key)
);
alter table public.alert_log enable row level security;

-- Livestock plan figures (per breeding female): young weaned per 100, price per young, wool.
alter table public.planning_estimates
  add column if not exists weaning_pct numeric(6,1),
  add column if not exists price_per_head numeric(12,2),
  add column if not exists wool_kg_per_head numeric(6,2),
  add column if not exists wool_price_per_kg numeric(10,2);

-- Grazing: hectares the animals graze and how many hectares one large stock unit needs in a normal year.
alter table public.farm_settings
  add column if not exists grazing_ha numeric(10,2),
  add column if not exists ha_per_lsu numeric(6,2);

-- Security, change stamps, history: these hold money, so owners only.
do $$
declare t text;
begin
  foreach t in array array['budget_lines', 'budget_years', 'price_alerts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function private.set_updated_at()', t);
    execute format('create trigger audit after insert or update or delete on public.%I
                    for each row execute function private.audit_row()', t);
    execute format('create policy "owners read" on public.%I for select to authenticated using ((select private.is_owner(farm_id)))', t);
    execute format('create policy "owners insert" on public.%I for insert to authenticated with check ((select private.is_owner(farm_id)))', t);
    execute format('create policy "owners update" on public.%I for update to authenticated
                    using ((select private.is_owner(farm_id))) with check ((select private.is_owner(farm_id)))', t);
    execute format('create policy "owners delete" on public.%I for delete to authenticated using ((select private.is_owner(farm_id)))', t);
  end loop;
end $$;

alter table public.prediction_snapshots enable row level security;
grant select, insert, update on public.prediction_snapshots to authenticated;
create policy "owners read" on public.prediction_snapshots for select to authenticated using ((select private.is_owner(farm_id)));
create policy "owners insert" on public.prediction_snapshots for insert to authenticated with check ((select private.is_owner(farm_id)));
create policy "owners update" on public.prediction_snapshots for update to authenticated
  using ((select private.is_owner(farm_id))) with check ((select private.is_owner(farm_id)));
