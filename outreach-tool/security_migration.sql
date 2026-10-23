-- ============================================================
-- Vexabots - Security Hardening Migration
-- Review before running. This is NON-DESTRUCTIVE.
-- It fixes: call_logs schema, status constraint, RLS policies.
-- ============================================================

-- 1. Add missing columns to call_logs
ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS call_id text,
  ADD COLUMN IF NOT EXISTS recording_url text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

-- 2. Fix the status check constraint
-- Current constraint allows: initiated, ringing, answered, busy, voicemail, no_answer, disconnected
-- but webhook was writing 'completed' which fails.
-- Add 'completed' to the allowed values for backward compatibility
ALTER TABLE public.call_logs
  DROP CONSTRAINT IF EXISTS call_logs_status_check,
  ADD CONSTRAINT call_logs_status_check
  CHECK (status IN ('initiated', 'ringing', 'answered', 'busy', 'voicemail', 'no_answer', 'disconnected', 'completed'));

-- 3. Add phone_number to profiles if not already there
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_number text;

-- 4. Add is_admin() helper function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- 5. Enable RLS and apply policies for leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies first (for safe re-run)
DROP POLICY IF EXISTS "leads_select" ON public.leads;
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
DROP POLICY IF EXISTS "leads_update" ON public.leads;
DROP POLICY IF EXISTS "leads_delete" ON public.leads;

-- Members can select leads assigned to them or unassigned (for claiming)
CREATE POLICY "leads_select" ON public.leads FOR SELECT
  USING (
    public.is_admin()
    OR assigned_to = auth.uid()
    OR assigned_to IS NULL
  );

-- Admins can insert/update/delete all; members can update only their own
CREATE POLICY "leads_insert" ON public.leads FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR (assigned_to IS NULL OR assigned_to = auth.uid())
  );

CREATE POLICY "leads_update" ON public.leads FOR UPDATE
  USING (
    public.is_admin()
    OR assigned_to = auth.uid()
    OR assigned_to IS NULL
  );

CREATE POLICY "leads_delete" ON public.leads FOR DELETE
  USING (public.is_admin());

-- 6. Policies for lead_activities
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_activities_select" ON public.lead_activities;
DROP POLICY IF EXISTS "lead_activities_insert" ON public.lead_activities;
DROP POLICY IF EXISTS "lead_activities_update" ON public.lead_activities;
DROP POLICY IF EXISTS "lead_activities_delete" ON public.lead_activities;

CREATE POLICY "lead_activities_select" ON public.lead_activities FOR SELECT
  USING (
    public.is_admin()
    OR profile_id = auth.uid()
    OR lead_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid())
  );

CREATE POLICY "lead_activities_insert" ON public.lead_activities FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR profile_id = auth.uid()
  );

CREATE POLICY "lead_activities_update" ON public.lead_activities FOR UPDATE
  USING (
    public.is_admin()
    OR profile_id = auth.uid()
  );

CREATE POLICY "lead_activities_delete" ON public.lead_activities FOR DELETE
  USING (public.is_admin());

-- 7. Fix call_logs RLS (was: with check (true))
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "call_logs_select" ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_insert" ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_update" ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_delete" ON public.call_logs;
CREATE POLICY "call_logs_select" ON public.call_logs FOR SELECT
  USING (
    public.is_admin()
    OR caller_id = auth.uid()
  );
CREATE POLICY "call_logs_insert" ON public.call_logs FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR caller_id = auth.uid()
  );

CREATE POLICY "call_logs_update" ON public.call_logs FOR UPDATE
  USING (
    public.is_admin()
    OR caller_id = auth.uid()
  );

CREATE POLICY "call_logs_delete" ON public.call_logs FOR DELETE
  USING (public.is_admin());

-- 8. Fix linkedin_leads RLS (was: using (true))
DROP POLICY IF EXISTS "linkedin_leads_select_all" ON public.linkedin_leads;
DROP POLICY IF EXISTS "linkedin_leads_insert_all" ON public.linkedin_leads;
DROP POLICY IF EXISTS "linkedin_leads_update_all" ON public.linkedin_leads;
DROP POLICY IF EXISTS "linkedin_leads_delete_all" ON public.linkedin_leads;

CREATE POLICY "linkedin_leads_select" ON public.linkedin_leads FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.place_id = linkedin_leads.place_id
      AND l.assigned_to = auth.uid()
    )
  );

CREATE POLICY "linkedin_leads_insert" ON public.linkedin_leads FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.place_id = linkedin_leads.place_id
      AND l.assigned_to = auth.uid()
    )
  );

CREATE POLICY "linkedin_leads_update" ON public.linkedin_leads FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "linkedin_leads_delete" ON public.linkedin_leads FOR DELETE
  USING (public.is_admin());

-- 9. Fix tech_stack RLS (was: using (true))
DROP POLICY IF EXISTS "tech_stack_select_all" ON public.tech_stack;
DROP POLICY IF EXISTS "tech_stack_insert_all" ON public.tech_stack;
DROP POLICY IF EXISTS "tech_stack_update_all" ON public.tech_stack;
DROP POLICY IF EXISTS "tech_stack_delete_all" ON public.tech_stack;

CREATE POLICY "tech_stack_select" ON public.tech_stack FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.place_id = tech_stack.place_id
      AND l.assigned_to = auth.uid()
    )
  );

CREATE POLICY "tech_stack_insert" ON public.tech_stack FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.place_id = tech_stack.place_id
      AND l.assigned_to = auth.uid()
    )
  );

CREATE POLICY "tech_stack_update" ON public.tech_stack FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "tech_stack_delete" ON public.tech_stack FOR DELETE
  USING (public.is_admin());

-- 10. Fix assignment_history RLS (was: all authenticated could read)
DROP POLICY IF EXISTS "authenticated users can view assignment history" ON public.assignment_history;
DROP POLICY IF EXISTS "authenticated users can insert assignment history" ON public.assignment_history;

CREATE POLICY "assignment_history_select" ON public.assignment_history FOR SELECT
  USING (
    public.is_admin()
    OR assigned_to = auth.uid()
    OR assigned_by = auth.uid()
  );

CREATE POLICY "assignment_history_insert" ON public.assignment_history FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR assigned_to = auth.uid()
    OR assigned_by = auth.uid()
  );

CREATE POLICY "assignment_history_update" ON public.assignment_history FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "assignment_history_delete" ON public.assignment_history FOR DELETE
  USING (public.is_admin());

-- 11. Fix profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  USING (
    public.is_admin()
    OR auth.uid() = id
  );

CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR auth.uid() = id
  );

CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE
  USING (public.is_admin());
