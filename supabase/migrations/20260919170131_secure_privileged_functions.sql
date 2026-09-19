-- Restrict privileged RPC functions to the minimum set of callers.
--
-- The account-invitation Edge Function invokes the cleanup helper with the
-- service_role key. Browser clients must never invoke it directly because it
-- can delete an orphaned Auth user as part of the cleanup workflow.
REVOKE EXECUTE ON FUNCTION public.check_or_cleanup_user_for_invite(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_or_cleanup_user_for_invite(text)
  TO service_role;

-- This RPC is not used by the application. Profile changes are controlled by
-- the existing RLS policies, so leave no public API surface for this function.
REVOKE EXECUTE ON FUNCTION public.admin_set_profile_role(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;

-- Permanent madrasa deletion is a browser action for super_admin users. Keep
-- the authenticated grant required by that flow, but remove all anonymous and
-- PUBLIC access. The function itself enforces the super_admin role.
REVOKE EXECUTE ON FUNCTION public.delete_madrasa_completely(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_madrasa_completely(uuid)
  TO authenticated;
