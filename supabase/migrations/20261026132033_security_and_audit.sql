-- Row Level Security, permissions, change stamps and audit triggers.
--
-- Roles:
--   owner  = farmer / admin: can see and change everything on the farm.
--   worker = can view farm records and tasks, and tick tasks off.
--            Workers never see money (sales, invoices, costs, customers) or bank details.

revoke all on all tables in schema public from anon;

do $$
declare
  t text;
  -- Workers may read these; only owners change them.
  member_read text[] := array[
    'fields', 'camps', 'seasons', 'plantings', 'field_operations', 'harvests',
    'planning_estimates', 'species_reference', 'livestock_groups', 'animals',
    'animal_events', 'breeding_plans', 'shearing_plans', 'pasture_tests',
    'mineral_advice_rules', 'inventory_items', 'inventory_movements'
  ];
  -- Owner only.
  owner_only text[] := array[
    'farm_settings', 'farm_invites', 'costs', 'customers', 'sales',
    'sale_items', 'invoices', 'payments'
  ];
begin
  foreach t in array member_read || owner_only || array['tasks', 'farms', 'farm_members'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function private.set_updated_at()', t);
    execute format('create trigger audit after insert or update or delete on public.%I
                    for each row execute function private.audit_row()', t);
  end loop;

  foreach t in array member_read loop
    execute format('create policy "members read" on public.%I for select to authenticated
                    using ((select private.is_member(farm_id)))', t);
    execute format('create policy "owners insert" on public.%I for insert to authenticated
                    with check ((select private.is_owner(farm_id)))', t);
    execute format('create policy "owners update" on public.%I for update to authenticated
                    using ((select private.is_owner(farm_id))) with check ((select private.is_owner(farm_id)))', t);
    execute format('create policy "owners delete" on public.%I for delete to authenticated
                    using ((select private.is_owner(farm_id)))', t);
  end loop;

  foreach t in array owner_only loop
    execute format('create policy "owners all" on public.%I for all to authenticated
                    using ((select private.is_owner(farm_id))) with check ((select private.is_owner(farm_id)))', t);
  end loop;
end $$;

-- Tasks: everyone on the farm can read and update (tick off); owners create and delete.
create policy "members read" on public.tasks for select to authenticated
  using ((select private.is_member(farm_id)));
create policy "members update" on public.tasks for update to authenticated
  using ((select private.is_member(farm_id))) with check ((select private.is_member(farm_id)));
create policy "owners insert" on public.tasks for insert to authenticated
  with check ((select private.is_owner(farm_id)));
create policy "owners delete" on public.tasks for delete to authenticated
  using ((select private.is_owner(farm_id)));

-- Workers may only change a task's status, done time and notes.
create or replace function private.limit_worker_task_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_owner(new.farm_id) then
    if (to_jsonb(new) - array['status', 'done_at', 'notes', 'updated_at'])
       is distinct from (to_jsonb(old) - array['status', 'done_at', 'notes', 'updated_at']) then
      raise exception 'Workers can only change the status and notes of a task';
    end if;
  end if;
  return new;
end $$;
create trigger limit_worker_task_update before update on public.tasks
  for each row execute function private.limit_worker_task_update();

-- Farms: members read; owners update. New farms are made through create_farm().
create policy "members read" on public.farms for select to authenticated
  using ((select private.is_member(id)));
create policy "owners update" on public.farms for update to authenticated
  using ((select private.is_owner(id))) with check ((select private.is_owner(id)));
revoke insert, delete on public.farms from authenticated;

-- Members: everyone on the farm sees the team; owners manage it.
create policy "members read" on public.farm_members for select to authenticated
  using ((select private.is_member(farm_id)));
create policy "owners insert" on public.farm_members for insert to authenticated
  with check ((select private.is_owner(farm_id)));
create policy "owners update" on public.farm_members for update to authenticated
  using ((select private.is_owner(farm_id))) with check ((select private.is_owner(farm_id)));
create policy "owners delete" on public.farm_members for delete to authenticated
  using ((select private.is_owner(farm_id)));

-- Audit log: owners can read their farm's history; nobody can change it.
alter table public.audit_log enable row level security;
grant select on public.audit_log to authenticated;
create policy "owners read" on public.audit_log for select to authenticated
  using ((select private.is_owner(farm_id)));

-- Indexes for the common "records for this field / group / camp" lookups.
create index on public.plantings (farm_id, field_id);
create index on public.plantings (farm_id, season_id);
create index on public.field_operations (farm_id, field_id);
create index on public.field_operations (farm_id, season_id);
create index on public.field_operations (farm_id, inventory_item_id);
create index on public.harvests (farm_id, field_id);
create index on public.harvests (farm_id, season_id);
create index on public.livestock_groups (farm_id, camp_id);
create index on public.animals (farm_id, group_id);
create index on public.animal_events (farm_id, animal_id);
create index on public.animal_events (farm_id, group_id);
create index on public.animal_events (farm_id, from_camp_id);
create index on public.animal_events (farm_id, to_camp_id);
create index on public.breeding_plans (farm_id, group_id);
create index on public.shearing_plans (farm_id, group_id);
create index on public.pasture_tests (farm_id, camp_id);
create index on public.inventory_movements (farm_id, item_id);
create index on public.inventory_movements (farm_id, field_operation_id);
create index on public.costs (farm_id, field_id);
create index on public.costs (farm_id, group_id);
create index on public.costs (farm_id, season_id);
create index on public.sales (farm_id, customer_id);
create index on public.sales (farm_id, season_id);
create index on public.sale_items (farm_id, sale_id);
create index on public.sale_items (farm_id, field_id);
create index on public.sale_items (farm_id, group_id);
create index on public.invoices (farm_id, sale_id);
create index on public.invoices (farm_id, customer_id);
create index on public.payments (farm_id, invoice_id);
create index on public.tasks (farm_id, field_id);
create index on public.tasks (farm_id, camp_id);
create index on public.tasks (farm_id, group_id);
create index on public.tasks (assigned_to);
create index on public.planning_estimates (farm_id);
create index on public.mineral_advice_rules (farm_id);
create index on public.farm_invites (farm_id);
create index on public.farms (created_by);
