-- ============================================================
-- Helper: verify all RLS policies are in place
-- Run this after applying the migration to check state
-- ============================================================

-- Check RLS is enabled on all tables
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relkind = 'r' and relnamespace = 'public'::regnamespace
order by relname;

-- List all policies
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Check the trigger exists on profiles
select
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgtype,
  tgenabled
from pg_trigger
where tgname = 'profile_privilege_check'
or tgname = 'lead_assignment_lock';

-- Find any tables without RLS
select relname
from pg_class
where relkind = 'r'
  and relnamespace = 'public'::regnamespace
  and relrowsecurity = false;

-- Find any policies with USING (true) or WITH CHECK (true) — danger zone
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (qual = 'true' or with_check = 'true')
  and cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL')
order by tablename, policyname;
