-- Migration: Fix madrasa deletion and Auth cleanup.
-- File timestamp matches the version recorded in the remote Supabase history.
-- Description: Ensure complete deletion of auth users when madrasas are deleted,
--              clean up orphaned accounts, and provide an RPC to allow re-registering
--              previously deleted accounts cleanly.

-- 1. Ensure staff profile foreign key cascades or sets null safely
ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_profile_id_fkey,
  ADD CONSTRAINT staff_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Update delete_madrasa_completely to remove associated auth users (excluding super_admin)
CREATE OR REPLACE FUNCTION public.delete_madrasa_completely(p_madrasa_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Only super_admin is authorized to call this function
  IF public.get_user_role() != 'super_admin' THEN
    RAISE EXCEPTION 'Only super admins are authorized to permanently delete a madrasa';
  END IF;

  -- Delete all linked child data explicitly
  DELETE FROM public.exam_results WHERE madrasa_id = p_madrasa_id;
  DELETE FROM public.exam_miqdar WHERE madrasa_id = p_madrasa_id;
  DELETE FROM public.staff_attendance WHERE madrasa_id = p_madrasa_id;
  DELETE FROM public.staff WHERE madrasa_id = p_madrasa_id;
  DELETE FROM public.student_attendance WHERE madrasa_id = p_madrasa_id;
  DELETE FROM public.hifz_half_year_records WHERE madrasa_id = p_madrasa_id;
  DELETE FROM public.hifz_records WHERE madrasa_id = p_madrasa_id;
  DELETE FROM public.fees WHERE madrasa_id = p_madrasa_id;
  DELETE FROM public.students WHERE madrasa_id = p_madrasa_id;
  DELETE FROM public.classes WHERE madrasa_id = p_madrasa_id;
  
  -- Delete all user accounts associated with this madrasa from auth.users (except super_admin)
  -- Deleting from auth.users automatically cascade-deletes the profile from public.profiles
  DELETE FROM auth.users
  WHERE id IN (
    SELECT id FROM public.profiles
    WHERE madrasa_id = p_madrasa_id
      AND role != 'super_admin'
  );

  -- Delete any remaining non-super_admin profiles for this madrasa (if any exist without auth.users)
  DELETE FROM public.profiles
  WHERE madrasa_id = p_madrasa_id
    AND role != 'super_admin';

  -- Detach super_admin if linked to this madrasa
  UPDATE public.profiles
  SET madrasa_id = NULL
  WHERE madrasa_id = p_madrasa_id
    AND role = 'super_admin';

  -- Finally, delete the madrasa itself
  DELETE FROM public.madrasas WHERE id = p_madrasa_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_madrasa_completely(UUID) TO authenticated;

-- 3. Create helper RPC function to inspect and clean up orphaned auth users before invite creation
CREATE OR REPLACE FUNCTION public.check_or_cleanup_user_for_invite(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_madrasa_id UUID;
  v_madrasa_name TEXT;
  v_clean_email TEXT;
BEGIN
  v_clean_email := lower(trim(p_email));

  -- Find user in auth.users by email (case-insensitive)
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = v_clean_email
  LIMIT 1;

  -- If user does not exist in auth.users, email is completely available
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'available');
  END IF;

  -- Look up profile role and madrasa
  SELECT p.role, p.madrasa_id, m.name
  INTO v_role, v_madrasa_id, v_madrasa_name
  FROM public.profiles p
  LEFT JOIN public.madrasas m ON p.madrasa_id = m.id
  WHERE p.id = v_user_id;

  -- Protect super_admin account
  IF v_role = 'super_admin' THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'یہ ای میل ایڈریس سپر ایڈمن اکاؤنٹ کے لیے مخصوص ہے۔'
    );
  END IF;

  -- If user belongs to an existing active madrasa
  IF v_madrasa_id IS NOT NULL AND v_madrasa_name IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', format('یہ ای میل ایڈریس پہلے سے فعال ادارے "%s" کے ساتھ رجسٹرڈ ہے۔', v_madrasa_name)
    );
  END IF;

  -- User exists in auth.users but has NO active madrasa (orphaned from deleted madrasa)
  -- Cleanly delete from auth.users (cascades to profiles) so fresh registration succeeds
  DELETE FROM auth.users WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'status', 'available',
    'cleaned_orphaned', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_or_cleanup_user_for_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_or_cleanup_user_for_invite(text) TO service_role;

-- 4. Clean up existing orphaned non-super_admin accounts left over from previous madrasa deletions
DELETE FROM auth.users
WHERE id IN (
  SELECT p.id
  FROM public.profiles p
  WHERE p.madrasa_id IS NULL
    AND p.role != 'super_admin'
);
