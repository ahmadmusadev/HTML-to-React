-- ==============================================================================
-- MIGRATION: Hifz Half-Year Records and Student Hifz Start Date
-- ==============================================================================

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS hifz_start_date DATE;

CREATE TABLE IF NOT EXISTS public.hifz_half_year_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  hifz_year INTEGER NOT NULL CHECK (hifz_year BETWEEN 1 AND 4),
  half_year INTEGER NOT NULL CHECK (half_year IN (1, 2)),
  total_pages INTEGER NOT NULL DEFAULT 0,
  pao NUMERIC NOT NULL DEFAULT 0,
  juz NUMERIC NOT NULL DEFAULT 0,
  pct NUMERIC NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  total_working INTEGER NOT NULL DEFAULT 0,
  total_present INTEGER NOT NULL DEFAULT 0,
  total_absent INTEGER NOT NULL DEFAULT 0,
  total_leave INTEGER NOT NULL DEFAULT 0,
  attendance_pct NUMERIC NOT NULL DEFAULT 0,
  monthly_academic_details JSONB,
  monthly_attendance_details JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, hifz_year, half_year)
);

ALTER TABLE public.hifz_half_year_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hifz_half_year_records' AND policyname = 'Super admin full access on hifz_half_year_records'
  ) THEN
    CREATE POLICY "Super admin full access on hifz_half_year_records" ON public.hifz_half_year_records
      FOR ALL TO authenticated USING (public.get_user_role() = 'super_admin');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hifz_half_year_records' AND policyname = 'Admin manage hifz_half_year_records in own madrasa'
  ) THEN
    CREATE POLICY "Admin manage hifz_half_year_records in own madrasa" ON public.hifz_half_year_records
      FOR ALL TO authenticated USING (public.get_user_role() = 'admin' AND madrasa_id = public.get_user_madrasa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hifz_half_year_records' AND policyname = 'Teacher view hifz_half_year_records in own madrasa'
  ) THEN
    CREATE POLICY "Teacher view hifz_half_year_records in own madrasa" ON public.hifz_half_year_records
      FOR SELECT TO authenticated USING (public.get_user_role() = 'teacher' AND madrasa_id = public.get_user_madrasa_id());
  END IF;
END $$;
