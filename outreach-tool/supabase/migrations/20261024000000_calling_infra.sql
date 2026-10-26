-- ============================================================
-- Vexabots - Calling Infrastructure (SAFE TO APPLY)
-- Adds columns and functions needed for Telnyx calling
-- Does NOT change RLS policies — apply separately when ready
-- ============================================================

-- ============================================================
-- Helper function: single source of truth for admin checks
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
$$;

-- ============================================================
-- Call log status constraint: list violating rows FIRST
-- Run this query manually to see what's at risk:
--
-- select id, status from public.call_logs
-- where status not in ('initiated','ringing','answered','busy','voicemail','no_answer','disconnected');
-- ============================================================
alter table public.call_logs
  drop constraint if exists call_logs_status_check;

alter table public.call_logs
  add constraint call_logs_status_check
  check (status in (
    'initiated',     -- call just started
    'ringing',       -- remote party is ringing
    'answered',      -- answered
    'busy',          -- busy
    'voicemail',     -- went to voicemail
    'no_answer',     -- no answer
    'disconnected'   -- call ended
  ));

-- ============================================================
-- Add telnyx_credential_id to profiles (for per-user calling)
-- ============================================================
alter table public.profiles
  add column if not exists telnyx_credential_id text;

-- ============================================================
-- Add Telnyx SDK call identifiers to call_logs
-- Populated by the hook (PATCH) or the webhook
-- ============================================================
alter table public.call_logs
  add column if not exists telnyx_call_control_id text;

alter table public.call_logs
  add column if not exists telnyx_call_session_id text;

-- ============================================================
-- Trigger function: blocks non-admin profile edits to
-- role / phone_number. Uses NEW for row-level trigger.
-- ============================================================
create or replace function public.check_profile_privileges()
returns trigger
language plpgsql
as $$
begin
  -- Allow service_role / server-side code (auth.uid() IS NULL)
  if auth.uid() is null then
    return new;
  end if;

  -- Only block changes to protected columns (role, phone_number)
  if (new.role is distinct from old.role) and not public.is_admin() then
    raise exception 'Unauthorized: only admins can modify the role column';
  end if;

  if (new.phone_number is distinct from old.phone_number) and not public.is_admin() then
    raise exception 'Unauthorized: only admins can modify the phone_number column';
  end if;

  return new;
end;
$$;

-- ============================================================
-- Trigger function: prevents non-admins from changing protected
-- lead columns
-- ============================================================
create or replace function public.check_lead_assignment_lock()
returns trigger
language plpgsql
as $$
begin
  -- Allow service_role / server-site code
  if auth.uid() is null then
    return new;
  end if;

  -- Non-admins cannot change these columns
  if not public.is_admin() then
    if (new.assigned_to is distinct from old.assigned_to) then
      raise exception 'Unauthorized: only admins can change assigned_to';
    end if;
    if (new.assigned_by is distinct from old.assigned_by) then
      raise exception 'Unauthorized: only admins can change assigned_by';
    end if;
    if (new.assigned_at is distinct from old.assigned_at) then
      raise exception 'Unauthorized: only admins can change assigned_at';
    end if;
    if (new.owner_id is distinct from old.owner_id) then
      raise exception 'Unauthorized: only admins can change owner_id';
    end if;
    if (new.source is distinct from old.source) then
      raise exception 'Unauthorized: only admins can change source';
    end if;
    if (new.icp_score is distinct from old.icp_score) then
      raise exception 'Unauthorized: only admins can change icp_score';
    end if;
  end if;

  return new;
end;
$$;

-- ============================================================
-- Attach triggers (idempotent: drop before create)
-- ============================================================
drop trigger if exists profile_privilege_check on public.profiles;
create trigger profile_privilege_check
  before update of role, phone_number on public.profiles
  for each row
  execute function public.check_profile_privileges();

