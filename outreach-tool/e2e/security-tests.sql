-- ============================================================
-- SQL-level security tests for RLS policies
-- Run these against the database AFTER applying the migration:
--   supabase/migrations/20261023000000_profiles_hardening.sql
--
-- To test as a specific member, set the auth.uid() context:
-- SET LOCAL "request.auth.uid" = 'member-uuid-here';
--
-- For admin tests:
-- SET LOCAL "request.auth.uid" = 'admin-uuid-here';
-- ============================================================

-- ============================================================
-- Test 1: Member cannot change their own role to admin
-- Expected: exception "Unauthorized: only admins can modify the role column"
-- ============================================================
-- SET LOCAL "request.auth.uid" = '2a447186-9d5a-47d4-b1f6-e2e7a9a76508'; -- asadisdying007
-- update public.profiles set role = 'admin' where id = auth.uid();
-- Expected error: "Unauthorized: only admins can modify the role column"

-- ============================================================
-- Test 2: Member cannot change their own phone_number
-- ============================================================
-- update public.profiles set phone_number = '+15551234567' where id = auth.uid();
-- Expected error: "Unauthorized: only admins can modify the phone_number column"

-- ============================================================
-- Test 3: Member can only read their own leads (not others')
-- ============================================================
-- As a member:
-- SET LOCAL "request.auth.uid" = '2a447186-9d5a-47d4-b1f6-e2e7a9a76508';
-- select count(*) from public.leads;
-- Expected: only leads assigned to this member (or 0)

-- As admin:
-- SET LOCAL "request.auth.uid" = 'd16e3d8a-6f42-4e3a-a3d8-5e2e9e0a3c7a'; -- asad@vexabots.com
-- select count(*) from public.leads;
-- Expected: ALL leads

-- ============================================================
-- Test 4: Member cannot delete any lead
-- ============================================================
-- delete from public.leads where id = '<some_lead_id>';
-- Expected error: "0 rows" (policy blocks the operation)

-- ============================================================
-- Test 5: Member cannot reassign a lead
-- ============================================================
-- update public.leads set assigned_to = '<other_user_id>' where assigned_to = auth.uid();
-- Expected: 0 rows affected (WITH CHECK blocks it, AND trigger raises exception)

-- ============================================================
-- Test 6: Member cannot insert a profile with role='admin'
-- ============================================================
-- insert into public.profiles (id, email, role) values ('test-id', 'test@test.com', 'admin');
-- Expected: exception (profiles_insert WITH CHECK requires role = 'member' or admin)

-- ============================================================
-- Test 7: Verify no policies with USING (true) remain
-- ============================================================
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (qual = 'true' or with_check = 'true')
  and cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL');
-- Expected: 0 rows

-- ============================================================
-- Test 8: Verify RLS is enabled on ALL tables
-- ============================================================
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relkind = 'r' and relnamespace = 'public'::regnamespace
  and relrowsecurity = false;
-- Expected: 0 rows (all tables should have RLS enabled)

-- ============================================================
-- Test 9: Verify call_logs status constraint matches code
-- ============================================================
-- Run this BEFORE the constraint is added (or to verify it):
-- select pg_get_constraintdef(oid) as definition
-- from pg_constraint
-- where conrelid = 'public.call_logs'::regclass
--   and contype = 'c';
-- Expected: CHECK (status in ('initiated', 'ringing', 'answered', 'busy', 'voicemail', 'no_answer', 'disconnected'))

-- ============================================================
-- Test 10: Member cannot read another member's call_logs or activities
-- ============================================================
-- As a member:
-- select * from public.call_logs where caller_id != auth.uid();
-- Expected: 0 rows
-- select * from public.lead_activities where profile_id != auth.uid();
-- Expected: 0 rows (unless activity is for a lead they own)

-- ============================================================
-- Test 11: log_call_outcome — member cannot log outcome for
-- a lead they don't own (even with a valid call_log_id)
-- ============================================================
-- As a member:
-- SET LOCAL "request.auth.uid" = '2a447186-9d5a-47d4-b1f6-e2e7a9a76508';
-- select public.log_call_outcome(
--   p_lead_id := '<lead_id_not_assigned_to_you>',
--   p_status := 'contacted',
--   p_notes := 'test',
--   p_call_log_id := '<your_own_call_log_id>'
-- );
-- Expected: exception "Unauthorized: you are not assigned to this lead"
-- (call-log ownership alone does NOT authorize)

-- ============================================================
-- Test 12: log_call_outcome — member CAN log outcome for
-- their own lead with their own call_log_id
-- ============================================================
-- As a member:
-- SET LOCAL "request.auth.uid" = '2a447186-9d5a-47d4-b1f6-e2e7a9a76508';
-- select public.log_call_outcome(
--   p_lead_id := '<your_lead_id>',
--   p_status := 'interested',
--   p_notes := 'interested in product',
--   p_call_log_id := '<your_call_log_id_for_that_lead>'
-- );
-- Expected: success (no error)

-- ============================================================
-- Test 13: log_call_outcome — invalid status rejected
-- ============================================================
-- As admin:
-- SET LOCAL "request.auth.uid" = 'd16e3d8a-6f42-4e3a-a3d8-5e2e9e0a3c7a';
-- select public.log_call_outcome(
--   p_lead_id := '<any_lead_id>',
--   p_status := 'dnc'
-- );
-- Expected: exception "Invalid lead status: dnc"
-- (dnc is NOT in the LeadStatus enum)

-- ============================================================
-- Test 14: log_call_outcome — valid LeadStatus values accepted
-- ============================================================
-- As admin, test each status:
-- SET LOCAL "request.auth.uid" = 'd16e3d8a-6f42-4e3a-a3d8-5e2e9e0a3c7a';
-- For each of: 'new', 'contacted', 'interested', 'not_interested',
--   'send_info', 'meeting_booked', 'dead':
-- select public.log_call_outcome(p_lead_id := '<lead_id>', p_status := '<status>');
-- Expected: success for each

-- ============================================================
-- Test 15: log_call_outcome — call_log_id must match lead_id
-- ============================================================
-- As a member:
-- SET LOCAL "request.auth.uid" = '2a447186-9d5a-47d4-b1f6-e2e7a9a76508';
-- select public.log_call_outcome(
--   p_lead_id := '<your_lead_id>',
--   p_status := 'interested',
--   p_call_log_id := '<call_log_id_for_DIFFERENT_lead>'
-- );
-- Expected: exception "Unauthorized: you are not assigned to this lead"
-- (call_log.lead_id != p_lead_id, so the call-log ownership check fails too)
