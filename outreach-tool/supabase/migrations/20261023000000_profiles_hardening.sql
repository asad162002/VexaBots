-- ============================================================
-- Vexabots - Security Hardening (Idempotent, Merged)
-- REVIEW BEFORE RUNNING - this RESTRICTS data access
--
-- This is the single merged migration that:
--   1. Hardens profiles against privilege escalation (trigger + policies)
--   2. Rewrites all RLS policies with DROP IF EXISTS + recreate
--   3. Adds lead_assignment_lock trigger for protected lead columns
--   4. Adds claim_lead() function with max_leads=0 = unlimited
--   5. Adds is_admin() and check_profile_privileges() helper functions
--   6. Confirms RLS is enabled on all tables
--
-- Idempotent: safe to run multiple times.
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
-- Run this query manually to see what's at risk before the
-- ALTER TABLE below takes effect:
--
-- select id, status from public.call_logs
-- where status not in (
--   'initiated', 'ringing', 'answered', 'busy',
--   'voicemail', 'no_answer', 'disconnected'
-- );
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
  -- Other columns (full_name, avatar_url, etc.) can still be self-edited

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
-- lead columns (assigned_to, source, owner_id, icp_score, etc.)
-- ============================================================
create or replace function public.check_lead_assignment_lock()
returns trigger
language plpgsql
as $$
begin
  -- Allow service_role / server-side code
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
-- Attach triggers to tables (idempotent: drop before create)
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
-- profiles policies
-- Members can select their own profile (id, full_name) for directory.
-- Members can INSERT only with role = 'member' (NOT NEW.role — column ref).
-- Members can UPDATE only their own row.
-- ============================================================
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (
    public.is_admin()
    or auth.uid() = id
  );

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles for insert
  with check (
    public.is_admin()
    or (auth.uid() = id and role = 'member')
  );

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update
  using (
    public.is_admin()
    or auth.uid() = id
  )
  with check (
    public.is_admin()
    or auth.uid() = id
  );

drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete" on public.profiles for delete
  using (public.is_admin());

-- ============================================================
-- leads policies
-- Members can only see leads assigned to them (NO "or assigned_to is null").
-- Members can update only their own leads (WITH CHECK added).
-- Members CANNOT delete — admin only.
-- ============================================================
drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads for select
  using (
    public.is_admin()
    or assigned_to = auth.uid()
  );

drop policy if exists "leads_insert" on public.leads;
create policy "leads_insert" on public.leads for insert
  with check (
    public.is_admin()
    or auth.uid() = owner_id
  );

drop policy if exists "leads_update" on public.leads;
create policy "leads_update" on public.leads for update
  using (
    public.is_admin()
    or assigned_to = auth.uid()
  )
  with check (
    public.is_admin()
    or assigned_to = auth.uid()
  );

drop policy if exists "leads_delete" on public.leads;
create policy "leads_delete" on public.leads for delete
  using (public.is_admin());

-- ============================================================
-- lead_activities policies
-- Members only see activities for their own leads or self-authored.
-- ============================================================
drop policy if exists "lead_activities_select" on public.lead_activities;
create policy "lead_activities_select" on public.lead_activities for select
  using (
    public.is_admin()
    or profile_id = auth.uid()
    or lead_id in (select id from public.leads where assigned_to = auth.uid())
  );

drop policy if exists "lead_activities_insert" on public.lead_activities;
create policy "lead_activities_insert" on public.lead_activities for insert
  with check (
    public.is_admin()
    or profile_id = auth.uid()
  );

drop policy if exists "lead_activities_update" on public.lead_activities;
create policy "lead_activities_update" on public.lead_activities for update
  using (
    public.is_admin()
    or profile_id = auth.uid()
  );

drop policy if exists "lead_activities_delete" on public.lead_activities;
create policy "lead_activities_delete" on public.lead_activities for delete
  using (public.is_admin());

-- ============================================================
-- call_logs policies
-- Members only see/insert their own call logs (caller_id = auth.uid()).
-- Only admins can update or delete call logs.
-- ============================================================
drop policy if exists "call_logs_select" on public.call_logs;
create policy "call_logs_select" on public.call_logs for select
  using (
    public.is_admin()
    or caller_id = auth.uid()
  );

drop policy if exists "call_logs_insert" on public.call_logs;
create policy "call_logs_insert" on public.call_logs for insert
  with check (
    public.is_admin()
    or caller_id = auth.uid()
  );

drop policy if exists "call_logs_update" on public.call_logs;
create policy "call_logs_update" on public.call_logs for update
  using (public.is_admin());

drop policy if exists "call_logs_delete" on public.call_logs;
create policy "call_logs_delete" on public.call_logs for delete
  using (public.is_admin());

-- ============================================================
-- linkedin_leads policies
-- Members can access linkedin leads for their own assigned leads.
-- ============================================================
drop policy if exists "linkedin_leads_select" on public.linkedin_leads;
create policy "linkedin_leads_select" on public.linkedin_leads for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.place_id = linkedin_leads.place_id
      and l.assigned_to = auth.uid()
    )
  );

drop policy if exists "linkedin_leads_insert" on public.linkedin_leads;
create policy "linkedin_leads_insert" on public.linkedin_leads for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.place_id = linkedin_leads.place_id
      and l.assigned_to = auth.uid()
    )
  );

drop policy if exists "linkedin_leads_update" on public.linkedin_leads;
create policy "linkedin_leads_update" on public.linkedin_leads for update
  using (public.is_admin());

drop policy if exists "linkedin_leads_delete" on public.linkedin_leads;
create policy "linkedin_leads_delete" on public.linkedin_leads for delete
  using (public.is_admin());

