-- ============================================================
-- SQL-level security tests for RLS policies
-- Run these against the database AFTER applying the migrations.
--
-- To test as a specific member, set the auth.uid() to their ID:
-- SET LOCAL "request.auth.uid" = 'member-uuid-here';
--
-- For admin tests:
-- SET LOCAL "request.auth.uid" = 'admin-uuid-here';
-- ============================================================

-- ============================================================
-- Test 1: Member cannot change their own role to admin
-- Expected: exception "Unauthorized: only admins can modify the role column"
-- ============================================================
-- Set as a member user
-- SET LOCAL "request.auth.uid" = '2a447186-9d5a-47d4-b1f6-e2e7a9a76508'; -- asadisdying007

-- This should FAIL with the trigger:
-- update public.profiles set role = 'admin' where id = auth.uid();
-- Expected error: "Unauthorized: only admins can modify the role column"

-- ============================================================
-- Test 2: Member cannot change their own phone_number
-- ============================================================
-- This should FAIL with the trigger:
-- update public.profiles set phone_number = '+15551234567' where id = auth.uid();
-- Expected error: "Unauthorized: only admins can modify the phone_number column"

-- ============================================================
-- Test 3: Member can only read their own leads (not others')
-- ============================================================
-- As a member:
-- SET LOCAL "request.auth.uid" = '2a447186-9d5a-47d4-b1f6-e2e7a9a76508';
-- select count(*) from public.leads;
-- Expected: only the leads assigned to this member (or 0 if none assigned)

-- As admin:
-- SET LOCAL "request.auth.uid" = 'd16e3d8a-6f42-4e3a-a3d8-5e2e9e0a3c7a'; -- asad@vexabots.com
-- select count(*) from public.leads;
-- Expected: ALL leads

-- ============================================================
-- Test 4: Member cannot delete any lead
-- ============================================================
-- As a member:
-- delete from public.leads where id = '<some_lead_id>';
-- Expected error: "0 rows" (policy blocks the operation)

-- ============================================================
-- Test 5: Member cannot reassign a lead
-- ============================================================
-- As a member:
-- update public.leads set assigned_to = '<other_user_id>' where assigned_to = auth.uid();
-- Expected: 0 rows affected (leads_update WITH CHECK blocks it,
-- AND the trigger raises an exception for the assigned_to column change)

-- ============================================================
-- Test 6: Member cannot insert a lead with role=admin profile
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
select pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.call_logs'::regclass
  and contype = 'c';
-- Expected: CHECK (status in ('initiated', 'ringing', 'answered', 'busy', 'voicemail', 'no_answer', 'disconnected'))

-- ============================================================
-- Test 10: Member cannot read another member's call_logs or activities
-- ============================================================
-- As a member:
-- select * from public.call_logs where caller_id != auth.uid();
-- Expected: 0 rows
-- select * from public.lead_activities where profile_id != auth.uid();
-- Expected: 0 rows (unless the activity is for a lead they own)
