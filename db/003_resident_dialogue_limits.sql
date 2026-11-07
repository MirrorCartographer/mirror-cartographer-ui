-- Per-user request quota for model-backed resident dialogue.
-- The table is intentionally inaccessible to browser roles; callers use one
-- authenticated RPC that derives the user ID from auth.uid().
create table if not exists public.resident_dialogue_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.resident_dialogue_limits enable row level security;
revoke all on public.resident_dialogue_limits from anon, authenticated;

create or replace function public.consume_resident_dialogue_quota(
  p_max_requests integer default 12,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  current_count integer;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if p_max_requests < 1 or p_window_seconds < 1 then
    raise exception 'Quota settings must be positive';
  end if;

  insert into public.resident_dialogue_limits (user_id, window_started_at, request_count, updated_at)
  values (caller_id, now(), 1, now())
  on conflict (user_id) do update
  set
    window_started_at = case
      when public.resident_dialogue_limits.window_started_at < now() - make_interval(secs => p_window_seconds)
      then now()
      else public.resident_dialogue_limits.window_started_at
    end,
    request_count = case
      when public.resident_dialogue_limits.window_started_at < now() - make_interval(secs => p_window_seconds)
      then 1
      else public.resident_dialogue_limits.request_count + 1
    end,
    updated_at = now()
  returning request_count into current_count;

  return current_count <= p_max_requests;
end;
$$;

revoke all on function public.consume_resident_dialogue_quota(integer, integer) from public, anon;
grant execute on function public.consume_resident_dialogue_quota(integer, integer) to authenticated;
