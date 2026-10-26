-- Allow admins to update caller_id_number for any profile
-- (the existing profiles_update_own policy only allows users to edit their own row)
create policy "profiles_update_caller_id_admin"
  on public.profiles
  for update
  using (public.is_admin())
  with check (true);
