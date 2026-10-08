-- ============================================================
-- Vexabots - Additional Tables for LinkedIn/Apollo Enrichment
-- Run this in Supabase SQL Editor after your main schema
-- ============================================================

-- Table for LinkedIn/Apollo enriched leads (for your direct outreach)
create table if not exists public.linkedin_leads (
  id              uuid        primary key default gen_random_uuid(),
  place_id        text        not null,
  lead_name       text        null,
  title           text        null,
  email           text        null,
  email_status    text        null check (email_status in ('verified', 'not_found', 'pending')),
  linkedin_url    text        null,
  source          text        null,  -- 'linkedin_owner_search', 'apollo_enrichment'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (place_id, lead_name, linkedin_url)
);

-- Indexes for LinkedIn leads
create index if not exists linkedin_leads_place_id_idx on public.linkedin_leads(place_id);
create index if not exists linkedin_leads_email_idx on public.linkedin_leads(email);
create index if not exists linkedin_leads_linkedin_url_idx on public.linkedin_leads(linkedin_url);
create index if not exists linkedin_leads_source_idx on public.linkedin_leads(source);

-- Table for tech stack data
create table if not exists public.tech_stack (
  id              uuid        primary key default gen_random_uuid(),
  place_id        text        not null unique,
  running_google_ads boolean    default false,
  running_fb_ads    boolean    default false,
  tech_stack       text        null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Trigger for updated_at on linkedin_leads
create trigger if not exists set_updated_at_linkedin_leads
  before update on public.linkedin_leads
  for each row execute procedure public.handle_updated_at();

-- Trigger for updated_at on tech_stack
create trigger if not exists set_updated_at_tech_stack
  before update on public.tech_stack
  for each row execute procedure public.handle_updated_at();

-- RLS for linkedin_leads
alter table public.linkedin_leads enable row level security;
create policy "linkedin_leads_select_all" on public.linkedin_leads for select using (true);
create policy "linkedin_leads_insert_all" on public.linkedin_leads for insert with check (true);
create policy "linkedin_leads_update_all" on public.linkedin_leads for update using (true);
create policy "linkedin_leads_delete_all" on public.linkedin_leads for delete using (true);

-- RLS for tech_stack
alter table public.tech_stack enable row level security;
create policy "tech_stack_select_all" on public.tech_stack for select using (true);
create policy "tech_stack_insert_all" on public.tech_stack for insert with check (true);
create policy "tech_stack_update_all" on public.tech_stack for update using (true);
create policy "tech_stack_delete_all" on public.tech_stack for delete using (true);
