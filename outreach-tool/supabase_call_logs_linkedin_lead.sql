-- call_logs.lead_id is a foreign key to leads(id), so writing the id of a contact
-- from linkedin_leads into it was refused by the database:
--   violates foreign key constraint "call_logs_lead_id_fkey"
-- The route turned that into a 500 and the dialer showed "Failed to log call", so
-- no call to a LinkedIn lead could start. Businesses and contacts now have a column
-- each, the same way assignment_history carries lead_id and linkedin_lead_id.
--
-- Applied to the project on 2026-11-21 through the Supabase MCP execute_sql tool.

alter table public.call_logs add column if not exists linkedin_lead_id uuid;

alter table public.call_logs drop constraint if exists call_logs_linkedin_lead_id_fkey;

-- Deleting a contact permanently removes its call logs, exactly as it does for a
-- business.
alter table public.call_logs
  add constraint call_logs_linkedin_lead_id_fkey
  foreign key (linkedin_lead_id) references public.linkedin_leads(id) on delete cascade;

create index if not exists call_logs_linkedin_lead_id_idx on public.call_logs (linkedin_lead_id);
