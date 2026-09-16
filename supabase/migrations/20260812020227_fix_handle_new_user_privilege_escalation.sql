CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_phone TEXT;
BEGIN
  v_full_name := NULLIF(TRIM(COALESCE(new.raw_user_meta_data->>'full_name', new.email, 'کاربر')), '');
  IF v_full_name IS NULL THEN
    v_full_name := 'کاربر';
  END IF;
  v_phone := NULLIF(TRIM(new.raw_user_meta_data->>'phone'), '');

  INSERT INTO public.profiles (id, full_name, role, madrasa_id, phone)
  VALUES (
    new.id,
    LEFT(v_full_name, 255),
    'teacher',
    NULL,
    LEFT(v_phone, 30)
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.admin_set_profile_role(
  p_user_id UUID,
  p_new_role TEXT,
  p_madrasa_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  caller_madrasa UUID;
  target_madrasa UUID;
BEGIN
  caller_role := public.get_user_role();

  IF caller_role IS NULL OR caller_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'permission denied: only an admin or super_admin can assign roles';
  END IF;

  IF p_new_role IS NULL OR p_new_role NOT IN ('teacher', 'admin') THEN
    RAISE EXCEPTION 'invalid role: only ''teacher'' or ''admin'' can be assigned here';
  END IF;

  SELECT madrasa_id INTO target_madrasa FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found for user %', p_user_id;
  END IF;

  IF caller_role = 'admin' THEN
    caller_madrasa := public.get_user_madrasa_id();
    IF caller_madrasa IS NULL THEN
      RAISE EXCEPTION 'permission denied: admin has no madrasa assigned';
    END IF;
    IF p_madrasa_id IS DISTINCT FROM caller_madrasa THEN
      RAISE EXCEPTION 'permission denied: admin can only assign roles within their own madrasa';
    END IF;
    IF target_madrasa IS NOT NULL AND target_madrasa IS DISTINCT FROM caller_madrasa THEN
      RAISE EXCEPTION 'permission denied: admin cannot re-assign a user who already belongs to another madrasa';
    END IF;
  END IF;

  IF p_new_role = 'admin' AND p_madrasa_id IS NULL THEN
    RAISE EXCEPTION 'madrasa_id is required when promoting a user to admin';
  END IF;

  UPDATE public.profiles
  SET role = p_new_role,
      madrasa_id = p_madrasa_id
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found for user %', p_user_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_profile_role(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_role(UUID, TEXT, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_madrasa_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
