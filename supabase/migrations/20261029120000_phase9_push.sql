-- Phase 9: phone notifications (Web Push).
--
-- Each phone that switches notifications on stores its push address here.
-- The "notify" edge function sends:
--   * straight away: new chat / broadcast messages, leave requests and answers, tasks given to someone;
--   * every morning at 07:30: tasks due, withholding periods ending, lambing / calving / shearing coming up,
--     leave waiting, and on Mondays a weekly check (low stock, services due, animals missing, open map pins).
--
-- Secrets live in Supabase Vault (never in this file):
--   farm_push_public, farm_push_private  - the VAPID key pair for Web Push
--   farm_notify_secret                   - shared secret between the database and the notify function
--   farm_project_url                     - https://<project>.supabase.co

create extension if not exists pg_net schema extensions;
create extension if not exists pg_cron;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  lang text not null default 'en' check (lang in ('en', 'af')),
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
create policy "own subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Read by the notify function only (service role).
create or replace function public.push_config()
returns table (public_key text, private_key text, notify_secret text)
language sql stable security definer set search_path = '' as $$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'farm_push_public'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'farm_push_private'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'farm_notify_secret')
$$;
revoke execute on function public.push_config() from public, anon, authenticated;
grant execute on function public.push_config() to service_role;

-- Calls the notify function in the background (does not slow down the save).
create or replace function private.call_notify(payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  base text := (select decrypted_secret from vault.decrypted_secrets where name = 'farm_project_url');
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'farm_notify_secret');
begin
  if base is null or secret is null then return; end if;
  perform net.http_post(
    url := base || '/functions/v1/notify',
    body := payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-farm-secret', secret),
    timeout_milliseconds := 10000
  );
end $$;

create or replace function private.notify_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.call_notify(jsonb_build_object('mode', 'message', 'id', new.id));
  return new;
end $$;
create trigger notify_message after insert on public.messages
  for each row execute function private.notify_message();

create or replace function private.notify_leave()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform private.call_notify(jsonb_build_object('mode', 'leave_request', 'id', new.id));
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('approved', 'declined') then
    perform private.call_notify(jsonb_build_object('mode', 'leave_answer', 'id', new.id));
  end if;
  return new;
end $$;
create trigger notify_leave after insert or update of status on public.leave_requests
  for each row execute function private.notify_leave();

create or replace function private.notify_task()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_to is not null and new.assigned_to is distinct from new.created_by
     and (tg_op = 'INSERT' or old.assigned_to is distinct from new.assigned_to) then
    perform private.call_notify(jsonb_build_object('mode', 'task', 'id', new.id));
  end if;
  return new;
end $$;
create trigger notify_task after insert or update of assigned_to on public.tasks
  for each row execute function private.notify_task();

-- Every morning at 07:30 South African time (05:30 UTC).
select cron.schedule('farm-daily-reminders', '30 5 * * *', $$ select private.call_notify('{"mode":"daily"}'::jsonb) $$);
