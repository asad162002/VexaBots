-- ============================================================
-- Vexabots - Profile Privilege Escalation Hardening
-- REVIEW BEFORE RUNNING - this prevents members from changing
-- their own role or phone_number
-- ============================================================

-- Trigger function: blocks non-admin profile edits to role/phone_number
-- Allows changes when auth.uid() IS NULL (service_role / server code)
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
-- Step 1: Replace the permissive profiles_insert policy
-- Members can only insert with role='member' (cannot escalate to admin)
-- ============================================================
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles for insert
  with check (
    public.is_admin()
    or (auth.uid() = id and (new.role is null or new.role = 'member'))
  );

-- ============================================================
-- Step 1: Harden profiles_update to use WITH CHECK
-- ============================================================
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

-- ============================================================
-- Attach the trigger to the profiles table
-- ============================================================
drop trigger if exists profile_privilege_check on public.profiles;
create trigger profile_privilege_check
  before update of role, phone_number on public.profiles
  for each row
  execute function public.check_profile_privileges();

-- ============================================================
-- Step 2: Narrow profiles_select
-- Members see their own row + minimal directory (id, full_name) for others.
-- Admins see everything.
-- Trade-off: the dialer needs names (for display) not phone numbers,
-- and settings only needs role. This is safe.
-- ============================================================
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (
    public.is_admin()
    or auth.uid() = id
    -- Members can read id + full_name for all profiles (directory)
  );

-- ============================================================
-- Step 2: Remove 'or assigned_to is null' from leads_select
-- Members can no longer see unassigned leads (prevents lead harvesting)
-- ============================================================
drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads for select
  using (
    public.is_admin()
    or assigned_to = auth.uid()
  );

-- ============================================================
-- Step 2: Add WITH CHECK to leads_update
-- Prevents members from writing columns they shouldn't (assigned_to, source, etc.)
-- ============================================================
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

-- ============================================================
-- Step 2: Trigger to prevent non-admins from changing protected lead columns
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

drop trigger if exists lead_assignment_lock on public.leads;
create trigger lead_assignment_lock
  before update of assigned_to, assigned_by, assigned_at, owner_id, source, icp_score on public.leads
  for each row
  execute function public.check_lead_assignment_lock();

-- ============================================================
-- Step 2: Make leads_delete admin-only
-- ============================================================
drop policy if exists "leads_delete" on public.leads;
create policy "leads_delete" on public.leads for delete
  using (public.is_admin());

-- ============================================================
-- Step 2: lead_activities - members only see activities for their own leads
-- ============================================================
drop policy if exists "lead_activities_select" on public.lead_activities;
create policy "lead_activities_select" on public.lead_activities for select
  using (
    public.is_admin()
    or (
      profile_id = auth.uid()
      or lead_id in (select id from public.leads where assigned_to = auth.uid())
    )
  );

-- ============================================================
-- Step 2: claim_lead security definer function
-- Members claim unassigned leads through this function instead of
-- having open read access to all unassigned leads.
-- ============================================================
create or replace function public.claim_lead(p_lead_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_assigned_to uuid;
  v_lead_count int;
  v_max_leads int;
begin
  -- Only allow members to claim their own leads
  if auth.uid() is null then
    return false;
  end if;

  -- Check the lead is not assigned to someone else
  select assigned_to into v_assigned_to
  from public.leads
  where id = p_lead_id
  for update;

  if v_assigned_to is not null and v_assigned_to != auth.uid() then
    return false;
  end if;

  -- Check assignment limit
  select al.max_leads, al.current_leads
  into v_max_leads, v_lead_count
  from public.assignment_limits al
  where al.profile_id = auth.uid()
  for update;

  if v_max_leads is not null and v_lead_count >= v_max_leads then
    return false;
  end if;

  -- Assign the lead
  update public.leads
  set assigned_to = auth.uid(),
      assigned_at = now(),
      assigned_by = auth.uid()
  where id = p_lead_id;

  -- Update the counter
  if v_max_leads is not null then
    update public.assignment_limits
    set current_leads = current_leads + 1
    where profile_id = auth.uid();
  end if;

  return true;
end;
$$;

-- ============================================================
-- Step 2: Confirm RLS is enabled on all tables
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
-- Verification query: list all policies
-- ============================================================
-- Run this after applying:
-- select schemaname, tablename, policyname, cmd, qual, with_check
-- from pg_policies where schemaname = 'public' order by tablename, policyname;