-- ============================================================
-- tech_stack policies
-- ============================================================
drop policy if exists "tech_stack_select" on public.tech_stack;
create policy "tech_stack_select" on public.tech_stack for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.place_id = tech_stack.place_id
      and l.assigned_to = auth.uid()
    )
  );

drop policy if exists "tech_stack_insert" on public.tech_stack;
create policy "tech_stack_insert" on public.tech_stack for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.place_id = tech_stack.place_id
      and l.assigned_to = auth.uid()
    )
  );

drop policy if exists "tech_stack_update" on public.tech_stack;
create policy "tech_stack_update" on public.tech_stack for update
  using (public.is_admin());

drop policy if exists "tech_stack_delete" on public.tech_stack;
create policy "tech_stack_delete" on public.tech_stack for delete
  using (public.is_admin());

-- ============================================================
-- assignment_history policies
-- ============================================================
drop policy if exists "assignment_history_select" on public.assignment_history;
create policy "assignment_history_select" on public.assignment_history for select
  using (
    public.is_admin()
    or assigned_to = auth.uid()
    or assigned_by = auth.uid()
  );

drop policy if exists "assignment_history_insert" on public.assignment_history;
create policy "assignment_history_insert" on public.assignment_history for insert
  with check (public.is_admin());

drop policy if exists "assignment_history_update" on public.assignment_history;
create policy "assignment_history_update" on public.assignment_history for update
  using (public.is_admin());

drop policy if exists "assignment_history_delete" on public.assignment_history;
create policy "assignment_history_delete" on public.assignment_history for delete
  using (public.is_admin());

-- ============================================================
-- assignment_limits policies
-- ============================================================
drop policy if exists "assignment_limits_select" on public.assignment_limits;
create policy "assignment_limits_select" on public.assignment_limits for select
  using (
    public.is_admin()
    or profile_id = auth.uid()
  );

drop policy if exists "assignment_limits_insert" on public.assignment_limits;
create policy "assignment_limits_insert" on public.assignment_limits for insert
  with check (public.is_admin());

drop policy if exists "assignment_limits_update" on public.assignment_limits;
create policy "assignment_limits_update" on public.assignment_limits for update
  using (public.is_admin());

drop policy if exists "assignment_limits_delete" on public.assignment_limits;
create policy "assignment_limits_delete" on public.assignment_limits for delete
  using (public.is_admin());

-- ============================================================
-- lead_status_history policies
-- ============================================================
drop policy if exists "lead_status_history_select" on public.lead_status_history;
create policy "lead_status_history_select" on public.lead_status_history for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = lead_status_history.lead_id
      and l.assigned_to = auth.uid()
    )
  );

drop policy if exists "lead_status_history_insert" on public.lead_status_history;
create policy "lead_status_history_insert" on public.lead_status_history for insert
  with check (
    public.is_admin()
    or profile_id = auth.uid()
  );

-- ============================================================
-- claim_lead: security definer function
-- Members claim unassigned leads through this function.
-- max_leads = 0 means UNLIMITED (no cap).
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
  -- Only callers with a user context can claim
  if auth.uid() is null then
    return false;
  end if;

  -- Check the lead exists and is not assigned to someone else
  select assigned_to into v_assigned_to
  from public.leads
  where id = p_lead_id
  for update;

  if v_assigned_to is not null and v_assigned_to != auth.uid() then
    return false;
  end if;

  -- Check assignment limit (0 = unlimited)
  select al.max_leads, al.current_leads
  into v_max_leads, v_lead_count
  from public.assignment_limits al
  where al.profile_id = auth.uid()
  for update;

  -- max_leads = 0 means unlimited; otherwise enforce the cap
  if v_max_leads is not null and v_max_leads > 0 and v_lead_count >= v_max_leads then
    return false;
  end if;

  -- Assign the lead
  update public.leads
  set assigned_to = auth.uid(),
      assigned_at = now(),
      assigned_by = auth.uid()
  where id = p_lead_id;

  -- Update the counter (only when there is a finite cap)
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
-- Atomically updates lead status + inserts activity.
-- Verifies the caller is assigned to the lead OR owns the call log.
-- p_status is text (validated against the allowed enum values).
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
  -- Verify the caller is authorized:
  -- admin, OR assigned to the lead, OR owns the call log
  if not (public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = p_lead_id
      and l.assigned_to = auth.uid()
    )
    or (p_call_log_id is not null
      and exists (
        select 1 from public.call_logs cl
        where cl.id = p_call_log_id
        and cl.caller_id = auth.uid()
      )
    )
  ) then
    raise exception 'Unauthorized: you are not assigned to this lead or call log';
  end if;

  -- Validate status against the allowed enum if provided
  if p_status is not null then
    if p_status not in ('new', 'contacted', 'interested', 'not_interested', 'meeting_booked', 'dnc') then
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

  -- If the lead was unassigned, assign it to the caller
  update public.leads
    set assigned_to = auth.uid(),
        assigned_at = now(),
        assigned_by = auth.uid()
  where id = p_lead_id
    and assigned_to is null;
end;
$$;

-- ============================================================
-- Enable RLS on ALL tables
-- ============================================================
alter table if exists public.leads enable row level security;
alter table if exists public.lead_activities enable row level security;
alter table if exists public.call_logs enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.linkedin_leads enable row level security;
alter table if exists public.tech_stack enable row level security;
alter table if exists public.assignment_history enable row level security;
alter table if exists public.assignment_limits enable row level security;
alter table if exists public.lead_status_history enable row level security;

-- ============================================================
-- Verification query (run after applying):
-- select schemaname, tablename, policyname, cmd, qual, with_check
-- from pg_policies where schemaname = 'public' order by tablename, policyname;
-- ============================================================
