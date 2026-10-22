-- Team Members table for dialer routing
-- Each team member gets a dedicated US phone number (assigned via Telnyx)

CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  call_recording_uri TEXT,
  status TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'paused', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_team_members_phone ON public.team_members(phone_number);
CREATE INDEX idx_team_members_status ON public.team_members(status);
CREATE INDEX idx_team_members_email ON public.team_members(email);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_read" ON public.team_members
  FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "team_members_insert" ON public.team_members
  FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "team_members_update" ON public.team_members
  FOR UPDATE USING (auth.uid() = profile_id);

-- RLS policy for call_logs (any authenticated user can see call logs)
CREATE POLICY "call_logs_select_own" ON public.call_logs
  FOR SELECT USING (auth.uid() = caller_id);

CREATE POLICY "call_logs_insert" ON public.call_logs
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_call_logs_lead_id ON public.call_logs(lead_id);
CREATE INDEX idx_call_logs_caller_id ON public.call_logs(caller_id);
CREATE INDEX idx_call_logs_created_at ON public.call_logs(created_at);

CREATE TRIGGER set_updated_at_team_members
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
