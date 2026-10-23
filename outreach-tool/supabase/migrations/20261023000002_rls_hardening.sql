-- ============================================================
-- Vexabots - RLS Policy Hardening (Idempotent Rewrite)
-- REVIEW BEFORE RUNNING - this RESTRICTS data access
--
-- This file is idempotent: it drops + recreates every policy.
-- Apply AFTER 20261023000000_profiles_hardening.sql
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
-- leads policies
-- ============================================================

-- Members can only read leads assigned to them (NO more 'or assigned_to is null')
-- Admins can read all leads
drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads for select
  using (
    public.is_admin()
    or assigned_to = auth.uid()
  );

-- Members can insert only leads they own (admin can insert all)
drop policy if exists "leads_insert" on public.leads;
create policy "leads_insert" on public.leads for insert
  with check (
    public.is_admin()
    or auth.uid() = owner_id
  );

-- Members can update only their own leads (WITH CHECK added)
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

-- Members CANNOT delete leads — admin only
drop policy if exists "leads_delete" on public.leads;
create policy "leads_delete" on public.leads for delete
  using (public.is_admin());

-- ============================================================
-- lead_activities policies
-- ============================================================
-- Members may only select and insert rows where:
--   profile_id = auth.uid() OR lead_id belongs to a lead assigned to them
-- ============================================================
drop policy if exists "lead_activities_select" on public.lead_activities;
create policy "lead_activities_select" on public.lead_activities for select
  using (
    public.is_admin()
    or profile_id = auth.uid()
    or (
      lead_id in (select id from public.leads where assigned_to = auth.uid())
    )
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
-- call_logs policies (was: with check (true) — FIXED)
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
-- profiles policies
-- Members can read id, full_name of all profiles (directory).
-- Only admins or the user themselves can change role/phone_number;
-- the BEFORE UPDATE trigger enforces this at the row level.
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
    or (auth.uid() = id and (new.role is null or new.role = 'member'))
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
