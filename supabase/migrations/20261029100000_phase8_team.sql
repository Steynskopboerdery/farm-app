-- Phase 8: staff, work schedule, leave, staff documents, work diary, chat and broadcast messages.
--
-- Staff records are personal information (POPIA): only owners see all of them.
-- A worker with an app login sees only their own record, leave, documents and diary.
-- Staff without a phone or login can still be on the schedule; the owner keeps their records.

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,   -- their app login, if they have one
  full_name text not null,
  job_title text,
  phone text,
  id_number text,
  address text,
  emergency_contact text,
  employment_type text not null default 'permanent' check (employment_type in ('permanent', 'seasonal', 'casual')),
  start_date date,
  work_days int[] not null default '{1,2,3,4,5}',   -- ISO weekdays: 1 = Monday ... 7 = Sunday
  annual_leave_days numeric(5,1) not null default 15,   -- working days per year (BCEA: 21 consecutive days = 15 for a 5-day week)
  sick_leave_days numeric(5,1) not null default 30,     -- per 36-month cycle (BCEA, 5-day week)
  family_leave_days numeric(5,1) not null default 3,    -- per year
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  unique (farm_id, id)
);
create unique index staff_user_unique on public.staff (farm_id, user_id) where user_id is not null and deleted_at is null;
create index on public.staff (user_id);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  staff_id uuid not null,
  type text not null check (type in ('annual', 'sick', 'family', 'unpaid', 'other')),
  start_date date not null,
  end_date date not null,
  days numeric(5,1) not null check (days >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  reason text,
  owner_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  check (end_date >= start_date),
  unique (farm_id, id),
  foreign key (farm_id, staff_id) references public.staff(farm_id, id) on delete cascade
);
create index on public.leave_requests (farm_id, staff_id, start_date);

create table public.staff_documents (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  staff_id uuid not null,
  kind text not null default 'other' check (kind in ('cv', 'sick_note', 'leave_form', 'contract', 'id_copy', 'certificate', 'other')),
  title text,
  path text not null,
  leave_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  foreign key (farm_id, staff_id) references public.staff(farm_id, id) on delete cascade,
  foreign key (farm_id, leave_id) references public.leave_requests(farm_id, id) on delete set null (leave_id)
);
create index on public.staff_documents (farm_id, staff_id);
create index on public.staff_documents (farm_id, leave_id);

-- Who works when. Everyone on the farm can see the schedule.
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  staff_id uuid not null,
  date date not null,
  start_time time,
  end_time time,
  work text,                           -- what they will do
  field_id uuid,
  camp_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  foreign key (farm_id, staff_id) references public.staff(farm_id, id) on delete cascade,
  foreign key (farm_id, field_id) references public.fields(farm_id, id) on delete set null (field_id),
  foreign key (farm_id, camp_id) references public.camps(farm_id, id) on delete set null (camp_id)
);
create index on public.shifts (farm_id, date);
create index on public.shifts (farm_id, staff_id);
create index on public.shifts (farm_id, field_id);
create index on public.shifts (farm_id, camp_id);

-- "What I did today", written by the worker (or by the owner for staff without a login).
create table public.work_diary (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  staff_id uuid not null,
  date date not null,
  hours numeric(4,1) check (hours is null or (hours >= 0 and hours <= 24)),
  notes text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  foreign key (farm_id, staff_id) references public.staff(farm_id, id) on delete cascade
);
create index on public.work_diary (farm_id, staff_id, date);

-- Messages: recipient set = private message between two people; recipient empty = broadcast to everyone on the farm.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.messages (farm_id, created_at desc);
create index on public.messages (recipient_id, created_at desc);
create index on public.messages (sender_id, created_at desc);

-- When each person last read each conversation (peer_id = the other person, or the farm id for broadcasts).
create table public.chat_reads (
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  peer_id uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (farm_id, user_id, peer_id)
);
create index on public.chat_reads (user_id);

-- Helpers -------------------------------------------------------------------------

-- True when the staff record belongs to the logged-in person.
create or replace function private.is_self_staff(fid uuid, sid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s
    where s.farm_id = fid and s.id = sid and s.user_id = (select auth.uid()) and s.deleted_at is null
  )
$$;
grant execute on function private.is_self_staff(uuid, uuid) to authenticated;

create or replace function private.user_in_farm(fid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.farm_members m where m.farm_id = fid and m.user_id = uid and m.deleted_at is null)
$$;
grant execute on function private.user_in_farm(uuid, uuid) to authenticated;

-- Names only, so everyone can read the schedule without seeing personal details.
create or replace function public.staff_directory(fid uuid)
returns table (id uuid, full_name text, job_title text, user_id uuid, active boolean)
language sql stable security definer set search_path = '' as $$
  select s.id, s.full_name, s.job_title, s.user_id, s.active from public.staff s
  where s.farm_id = fid and s.deleted_at is null and private.is_member(fid)
  order by s.full_name
$$;
revoke execute on function public.staff_directory(uuid) from public, anon;
grant execute on function public.staff_directory(uuid) to authenticated;

