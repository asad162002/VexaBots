-- A person is identified by their LinkedIn profile, not by the business they work
-- at. The table previously carried a unique constraint on
-- (place_id, lead_name, linkedin_url), which no upsert in the app targeted: the
-- import code asked for ON CONFLICT (place_id), Postgres answered 42P10 "there is
-- no unique or exclusion constraint matching the ON CONFLICT specification", and
-- every enrichment row was silently dropped.
--
-- The key is now the profile slug, so several people at one company can be stored
-- and re-importing a file updates rather than duplicates them.
--
-- Applied to the project on 2026-11-21 through the Supabase MCP execute_sql tool.

alter table public.linkedin_leads add column if not exists linkedin_username text;

-- place_id is only the company a person works at, and a contact list may not carry
-- one at all, so it is no longer required.
alter table public.linkedin_leads alter column place_id drop not null;

-- Backfill from any existing profile URL: linkedin.com/in/<slug>
update public.linkedin_leads
   set linkedin_username = lower((regexp_match(linkedin_url, '/in/([^/?#]+)'))[1])
 where linkedin_url is not null and linkedin_username is null;

-- The old constraint, dropped by name because it backs a constraint rather than a
-- plain index.
alter table public.linkedin_leads drop constraint if exists linkedin_leads_place_id_lead_name_linkedin_url_key;

create unique index if not exists linkedin_leads_linkedin_username_key
  on public.linkedin_leads (linkedin_username);
