-- ============================================================
-- Vexabots - Add telnyx_credential_id to profiles
-- Maps each member to their Telnyx credential connection
-- ============================================================

alter table public.profiles
  add column if not exists telnyx_credential_id text;

-- Verification:
-- select column_name, is_nullable, data_type
-- from information_schema.columns
-- where table_name = 'profiles' and column_name = 'telnyx_credential_id';
