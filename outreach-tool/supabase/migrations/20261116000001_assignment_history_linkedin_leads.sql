-- Migration: assignment history must accept LinkedIn contacts.
--
-- assignment_history.lead_id is FOREIGN KEY ... REFERENCES leads(id), so a
-- LinkedIn contact id was rejected outright:
--
--   insert or update on table "assignment_history" violates foreign key
--   constraint "assignment_history_lead_id_fkey"
--
-- The log has to cover both tables, because assignments happen on both pages.
-- Adding a second nullable column rather than dropping the FK keeps every
-- existing row valid and keeps ON DELETE CASCADE for Google Maps leads.

alter table public.assignment_history
  add column if not exists linkedin_lead_id uuid;

-- lead_id is NOT NULL, so a LinkedIn row cannot leave it null. Dropping the
-- constraint lets exactly-one-of-the-two hold; the FK still validates any
-- non-null value against leads(id).
alter table public.assignment_history
  alter column lead_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assignment_history_linkedin_lead_id_fkey'
  ) then
    alter table public.assignment_history
      add constraint assignment_history_linkedin_lead_id_fkey
      foreign key (linkedin_lead_id)
      references public.linkedin_leads(id)
      on delete cascade;
  end if;
end $$;

-- Each history row describes exactly one lead, whichever table it came from.
alter table public.assignment_history
  drop constraint if exists assignment_history_one_lead_check;

alter table public.assignment_history
  add constraint assignment_history_one_lead_check
  check (
    (lead_id is not null)::int + (linkedin_lead_id is not null)::int = 1
  );

-- Same treatment for assignment_log, which shares the schema and would fail
-- identically once anything writes to it.
alter table public.assignment_log
  add column if not exists linkedin_lead_id uuid;

alter table public.assignment_log
  alter column lead_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assignment_log_linkedin_lead_id_fkey'
  ) then
    alter table public.assignment_log
      add constraint assignment_log_linkedin_lead_id_fkey
      foreign key (linkedin_lead_id)
      references public.linkedin_leads(id)
      on delete cascade;
  end if;
end $$;

alter table public.assignment_log
  drop constraint if exists assignment_log_one_lead_check;

alter table public.assignment_log
  add constraint assignment_log_one_lead_check
  check (
    (lead_id is not null)::int + (linkedin_lead_id is not null)::int = 1
  );
