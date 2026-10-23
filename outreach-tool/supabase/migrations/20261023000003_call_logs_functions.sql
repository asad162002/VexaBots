-- ============================================================
-- Vexabots - Call Logs Schema + Function Fixes
-- Aligns call_logs.status values between DB constraint and code
-- Adds log_call_outcome function for atomic outcome saves
-- REVIEW BEFORE RUNNING
-- ============================================================

-- ============================================================
-- Fix call_logs.status constraint to include all values the code uses
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
-- Add call_log_id column to lead_activities (if not already present)
-- This links a call outcome to its call log
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'lead_activities'
    and column_name = 'call_log_id'
  ) then
    alter table public.lead_activities
      add column call_log_id uuid references public.call_logs(id);
  end if;
end $$;

-- ============================================================
-- Security-definer function: log call outcome atomically
-- Checks that the caller is assigned to the lead
-- Updates lead status + inserts activity in one transaction
-- ============================================================
create or replace function public.log_call_outcome(
  p_lead_id uuid,
  p_outcome_status public.lead_status,
  p_notes text default null,
  p_follow_up_at timestamptz default null,
  p_call_log_id uuid default null,
  p_duration_seconds integer default null
)
returns void
language plpgsql
security definer
as $$
begin
  -- Verify the caller is authorized: admin or assigned to the lead
  if not (public.is_admin() or exists (
    select 1 from public.leads l
    where l.id = p_lead_id
    and l.assigned_to = auth.uid()
  )) then
    raise exception 'Unauthorized: you are not assigned to this lead';
  end if;

  -- Update the lead
  update public.leads
    set status = p_outcome_status,
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
-- Verification: check policy coverage
-- ============================================================
-- select schemaname, tablename, policyname, cmd, qual, with_check
-- from pg_policies where schemaname = 'public' order by tablename, policyname;