-- Security, stamps, history ----------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['staff', 'leave_requests', 'staff_documents', 'shifts', 'work_diary'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function private.set_updated_at()', t);
    execute format('create trigger audit after insert or update or delete on public.%I
                    for each row execute function private.audit_row()', t);
    execute format('create policy "owners all" on public.%I for all to authenticated
                    using ((select private.is_owner(farm_id))) with check ((select private.is_owner(farm_id)))', t);
  end loop;
end $$;

create policy "self read" on public.staff for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_member(farm_id)));

-- Leave: workers see and ask for their own; they may only cancel a request that is still waiting.
create policy "self read" on public.leave_requests for select to authenticated
  using ((select private.is_self_staff(farm_id, staff_id)));
create policy "self insert" on public.leave_requests for insert to authenticated
  with check ((select private.is_self_staff(farm_id, staff_id)) and status = 'pending' and decided_by is null);
create policy "self update" on public.leave_requests for update to authenticated
  using ((select private.is_self_staff(farm_id, staff_id)))
  with check ((select private.is_self_staff(farm_id, staff_id)));

create or replace function private.limit_worker_leave_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_owner(new.farm_id) then
    if old.status <> 'pending' or new.status not in ('pending', 'cancelled')
       or (to_jsonb(new) - array['status', 'reason', 'start_date', 'end_date', 'days', 'type', 'updated_at'])
          is distinct from (to_jsonb(old) - array['status', 'reason', 'start_date', 'end_date', 'days', 'type', 'updated_at']) then
      raise exception 'Only the farm owner can approve or change leave';
    end if;
  end if;
  return new;
end $$;
create trigger limit_worker_leave_update before update on public.leave_requests
  for each row execute function private.limit_worker_leave_update();

create policy "self read" on public.staff_documents for select to authenticated
  using ((select private.is_self_staff(farm_id, staff_id)));
create policy "self insert" on public.staff_documents for insert to authenticated
  with check ((select private.is_self_staff(farm_id, staff_id)));

create policy "members read" on public.shifts for select to authenticated
  using ((select private.is_member(farm_id)));

create policy "self read" on public.work_diary for select to authenticated
  using ((select private.is_self_staff(farm_id, staff_id)));
create policy "self insert" on public.work_diary for insert to authenticated
  with check ((select private.is_self_staff(farm_id, staff_id)));
create policy "self update" on public.work_diary for update to authenticated
  using ((select private.is_self_staff(farm_id, staff_id))) with check ((select private.is_self_staff(farm_id, staff_id)));

-- Messages: only the two people in a private chat can read it; everyone on the farm reads broadcasts.
-- Only owners may broadcast. Messages cannot be edited; the sender can hide their own.
alter table public.messages enable row level security;
grant select, insert, update on public.messages to authenticated;
create policy "read own and broadcasts" on public.messages for select to authenticated
  using ((select private.is_member(farm_id)) and (
    sender_id = (select auth.uid()) or recipient_id = (select auth.uid()) or recipient_id is null));
create policy "send" on public.messages for insert to authenticated
  with check ((select private.is_member(farm_id)) and sender_id = (select auth.uid()) and (
    (recipient_id is null and (select private.is_owner(farm_id)))
    or (recipient_id is not null and recipient_id <> sender_id and private.user_in_farm(farm_id, recipient_id))));
create policy "hide own" on public.messages for update to authenticated
  using (sender_id = (select auth.uid())) with check (sender_id = (select auth.uid()));

create or replace function private.limit_message_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'deleted_at') is distinct from (to_jsonb(old) - 'deleted_at') then
    raise exception 'Messages cannot be edited';
  end if;
  return new;
end $$;
create trigger limit_message_update before update on public.messages
  for each row execute function private.limit_message_update();

alter table public.chat_reads enable row level security;
grant select, insert, update on public.chat_reads to authenticated;
create policy "own reads" on public.chat_reads for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select private.is_member(farm_id)));

-- Live updates for new messages (row level security still decides who receives them).
alter publication supabase_realtime add table public.messages;

-- Staff documents (CVs, sick notes, leave forms): private bucket, folder <farm id>/<staff id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('staff-docs', 'staff-docs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create or replace function private.doc_staff(object_name text)
returns uuid language sql immutable set search_path = '' as $$
  select case when (storage.foldername(object_name))[2] ~ '^[0-9a-f-]{36}$'
              then (storage.foldername(object_name))[2]::uuid end
$$;
grant execute on function private.doc_staff(text) to authenticated;

create policy "staff docs owners" on storage.objects for all to authenticated
  using (bucket_id = 'staff-docs' and (select private.is_owner(private.photo_farm(name))))
  with check (bucket_id = 'staff-docs' and (select private.is_owner(private.photo_farm(name))));
create policy "staff docs self view" on storage.objects for select to authenticated
  using (bucket_id = 'staff-docs' and (select private.is_self_staff(private.photo_farm(name), private.doc_staff(name))));
create policy "staff docs self add" on storage.objects for insert to authenticated
  with check (bucket_id = 'staff-docs' and (select private.is_self_staff(private.photo_farm(name), private.doc_staff(name))));
