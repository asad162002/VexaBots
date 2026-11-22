-- Close the blanket read on both lead tables.
--
-- `leads_select_all` on `public.leads` and `linkedin_leads_select_all` on `public.linkedin_leads`
-- both carried `using (true)`. Policies are permissive and OR together, so a blanket `true` makes
-- every narrower policy beside it meaningless: any signed in user could read every lead in the
-- database, whatever it was assigned to and whoever owned it.
--
-- Measured before the change, as a real member's session against the live database: 4 LinkedIn rows
-- visible where only 1 was theirs. Measured after: 1 visible, theirs, and an admin still sees all 4.
--
-- `leads` already had the correct rule (`leads_select`: admin, or assigned to the caller), so the
-- blanket policy was simply dropped. `linkedin_leads` had no scoped select policy at all, so one is
-- created here in the same shape. The two tables now read by the same rule, which is also the rule
-- My Queue and the follow-ups board already applied in the browser.
--
-- Deliberately NOT changed here, and still open: `linkedin_leads_insert_all`, `_update_all` and
-- `_delete_all` are also `true`, so any signed in user can write or delete any LinkedIn contact.
-- Nothing member facing uses them (members never open that table's screens, and their own writes go
-- through SECURITY DEFINER functions), so they were left for their own pass rather than widened here.
--
-- Applied to the live project on 2026-11-22.

drop policy if exists leads_select_all on public.leads;
drop policy if exists linkedin_leads_select_all on public.linkedin_leads;

create policy linkedin_leads_select on public.linkedin_leads
  for select using (public.is_admin() or assigned_to = auth.uid());
