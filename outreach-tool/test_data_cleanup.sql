-- ============================================================
-- Vexabots - Test Data Cleanup Script
-- REVIEW BEFORE RUNNING. This DELETES test data.
-- ============================================================

-- 1. Find duplicate lead profiles (same email)
SELECT id, email, full_name, role, created_at
FROM public.profiles
WHERE email IN (
  SELECT email FROM public.profiles
  WHERE email IS NOT NULL
  GROUP BY email
  HAVING COUNT(*) > 1
)
ORDER BY email, created_at;

-- 2. Find duplicate leads (same normalized phone + title)
SELECT id, title, phone, owner_name, created_at
FROM public.leads
WHERE phone IS NOT NULL
  AND LOWER(REPLACE(REPLACE(phone, '-', ''), ' ', '')) IN (
    SELECT LOWER(REPLACE(REPLACE(phone, '-', ''), ' ', ''))
    FROM public.leads
    WHERE phone IS NOT NULL
    GROUP BY phone
    HAVING COUNT(*) > 1
  )
ORDER BY phone, created_at;

-- 3. Find test users to remove (review before deleting)
SELECT id, email, full_name, role, created_at
FROM public.profiles
WHERE email LIKE '%test%'
  OR email LIKE '%testnewuser%'
  OR email LIKE '%testdelete%'
  OR full_name LIKE '%Test%'
  OR full_name LIKE '%E2E Activity%';

-- 4. Find test leads to remove
SELECT id, title, source, created_at
FROM public.leads
WHERE title LIKE '%Test%'
  OR title LIKE 'Third CSV%'
  OR title LIKE 'E2E Activity%'
  OR place_id LIKE '%test%'
  OR place_id = 'test_place_id';

-- 5. Find duplicate members in analytics (duplicate profile rows vs duplicate auth users)
-- Check for same email with different IDs in auth.users
SELECT id, email, created_at
FROM auth.users
WHERE email IN (
  SELECT email FROM auth.users
  WHERE email IS NOT NULL
  GROUP BY email
  HAVING COUNT(*) > 1
)
ORDER BY email, created_at;

-- 6. Clean up duplicates: delete duplicate auth users (keep the one with latest activity)
-- UNCOMMENT and review before running:
-- DELETE FROM auth.users
-- WHERE id NOT IN (
--   SELECT MIN(id) FROM auth.users
--   WHERE email IS NOT NULL
--   GROUP BY email
-- );

-- 7. Clean up test data
-- UNCOMMENT and review before running:
-- DELETE FROM public.call_logs WHERE lead_id IN (
--   SELECT id FROM public.leads WHERE title LIKE '%Test%' OR title LIKE 'Third CSV%'
-- );
-- DELETE FROM public.lead_activities WHERE lead_id IN (
--   SELECT id FROM public.leads WHERE title LIKE '%Test%' OR title LIKE 'Third CSV%'
-- );
-- DELETE FROM public.assignment_history WHERE lead_id IN (
--   SELECT id FROM public.leads WHERE title LIKE '%Test%' OR title LIKE 'Third CSV%'
-- );
-- DELETE FROM public.leads WHERE title LIKE '%Test%' OR title LIKE 'Third CSV%' OR title LIKE 'E2E Activity%';
-- DELETE FROM public.profiles WHERE email LIKE '%test%' OR email LIKE '%testnewuser%' OR email LIKE '%testdelete%';
-- DELETE FROM auth.users WHERE email IN ('testnewuser999@', 'testdelete123@');

-- 8. Check assigned counts vs actual (to verify fix #11)
SELECT
  p.id AS profile_id,
  p.full_name,
  p.email,
  al.max_leads,
  al.current_leads AS stored_count,
  (SELECT COUNT(*) FROM public.leads l WHERE l.assigned_to = p.id) AS actual_count
FROM public.profiles p
JOIN public.assignment_limits al ON al.profile_id = p.id
WHERE p.role = 'member'
ORDER BY p.full_name;
