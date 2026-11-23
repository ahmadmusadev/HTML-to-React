-- ==============================================================================
-- MIGRATION: Daily Academic Records Table & RLS Policies
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.daily_academic_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sabaq BOOLEAN DEFAULT false,
  sabqi BOOLEAN DEFAULT false,
  manzil BOOLEAN DEFAULT false,
  manzil_para INT,
  manzil_amount TEXT,
  sami_name TEXT,
  kaifiyat_checked BOOLEAN DEFAULT false,
  kaifiyat_text VARCHAR(100),
  mutalaah BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_academic_madrasa_date 
  ON public.daily_academic_records (madrasa_id, date);

CREATE INDEX IF NOT EXISTS idx_daily_academic_class_date 
  ON public.daily_academic_records (class_id, date);

CREATE INDEX IF NOT EXISTS idx_daily_academic_student_date 
  ON public.daily_academic_records (student_id, date);

ALTER TABLE public.daily_academic_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'daily_academic_records' AND policyname = 'Super admin full access on daily_academic_records'
  ) THEN
    CREATE POLICY "Super admin full access on daily_academic_records" ON public.daily_academic_records
      FOR ALL TO authenticated 
      USING (public.get_user_role() = 'super_admin');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'daily_academic_records' AND policyname = 'Admin manage daily_academic_records in own madrasa'
  ) THEN
    CREATE POLICY "Admin manage daily_academic_records in own madrasa" ON public.daily_academic_records
      FOR ALL TO authenticated 
      USING (public.get_user_role() = 'admin' AND madrasa_id = public.get_user_madrasa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'daily_academic_records' AND policyname = 'Teacher manage daily_academic_records in own madrasa'
  ) THEN
    CREATE POLICY "Teacher manage daily_academic_records in own madrasa" ON public.daily_academic_records
      FOR ALL TO authenticated 
      USING (public.get_user_role() = 'teacher' AND madrasa_id = public.get_user_madrasa_id());
  END IF;
END $$;
