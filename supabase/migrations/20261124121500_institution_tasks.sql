-- ==============================================================================
-- MIGRATION: Institution Tasks & Reminders (زیرِ غور و یادداشت) Table & RLS Policies
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.institution_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'administrative', -- 'academic', 'administrative', 'financial', 'personal'
  priority TEXT DEFAULT 'normal',        -- 'high', 'normal', 'low'
  due_date DATE NOT NULL,
  reminder_date DATE,
  recurrence TEXT DEFAULT 'none',        -- 'none', 'daily', 'weekly', 'monthly', 'yearly'
  status TEXT DEFAULT 'pending',         -- 'pending', 'completed', 'cancelled'
  is_automated BOOLEAN DEFAULT false,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_institution_tasks_madrasa_id 
  ON public.institution_tasks (madrasa_id);

CREATE INDEX IF NOT EXISTS idx_institution_tasks_due_date 
  ON public.institution_tasks (madrasa_id, due_date);

CREATE INDEX IF NOT EXISTS idx_institution_tasks_status 
  ON public.institution_tasks (madrasa_id, status);

CREATE INDEX IF NOT EXISTS idx_institution_tasks_assigned_to 
  ON public.institution_tasks (assigned_to);

ALTER TABLE public.institution_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'institution_tasks' AND policyname = 'Super admin full access on institution_tasks'
  ) THEN
    CREATE POLICY "Super admin full access on institution_tasks" ON public.institution_tasks
      FOR ALL TO authenticated 
      USING (public.get_user_role() = 'super_admin');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'institution_tasks' AND policyname = 'Admin manage institution_tasks in own madrasa'
  ) THEN
    CREATE POLICY "Admin manage institution_tasks in own madrasa" ON public.institution_tasks
      FOR ALL TO authenticated 
      USING (public.get_user_role() = 'admin' AND madrasa_id = public.get_user_madrasa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'institution_tasks' AND policyname = 'Teacher view institution_tasks in own madrasa'
  ) THEN
    CREATE POLICY "Teacher view institution_tasks in own madrasa" ON public.institution_tasks
      FOR SELECT TO authenticated 
      USING (
        public.get_user_role() = 'teacher' 
        AND madrasa_id = public.get_user_madrasa_id()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'institution_tasks' AND policyname = 'Teacher insert own tasks in madrasa'
  ) THEN
    CREATE POLICY "Teacher insert own tasks in madrasa" ON public.institution_tasks
      FOR INSERT TO authenticated 
      WITH CHECK (
        public.get_user_role() = 'teacher' 
        AND madrasa_id = public.get_user_madrasa_id()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'institution_tasks' AND policyname = 'Teacher update own or assigned tasks'
  ) THEN
    CREATE POLICY "Teacher update own or assigned tasks" ON public.institution_tasks
      FOR UPDATE TO authenticated 
      USING (
        public.get_user_role() = 'teacher' 
        AND madrasa_id = public.get_user_madrasa_id() 
        AND (created_by = auth.uid() OR assigned_to = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'institution_tasks' AND policyname = 'Teacher delete own tasks'
  ) THEN
    CREATE POLICY "Teacher delete own tasks" ON public.institution_tasks
      FOR DELETE TO authenticated 
      USING (
        public.get_user_role() = 'teacher' 
        AND madrasa_id = public.get_user_madrasa_id() 
        AND created_by = auth.uid()
      );
  END IF;
END $$;

-- Update delete_madrasa_completely to also clean up institution_tasks and recent tables
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
  DELETE FROM public.institution_tasks WHERE madrasa_id = p_madrasa_id;
  DELETE FROM public.daily_academic_records WHERE madrasa_id = p_madrasa_id;
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

  -- Finally delete the madrasa itself
  DELETE FROM public.madrasas WHERE id = p_madrasa_id;

  RETURN TRUE;
END;
$$;
