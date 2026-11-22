-- Follow-up dates: make them symmetric, survivable, and visible.
--
-- Three things were wrong and all three are fixed here.
--
-- 1. `linkedin_leads` had no `next_follow_up_at` at all, so a follow-up date set on a
--    LinkedIn contact lived only on the activity row and could never be read back as a
--    due item. The column now exists on both lead tables.
-- 2. The function set `next_follow_up_at = p_follow_up_at` unconditionally, so saving any
--    outcome without a date silently erased a follow-up that was already scheduled. It now
--    uses `coalesce`, which means "no date given" leaves the existing one alone.
-- 3. There was no way to clear a date on purpose, which is what `clear_lead_follow_up` is.
--    Clearing is its own act, and it writes its own activity row, so the log shows it.
--
-- Applied to the live project on 2026-11-22. This file is committed so the repo and the
-- database agree: the seven argument `log_call_outcome` had been applied straight to the
-- database by an earlier session and existed in no migration, which meant a project built
-- from these files would have broken My Queue.

alter table public.linkedin_leads add column if not exists next_follow_up_at timestamptz;

create or replace function public.log_call_outcome(
  p_lead_id uuid,
  p_status text default null,
  p_notes text default null,
  p_follow_up_at timestamptz default null,
  p_call_log_id uuid default null,
  p_duration_seconds integer default null,
  p_lead_table text default 'leads'
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_lead_table not in ('leads', 'linkedin_leads') then
    raise exception 'Invalid lead table: %', p_lead_table;
  end if;

  if not (public.is_admin()
    or (
      exists (select 1 from public.leads l where l.id = p_lead_id and l.assigned_to = auth.uid())
      and (
        p_call_log_id is null
        or exists (select 1 from public.call_logs cl where cl.id = p_call_log_id and cl.caller_id = auth.uid() and cl.lead_id = p_lead_id)
      )
    )
    or (
      p_lead_table = 'linkedin_leads'
      and exists (select 1 from public.linkedin_leads l where l.id = p_lead_id and l.assigned_to = auth.uid())
    )
  ) then
    raise exception 'Unauthorized: you are not assigned to this lead';
  end if;

  if p_status is not null then
    if p_status not in ('new', 'contacted', 'interested', 'not_interested', 'send_info', 'meeting_booked', 'dead') then
      raise exception 'Invalid lead status: %', p_status;
    end if;
  end if;

  if p_lead_table = 'linkedin_leads' then
    update public.linkedin_leads
      set notes = coalesce(p_notes, notes),
          next_follow_up_at = coalesce(p_follow_up_at, next_follow_up_at),
          updated_at = now()
    where id = p_lead_id;
  else
    update public.leads
      set status = coalesce(p_status, status),
          last_contacted_at = now(),
          updated_at = now(),
          next_follow_up_at = coalesce(p_follow_up_at, next_follow_up_at)
    where id = p_lead_id;
  end if;

  insert into public.lead_activities (
    lead_id, profile_id, activity_type, content, next_follow_up_at, call_log_id, lead_table, created_at, updated_at
  ) values (
    p_lead_id, auth.uid(), 'call', p_notes, p_follow_up_at, p_call_log_id, p_lead_table, now(), now()
  );

  if p_call_log_id is not null and p_duration_seconds is not null then
    update public.call_logs set duration_seconds = p_duration_seconds where id = p_call_log_id;
  end if;
end;
$fn$;

create or replace function public.clear_lead_follow_up(
  p_lead_id uuid,
  p_lead_table text default 'leads'
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_lead_table not in ('leads', 'linkedin_leads') then
    raise exception 'Invalid lead table: %', p_lead_table;
  end if;

  if not (public.is_admin()
    or exists (select 1 from public.leads l where l.id = p_lead_id and l.assigned_to = auth.uid())
    or (p_lead_table = 'linkedin_leads' and exists (select 1 from public.linkedin_leads l where l.id = p_lead_id and l.assigned_to = auth.uid()))
  ) then
    raise exception 'Unauthorized: you are not assigned to this lead';
  end if;

  if p_lead_table = 'linkedin_leads' then
    update public.linkedin_leads set next_follow_up_at = null, updated_at = now() where id = p_lead_id;
  else
    update public.leads set next_follow_up_at = null, updated_at = now() where id = p_lead_id;
  end if;

  insert into public.lead_activities (lead_id, profile_id, activity_type, content, lead_table, created_at, updated_at)
  values (p_lead_id, auth.uid(), 'other', 'Follow-up date cleared', p_lead_table, now(), now());
end;
$fn$;

grant execute on function public.clear_lead_follow_up(uuid, text) to authenticated;
