-- A farm can be made ready for people before it is set up: the first owner to log in then names it,
-- puts it on the map and says what is farmed. Farms made in the app are set up straight away.
alter table public.farms add column if not exists setup_completed_at timestamptz default now();
update public.farms set setup_completed_at = created_at where setup_completed_at is null;
