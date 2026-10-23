-- ============================================================
-- SQL to find duplicate profiles / members
-- Run this to identify leftover duplicate members in the DB
--
-- Two scenarios:
-- 1. Duplicate rows in profiles (same email, different id)
-- 2. Duplicate rows in auth.users (Supabase Edge: same email, multiple rows)
-- ============================================================

-- Scenario 1: Duplicate profiles by email
SELECT email, count(*) as duplicates, array_agg(id) as profile_ids
FROM profiles
WHERE email IS NOT NULL
GROUP BY email
HAVING count(*) > 1
ORDER BY duplicates DESC;

-- Scenario 2: Duplicate auth.users by email (requires service role)
-- Run in Supabase SQL editor with service role
SELECT email, count(*) as duplicates, array_agg(id) as user_ids
FROM auth.users
WHERE email IS NOT NULL
GROUP BY email
HAVING count(*) > 1
ORDER BY duplicates DESC;

-- Quick count of total members
SELECT count(*) as total_profiles, count(*) filter (where role = 'admin') as admins, count(*) filter (where role = 'member') as members FROM profiles;

-- Check for orphaned profiles (no corresponding auth.users row)
SELECT p.id, p.email, p.role
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.id IS NULL;