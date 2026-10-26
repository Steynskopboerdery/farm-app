-- Core: farms, members, invites, settings, audit trail, helper functions.
-- Every farm table carries farm_id; Row Level Security keeps each farm's data private.

create extension if not exists pgcrypto;

create schema if not exists private;
grant usage on schema private to authenticated;

-- Keeps updated_at current on every change.
create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table public.farms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_text text,
  total_hectares numeric(10,2),
  map_center_lat double precision,
  map_center_lng double precision,
  map_zoom int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz
);

create table public.farm_members (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'worker')),
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  unique (farm_id, user_id)
);
create index on public.farm_members (user_id);

-- Owner adds an email here; when that person logs in they join the farm.
create table public.farm_invites (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  email text not null,
  role text not null default 'worker' check (role in ('owner', 'worker')),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz
);
create index on public.farm_invites (lower(email));

-- Business and banking details, owner-only (workers never see these).
create table public.farm_settings (
  farm_id uuid primary key references public.farms(id) on delete cascade,
  legal_name text,
  address text,
  phone text,
  email text,
  vat_registered boolean not null default true,
  vat_number text,
  vat_rate numeric(5,2) not null default 15.00,
  invoice_prefix text not null default 'INV-',
  next_invoice_number int not null default 1,
  payment_terms_days int not null default 30,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_branch_code text,
  bank_account_type text,
  invoice_footer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz
);

-- Who changed what, when. Written only by triggers.
create table public.audit_log (
  id bigint generated always as identity primary key,
  farm_id uuid,
  table_name text not null,
  record_id uuid,
  action text not null,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);
create index on public.audit_log (farm_id, table_name, record_id);
create index on public.audit_log (farm_id, changed_at desc);

create or replace function private.is_member(fid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.farm_members m
    where m.farm_id = fid and m.user_id = (select auth.uid()) and m.deleted_at is null
  )
$$;

create or replace function private.is_owner(fid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.farm_members m
    where m.farm_id = fid and m.user_id = (select auth.uid())
      and m.role = 'owner' and m.deleted_at is null
  )
$$;

grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_owner(uuid) to authenticated;

create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  n jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  o jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  fid uuid;
begin
  if tg_table_name = 'farms' then
    fid := coalesce(n->>'id', o->>'id')::uuid;
  else
    fid := coalesce(n->>'farm_id', o->>'farm_id')::uuid;
  end if;
  -- Skip updates that change nothing except updated_at.
  if tg_op = 'UPDATE' and (n - 'updated_at') = (o - 'updated_at') then
    return new;
  end if;
  insert into public.audit_log (farm_id, table_name, record_id, action, changed_by, old_data, new_data)
  values (fid, tg_table_name, coalesce(n->>'id', o->>'id')::uuid,
          lower(tg_op), auth.uid(), o, n);
  return coalesce(new, old);
end $$;
