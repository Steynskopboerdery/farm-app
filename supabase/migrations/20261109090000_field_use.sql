-- A field is either planted for harvest or used for grazing. For grazing: what grows on it, and animal groups
-- can be put on it (as on a camp); moves to and from it are kept in the animal records.
alter table public.fields
  add column if not exists use text not null default 'crop' check (use in ('crop', 'grazing')),
  add column if not exists pasture_type text;

alter table public.livestock_groups add column if not exists field_id uuid;
alter table public.livestock_groups add constraint livestock_groups_farm_id_field_id_fkey
  foreign key (farm_id, field_id) references public.fields(farm_id, id) on delete set null (field_id);
alter table public.livestock_groups add constraint livestock_groups_one_place check (camp_id is null or field_id is null);
create index if not exists livestock_groups_field_idx on public.livestock_groups (farm_id, field_id);

alter table public.animal_events add column if not exists from_field_id uuid, add column if not exists to_field_id uuid;
alter table public.animal_events add constraint animal_events_farm_id_from_field_id_fkey
  foreign key (farm_id, from_field_id) references public.fields(farm_id, id) on delete set null (from_field_id);
alter table public.animal_events add constraint animal_events_farm_id_to_field_id_fkey
  foreign key (farm_id, to_field_id) references public.fields(farm_id, id) on delete set null (to_field_id);
create index if not exists animal_events_to_field_idx on public.animal_events (farm_id, to_field_id);
create index if not exists animal_events_from_field_idx on public.animal_events (farm_id, from_field_id);
