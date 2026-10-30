-- Prediction tab: downloaded history and outlooks are kept here so they are fetched at most every few days.
-- Only the "outlook" edge function (service role) reads and writes this table; the app gets the data through the function.
create table public.outlook_cache (
  key text primary key,          -- e.g. 'climate:-34.25,20.25', 'enso', 'markets'
  data jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.outlook_cache enable row level security;
revoke all on public.outlook_cache from anon, authenticated;
