-- Inbound callback support.
--
-- Why each piece exists:
--   1. direction    call_logs could not tell an inbound call from an outbound one.
--   2. caller_id    was NOT NULL, but an inbound call has no rep who placed it.
--   3. status check forbade 'failed', which the stale-request guard in startCall
--                   writes, so that UPDATE was being rejected by the database.
--   4. index        the webhook looks rows up by telnyx_call_control_id on every
--                   event, and there was no index on it.
--   5. phone_digits stored numbers are formatted ("+1 916-482-1205"), so matching an
--                   inbound caller against them needs the digits in a column.
--
-- Applied through the Supabase MCP execute_sql tool on 2026-11-22.

alter table public.call_logs
  add column if not exists direction text not null default 'outbound';

alter table public.call_logs drop constraint if exists call_logs_direction_check;
alter table public.call_logs
  add constraint call_logs_direction_check check (direction in ('inbound', 'outbound'));

alter table public.call_logs alter column caller_id drop not null;

-- The two status checks had drifted apart. One check now covers every value both of
-- them allowed, plus 'failed'.
alter table public.call_logs drop constraint if exists call_logs_status_check;
alter table public.call_logs drop constraint if exists call_status_check;
alter table public.call_logs
  add constraint call_logs_status_check check (status in (
    'initiated', 'ringing', 'in-call', 'answered', 'busy',
    'voicemail', 'no_answer', 'disconnected', 'completed', 'failed'
  ));

create index if not exists call_logs_telnyx_cci_idx on public.call_logs (telnyx_call_control_id);

alter table public.leads
  add column if not exists phone_digits text
  generated always as (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) stored;

create index if not exists leads_phone_digits_idx on public.leads (phone_digits);

alter table public.linkedin_leads
  add column if not exists phone_digits text
  generated always as (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) stored;

create index if not exists linkedin_leads_phone_digits_idx on public.linkedin_leads (phone_digits);

-- An inbound callback is not an action taken by a rep, so the activity row that
-- records it has no profile to attribute it to: profile_id must allow null. The
-- feed groups by profile, and a null group shows as Unknown to admins, while a
-- member only sees the rows attributed to them, which is why the inbound activity is
-- written against the lead's owner when the caller matched a lead.
alter table public.lead_activities alter column profile_id drop not null;
