-- Phase 5: warn when stock in the store drops below this level.
alter table public.inventory_items add column if not exists reorder_level numeric(12,3);
