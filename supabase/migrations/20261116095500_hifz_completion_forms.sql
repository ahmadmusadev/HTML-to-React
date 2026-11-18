-- ==============================================================================
-- MIGRATION: Hifz Completion Performance Forms (مجموعی حفظ کارکردگی فارم)
-- & Student Department Progression Milestones
-- ==============================================================================

-- 1. Extend students table with department progression milestone dates
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS initial_department TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS qaida_start_date DATE,
  ADD COLUMN IF NOT EXISTS qaida_completion_date DATE,
  ADD COLUMN IF NOT EXISTS nazira_start_date DATE,
  ADD COLUMN IF NOT EXISTS nazira_completion_date DATE,
  ADD COLUMN IF NOT EXISTS hifz_completion_date DATE;

-- 2. Create hifz_completion_forms table for storing full cumulative performance form records
CREATE TABLE IF NOT EXISTS public.hifz_completion_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  computer_id TEXT NOT NULL DEFAULT '',
  initial_department TEXT NOT NULL DEFAULT '',
  admission_date DATE,
  qaida_start_date DATE,
  qaida_completion_date DATE,
  nazira_start_date DATE,
  nazira_completion_date DATE,
  hifz_start_date DATE,
  hifz_completion_date DATE,
  hifz_completion_hijri TEXT NOT NULL DEFAULT '',
  hifz_duration_text TEXT NOT NULL DEFAULT '',
  daur_duration_text TEXT NOT NULL DEFAULT '',
  branch_name TEXT NOT NULL DEFAULT '',
  area_name TEXT NOT NULL DEFAULT '',
  teacher_name TEXT NOT NULL DEFAULT '',
  overall_quality TEXT NOT NULL DEFAULT '',
  shishmahi_marks NUMERIC DEFAULT 0,
  shishmahi_grade TEXT NOT NULL DEFAULT '',
  salana_marks NUMERIC DEFAULT 0,
  salana_grade TEXT NOT NULL DEFAULT '',
  wifaq_marks NUMERIC DEFAULT 0,
  wifaq_grade TEXT NOT NULL DEFAULT '',
  attendance_quality TEXT NOT NULL DEFAULT '',
  parents_conduct TEXT NOT NULL DEFAULT '',
  monthly_fee NUMERIC DEFAULT 0,
  fee_concession NUMERIC DEFAULT 0,
  concession_type TEXT NOT NULL DEFAULT '',
  special_notes TEXT NOT NULL DEFAULT '',
  form_date DATE,
  preparer_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT hifz_completion_forms_student_unique UNIQUE (madrasa_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_hifz_completion_forms_madrasa_id 
  ON public.hifz_completion_forms (madrasa_id);

CREATE INDEX IF NOT EXISTS idx_hifz_completion_forms_student_id 
  ON public.hifz_completion_forms (madrasa_id, student_id);

-- 3. Row Level Security Policies
ALTER TABLE public.hifz_completion_forms ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'hifz_completion_forms' AND policyname = 'Super admin full access on hifz_completion_forms'
  ) THEN
    CREATE POLICY "Super admin full access on hifz_completion_forms" ON public.hifz_completion_forms
      FOR ALL TO authenticated 
      USING (public.get_user_role() = 'super_admin');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'hifz_completion_forms' AND policyname = 'Admin manage hifz_completion_forms in own madrasa'
  ) THEN
    CREATE POLICY "Admin manage hifz_completion_forms in own madrasa" ON public.hifz_completion_forms
      FOR ALL TO authenticated 
      USING (public.get_user_role() = 'admin' AND madrasa_id = public.get_user_madrasa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'hifz_completion_forms' AND policyname = 'Teacher manage hifz_completion_forms in own madrasa'
  ) THEN
    CREATE POLICY "Teacher manage hifz_completion_forms in own madrasa" ON public.hifz_completion_forms
      FOR ALL TO authenticated 
      USING (public.get_user_role() = 'teacher' AND madrasa_id = public.get_user_madrasa_id());
  END IF;
END $$;

-- 4. Update atomic delete_madrasa_completely to cleanly cascade hifz_completion_forms
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
  DELETE FROM public.hifz_completion_forms WHERE madrasa_id = p_madrasa_id;
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
