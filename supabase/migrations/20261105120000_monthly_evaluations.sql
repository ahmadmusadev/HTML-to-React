-- ==============================================================================
-- MIGRATION: Monthly Evaluations (ماہانہ جائزہ) Table & RLS Policies
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.monthly_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  month TEXT NOT NULL,
  year TEXT NOT NULL,
  students JSONB NOT NULL DEFAULT '[]'::jsonb,
  saved_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT monthly_evaluations_unique_class_month_year UNIQUE (madrasa_id, class_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_monthly_evaluations_madrasa_id 
  ON public.monthly_evaluations (madrasa_id);

CREATE INDEX IF NOT EXISTS idx_monthly_evaluations_class_month_year 
  ON public.monthly_evaluations (madrasa_id, class_id, month, year);

ALTER TABLE public.monthly_evaluations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'monthly_evaluations' AND policyname = 'Super admin full access on monthly_evaluations'
  ) THEN
    CREATE POLICY "Super admin full access on monthly_evaluations" ON public.monthly_evaluations
      FOR ALL TO authenticated 
      USING (public.get_user_role() = 'super_admin');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'monthly_evaluations' AND policyname = 'Admin manage monthly_evaluations in own madrasa'
  ) THEN
    CREATE POLICY "Admin manage monthly_evaluations in own madrasa" ON public.monthly_evaluations
      FOR ALL TO authenticated 
      USING (public.get_user_role() = 'admin' AND madrasa_id = public.get_user_madrasa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'monthly_evaluations' AND policyname = 'Teacher manage monthly_evaluations in own madrasa'
  ) THEN
    CREATE POLICY "Teacher manage monthly_evaluations in own madrasa" ON public.monthly_evaluations
      FOR ALL TO authenticated 
      USING (public.get_user_role() = 'teacher' AND madrasa_id = public.get_user_madrasa_id());
  END IF;
END $$;

-- Update delete_madrasa_completely to also clean up monthly_evaluations
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
  DELETE FROM public.monthly_evaluations WHERE madrasa_id = p_madrasa_id;
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
