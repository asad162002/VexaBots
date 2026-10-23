-- Vexabots Outreach Tool — Call Logs Table (for Telnyx integration)
-- Run this in Supabase SQL editor

create table if not exists public.call_logs (
  id              uuid primary key default gen_random_uuid(),
  call_id         text,                                -- Telnyx call ID (from /v2/calls)
  lead_id         uuid not null references public.leads(id) on delete cascade,
  caller_id       uuid not null references public.profiles(id),
  from_number     text not null,
  to_number       text not null,
  status          text not null default 'initiated'
                check (status in ('initiated', 'ringing', 'answered', 'busy', 'voicemail', 'no_answer', 'disconnected')),
  duration_seconds integer null,
  recorded_url    text null,
  recording_url   text null,                           -- legacy alias used by webhook
  started_at      timestamptz null,
  ended_at        timestamptz null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Add phone_number to profiles for caller numbers
alter table public.profiles
  add column if not exists phone_number text;

create policy "call_logs_select_own" on public.call_logs
  for select using (auth.uid() = caller_id);

create policy "call_logs_insert" on public.call_logs
  for insert with check (true);

create index call_logs_lead_id_idx on public.call_logs(lead_id);
create index call_logs_caller_id_idx on public.call_logs(caller_id);
create index call_logs_call_id_idx on public.call_logs(call_id);
create index call_logs_created_at_idx on public.call_logs(created_at);

create trigger set_updated_at_call_logs
  before update on public.call_logs
  for each row execute procedure public.handle_updated_at();
