-- Assignment history table for audit trail
-- Tracks every assignment change (not just current state)
CREATE TABLE IF NOT EXISTS public.assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  previous_assignee UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_assignment_history_lead_id ON public.assignment_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_assignment_history_assigned_by ON public.assignment_history(assigned_by);
CREATE INDEX IF NOT EXISTS idx_assignment_history_assigned_at ON public.assignment_history(assigned_at DESC);

-- RLS policies for assignment_history
-- Only authenticated users can read
ALTER TABLE public.assignment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can view assignment history"
  ON public.assignment_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated users can insert assignment history"
  ON public.assignment_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Per-member assignment limit table
CREATE TABLE IF NOT EXISTS public.assignment_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_leads INTEGER NOT NULL DEFAULT 0,
  current_leads INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(profile_id)
);

ALTER TABLE public.assignment_limits ENABLE ROW LEVEL SECURITY;

-- Admins can read/write all limits, members can only read their own
CREATE POLICY "admins can manage assignment limits"
  ON public.assignment_limits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "members can view their own limit"
  ON public.assignment_limits FOR SELECT
  USING (profile_id = auth.uid());
