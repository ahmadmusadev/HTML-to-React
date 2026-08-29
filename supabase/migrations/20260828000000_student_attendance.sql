-- ==============================================================================
-- MIGRATION: Student Attendance Table & RLS Policies
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.student_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'leave', 'late')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, date)
);

CREATE INDEX IF NOT EXISTS idx_student_attendance_madrasa_date 
  ON public.student_attendance (madrasa_id, date);

CREATE INDEX IF NOT EXISTS idx_student_attendance_student_id 
  ON public.student_attendance (student_id);

CREATE INDEX IF NOT EXISTS idx_student_attendance_date 
  ON public.student_attendance (date);

ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'student_attendance' AND policyname = 'Super admin full access on student_attendance'
  ) THEN
    CREATE POLICY "Super admin full access on student_attendance" ON public.student_attendance
      FOR ALL TO authenticated 
      USING (public.get_user_role() = 'super_admin');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'student_attendance' AND policyname = 'Admin manage student_attendance in own madrasa'
  ) THEN
    CREATE POLICY "Admin manage student_attendance in own madrasa" ON public.student_attendance
      FOR ALL TO authenticated 
      USING (public.get_user_role() = 'admin' AND madrasa_id = public.get_user_madrasa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'student_attendance' AND policyname = 'Teacher manage student_attendance in own madrasa'
  ) THEN
    CREATE POLICY "Teacher manage student_attendance in own madrasa" ON public.student_attendance
      FOR ALL TO authenticated 
      USING (public.get_user_role() = 'teacher' AND madrasa_id = public.get_user_madrasa_id());
  END IF;
END $$;
