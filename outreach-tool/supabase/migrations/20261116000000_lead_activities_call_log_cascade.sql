-- Migration: Fix permanent lead deletion blocked by lead_activities.call_log_id
--
-- Deleting a lead cascades to call_logs (call_logs.lead_id ON DELETE CASCADE).
-- lead_activities.call_log_id referenced call_logs with NO ACTION, so Postgres
-- refused to remove the call_logs rows while an activity still pointed at them:
--
--   update or delete on table "call_logs" violates foreign key constraint
--   "lead_activities_call_log_id_fkey" on table "lead_activities"
--
-- The link between an activity and its call log is provenance, not ownership.
-- When a call log goes away its parent activity should go with it, which is what
-- every other child of leads and call_logs already does.

alter table public.lead_activities
  drop constraint if exists lead_activities_call_log_id_fkey;

alter table public.lead_activities
  add constraint lead_activities_call_log_id_fkey
  foreign key (call_log_id)
  references public.call_logs(id)
  on delete cascade;
