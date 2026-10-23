-- ============================================================
-- Vexabots - RLS Policy Fixes for Security Hardening
-- REVIEW BEFORE RUNNING - this restricts data access
-- ============================================================

-- Helper function: check if current user is admin
-- Single source of truth for admin checks in policies
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
-- Members can only read leads assigned to them (or unassigned for claiming)
-- Admins can read all leads
create policy "leads_select" on public.leads for select
  using (
    public.is_admin()
    or assigned_to = auth.uid()
    or assigned_to is null  -- members can see unassigned leads to claim
  );

-- Members can insert only leads they own or unassigned (admin can insert all)
create policy "leads_insert" on public.leads for insert
  with check (
    public.is_admin()
    or auth.uid() in (
      select id from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Members can update only their own leads; admins can update any
create policy "leads_update" on public.leads for update
  using (
    public.is_admin()
    or assigned_to = auth.uid()
  );

-- Members can delete only their own; admins can delete any
create policy "leads_delete" on public.leads for delete
  using (
    public.is_admin()
    or assigned_to = auth.uid()
  );

-- ============================================================
-- lead_activities policies
-- ============================================================
create policy "lead_activities_select" on public.lead_activities for select
  using (
    public.is_admin()
    or profile_id = auth.uid()
    or (
      lead_id in (select id from public.leads where assigned_to = auth.uid())
    )
  );

create policy "lead_activities_insert" on public.lead_activities for insert
  with check (
    public.is_admin()
    or profile_id = auth.uid()
  );

create policy "lead_activities_update" on public.lead_activities for update
  using (
    public.is_admin()
    or profile_id = auth.uid()
  );

create policy "lead_activities_delete" on public.lead_activities for delete
  using (public.is_admin());

-- ============================================================
-- call_logs policies (replaces the "with check (true)")
-- ============================================================
create policy "call_logs_select" on public.call_logs for select
  using (
    public.is_admin()
    or caller_id = auth.uid()
  );

create policy "call_logs_insert" on public.call_logs for insert
  with check (
    public.is_admin()
    or caller_id = auth.uid()
  );

-- ============================================================
-- linkedin_leads policies (replaces the "using (true)")
-- ============================================================
-- Link linkedin_leads to leads via place_id
-- Members can read linkedin_leads for their leads only
create policy "linkedin_leads_select" on public.linkedin_leads for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.place_id = linkedin_leads.place_id
      and l.assigned_to = auth.uid()
    )
  );

create policy "linkedin_leads_insert" on public.linkedin_leads for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.place_id = linkedin_leads.place_id
      and l.assigned_to = auth.uid()
    )
  );

create policy "linkedin_leads_update" on public.linkedin_leads for update
  using (public.is_admin());

create policy "linkedin_leads_delete" on public.linkedin_leads for delete
  using (public.is_admin());

-- ============================================================
-- tech_stack policies (same logic as linkedin_leads)
-- ============================================================
create policy "tech_stack_select" on public.tech_stack for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.place_id = tech_stack.place_id
      and l.assigned_to = auth.uid()
    )
  );

create policy "tech_stack_insert" on public.tech_stack for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.place_id = tech_stack.place_id
      and l.assigned_to = auth.uid()
    )
  );

create policy "tech_stack_update" on public.tech_stack for update
  using (public.is_admin());

create policy "tech_stack_delete" on public.tech_stack for delete
  using (public.is_admin());

-- ============================================================
-- assignment_history policies (was readable by all authenticated)
-- ============================================================
create policy "assignment_history_select" on public.assignment_history for select
  using (
    public.is_admin()
    or assigned_to = auth.uid()
    or assigned_by = auth.uid()
  );

-- ============================================================
-- profiles policies
-- ============================================================
create policy "profiles_select" on public.profiles for select
  using (true);  -- profiles are shared directory info (names, roles)

create policy "profiles_update" on public.profiles for update
  using (
    public.is_admin()
    or auth.uid() = id  -- users can update their own profile
  );

create policy "profiles_insert" on public.profiles for insert
  with check (
    public.is_admin()
    or auth.uid() = id
  );

create policy "profiles_delete" on public.profiles for delete
  using (public.is_admin());
