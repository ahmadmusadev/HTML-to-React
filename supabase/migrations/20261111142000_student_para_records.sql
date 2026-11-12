-- ==============================================================================
-- MIGRATION: Student Para Completion Records (پارہ بہ پارہ تکمیلِ حفظ و تفصیلی جائزہ)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.student_para_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  is_mid_hifz BOOLEAN NOT NULL DEFAULT false,
  starting_para INT NOT NULL DEFAULT 30,
  prior_madrasa_name TEXT NOT NULL DEFAULT '',
  prior_paras_count INT NOT NULL DEFAULT 0,
  prior_paras_note TEXT NOT NULL DEFAULT '',
  paras JSONB NOT NULL DEFAULT '[]'::jsonb,
  reviews JSONB NOT NULL DEFAULT '[]'::jsonb,
  completion_status TEXT NOT NULL DEFAULT 'in_progress',
  completion_date DATE,
  saved_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT student_para_records_unique_student UNIQUE (madrasa_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_para_records_madrasa_id 
  ON public.student_para_records (madrasa_id);

CREATE INDEX IF NOT EXISTS idx_student_para_records_student_id 
  ON public.student_para_records (madrasa_id, student_id);

ALTER TABLE public.student_para_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'student_para_records' AND policyname = 'Super admin full access on student_para_records'
  ) THEN
    CREATE POLICY "Super admin full access on student_para_records" ON public.student_para_records
      FOR ALL TO authenticated 
      USING (public.get_user_role() = 'super_admin');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'student_para_records' AND policyname = 'Admin manage student_para_records in own madrasa'
  ) THEN
    CREATE POLICY "Admin manage student_para_records in own madrasa" ON public.student_para_records
      FOR ALL TO authenticated 
      USING (public.get_user_role() = 'admin' AND madrasa_id = public.get_user_madrasa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'student_para_records' AND policyname = 'Teacher manage student_para_records in own madrasa'
  ) THEN
    CREATE POLICY "Teacher manage student_para_records in own madrasa" ON public.student_para_records
      FOR ALL TO authenticated 
      USING (public.get_user_role() = 'teacher' AND madrasa_id = public.get_user_madrasa_id());
  END IF;
END $$;

-- Update delete_madrasa_completely to also clean up student_para_records
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
  DELETE FROM public.student_para_records WHERE madrasa_id = p_madrasa_id;
  DELETE FROM public.monthly_literacy WHERE madrasa_id = p_madrasa_id;
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

  -- Finally, permanently delete the madrasa record itself
  DELETE FROM public.madrasas
  WHERE id = p_madrasa_id;

  RETURN TRUE;
END;
$$;
