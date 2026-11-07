-- Shared-world presence and relationship grants.
-- Presence is a short-lived projection, not a durable activity history.
create table if not exists public.world_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint world_connections_distinct_users check (requester_id <> recipient_id),
  constraint world_connections_unique_pair unique (requester_id, recipient_id)
);

create index if not exists world_connections_requester_idx on public.world_connections(requester_id, status);
create index if not exists world_connections_recipient_idx on public.world_connections(recipient_id, status);
create unique index if not exists world_connections_undirected_pair_idx on public.world_connections (least(requester_id, recipient_id), greatest(requester_id, recipient_id));
alter table public.world_connections enable row level security;

drop policy if exists world_connections_participant_read on public.world_connections;
create policy world_connections_participant_read on public.world_connections
for select using (auth.uid() = requester_id or auth.uid() = recipient_id);

drop policy if exists world_connections_request on public.world_connections;
create policy world_connections_request on public.world_connections
for insert with check (auth.uid() = requester_id and status = 'pending');

drop policy if exists world_connections_recipient_decision on public.world_connections;
create policy world_connections_recipient_decision on public.world_connections
for update using (auth.uid() = recipient_id and status = 'pending')
with check (auth.uid() = recipient_id and status in ('accepted','declined'));

drop policy if exists world_connections_requester_revoke on public.world_connections;
drop policy if exists world_connections_requester_cancel on public.world_connections;
drop policy if exists world_connections_participant_revoke on public.world_connections;
create policy world_connections_requester_cancel on public.world_connections
for update using (auth.uid() = requester_id and status = 'pending')
with check (auth.uid() = requester_id and status = 'revoked');
create policy world_connections_participant_revoke on public.world_connections
for update using ((auth.uid() = requester_id or auth.uid() = recipient_id) and status = 'accepted')
with check ((auth.uid() = requester_id or auth.uid() = recipient_id) and status = 'revoked');

create table if not exists public.world_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Wanderer' check (char_length(display_name) between 1 and 40),
  room_id text not null default 'the-between' check (char_length(room_id) between 1 and 80),
  activity_state text not null default 'present' check (activity_state in ('present','wandering','in-conversation','away')),
  visibility text not null default 'private' check (visibility in ('private','connections','public')),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 seconds')
);

create index if not exists world_presence_expiry_idx on public.world_presence(expires_at);
create index if not exists world_presence_room_idx on public.world_presence(room_id, visibility, expires_at);
alter table public.world_presence enable row level security;

drop policy if exists world_presence_visible_read on public.world_presence;
create policy world_presence_visible_read on public.world_presence
for select using (
  auth.uid() = user_id
  or (visibility = 'public' and expires_at > now())
  or (
    visibility = 'connections' and expires_at > now()
    and exists (
      select 1 from public.world_connections c
      where c.status = 'accepted'
        and ((c.requester_id = auth.uid() and c.recipient_id = world_presence.user_id)
          or (c.recipient_id = auth.uid() and c.requester_id = world_presence.user_id))
    )
  )
);

drop policy if exists world_presence_owner_write on public.world_presence;
create policy world_presence_owner_write on public.world_presence
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realtime carries only this consent-filtered, expiring presence projection.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'world_presence'
  ) then
    alter publication supabase_realtime add table public.world_presence;
  end if;
end $$;


-- A connection's participants are immutable; only the permitted state transitions are allowed.
create or replace function public.guard_world_connection_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.requester_id is distinct from old.requester_id
    or new.recipient_id is distinct from old.recipient_id then
    raise exception 'Connection participants are immutable';
  end if;

  if not (
    (old.status = 'pending' and new.status in ('pending', 'accepted', 'declined', 'revoked'))
    or (old.status = 'accepted' and new.status in ('accepted', 'revoked'))
    or old.status = new.status
  ) then
    raise exception 'Invalid connection status transition';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists world_connections_guard_update on public.world_connections;
create trigger world_connections_guard_update
before update on public.world_connections
for each row execute function public.guard_world_connection_update();

-- Presence is a heartbeat projection. Clients cannot extend a stale presence indefinitely.
create or replace function public.refresh_world_presence_expiry()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.last_seen_at := now();
  new.expires_at := now() + interval '90 seconds';
  return new;
end;
$$;

drop trigger if exists world_presence_refresh_expiry on public.world_presence;
create trigger world_presence_refresh_expiry
before insert or update on public.world_presence
for each row execute function public.refresh_world_presence_expiry();

grant select, insert, update on public.world_connections to authenticated;
grant select, insert, update, delete on public.world_presence to authenticated;