drop trigger if exists lead_assignment_lock on public.leads;
create trigger lead_assignment_lock
  before update of assigned_to, assigned_by, assigned_at, owner_id, source, icp_score on public.leads
  for each row
  execute function public.check_lead_assignment_lock();

-- ============================================================
-- claim_lead: security definer function
-- max_leads = 0 means UNLIMITED
-- ============================================================
create or replace function public.claim_lead(p_lead_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assigned_to uuid;
  v_lead_count int;
  v_max_leads int;
begin
  if auth.uid() is null then
    return false;
  end if;

  select assigned_to into v_assigned_to
  from public.leads
  where id = p_lead_id
  for update;

  if v_assigned_to is not null and v_assigned_to != auth.uid() then
    return false;
  end if;

  select al.max_leads, al.current_leads
  into v_max_leads, v_lead_count
  from public.assignment_limits al
  where al.profile_id = auth.uid()
  for update;

  -- max_leads = 0 means unlimited; otherwise enforce the cap
  if v_max_leads is not null and v_max_leads > 0 and v_lead_count >= v_max_leads then
    return false;
  end if;

  update public.leads
  set assigned_to = auth.uid(),
      assigned_at = now(),
      assigned_by = auth.uid()
  where id = p_lead_id;

  if v_max_leads is not null and v_max_leads > 0 then
    update public.assignment_limits
    set current_leads = current_leads + 1
    where profile_id = auth.uid();
  end if;

  return true;
end;
$$;

-- ============================================================
-- log_call_outcome: security definer function
-- Authorization: admin OR (lead assigned_to = auth.uid()
--   AND, when p_call_log_id is given, that call_log has
--   caller_id = auth.uid() AND lead_id = p_lead_id).
-- A call-log owner alone does NOT authorize.
-- p_status is text (validated against the LeadStatus enum values).
-- ============================================================
create or replace function public.log_call_outcome(
  p_lead_id uuid,
  p_status text default null,
  p_notes text default null,
  p_follow_up_at timestamptz default null,
  p_call_log_id uuid default null,
  p_duration_seconds integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verify the caller is authorized: admin OR
  --   (lead assigned to caller AND, if a call_log_id was given,
  --    that call log belongs to the caller AND references this lead)
  if not (public.is_admin()
    or (
      exists (
        select 1 from public.leads l
        where l.id = p_lead_id
        and l.assigned_to = auth.uid()
      )
      and (
        p_call_log_id is null
        or exists (
          select 1 from public.call_logs cl
          where cl.id = p_call_log_id
          and cl.caller_id = auth.uid()
          and cl.lead_id = p_lead_id
        )
      )
    )
  ) then
    raise exception 'Unauthorized: you are not assigned to this lead';
  end if;

  -- Validate status against the LeadStatus enum values
  if p_status is not null then
    if p_status not in ('new', 'contacted', 'interested', 'not_interested', 'send_info', 'meeting_booked', 'dead') then
      raise exception 'Invalid lead status: %', p_status;
    end if;
  end if;

  -- Update the lead
  update public.leads
    set status = coalesce(p_status, status),
        last_contacted_at = now(),
        updated_at = now(),
        next_follow_up_at = p_follow_up_at
  where id = p_lead_id;

  -- Insert the call activity
  insert into public.lead_activities (
    lead_id,
    profile_id,
    activity_type,
    content,
    next_follow_up_at,
    call_log_id,
    created_at,
    updated_at
  ) values (
    p_lead_id,
    auth.uid(),
    'call',
    p_notes,
    p_follow_up_at,
    p_call_log_id,
    now(),
    now()
  );

  -- Update call_log duration if provided
  if p_call_log_id is not null and p_duration_seconds is not null then
    update public.call_logs
      set duration_seconds = p_duration_seconds
    where id = p_call_log_id;
  end if;
end;
$$;

-- ============================================================
-- Verification query (run after applying):
-- select schemaname, tablename, policyname, cmd, qual, with_check
-- from pg_policies where schemaname = 'public' order by tablename, policyname;
-- ============================================================
