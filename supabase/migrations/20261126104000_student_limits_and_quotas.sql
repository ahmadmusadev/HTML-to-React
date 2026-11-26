-- Migration: Add plan_name and max_students to madrasas and enforce student quota
-- Description: Adds plan_name and max_students to public.madrasas with safe defaults (50 students for free_maktab)
--              and provides database-level validation to prevent exceeding student quotas.

-- 1. Add plan_name and max_students to public.madrasas table
ALTER TABLE public.madrasas
  ADD COLUMN IF NOT EXISTS plan_name TEXT NOT NULL DEFAULT 'free_maktab',
  ADD COLUMN IF NOT EXISTS max_students INTEGER NOT NULL DEFAULT 50;

-- 2. Ensure non-null values and valid limits for existing records
UPDATE public.madrasas
SET plan_name = 'free_maktab'
WHERE plan_name IS NULL OR trim(plan_name) = '';

UPDATE public.madrasas
SET max_students = 50
WHERE max_students IS NULL OR max_students <= 0;

-- 3. Add constraint to ensure max_students is a positive integer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'madrasas_max_students_check'
  ) THEN
    ALTER TABLE public.madrasas
      ADD CONSTRAINT madrasas_max_students_check CHECK (max_students > 0);
  END IF;
END $$;

-- 4. Create trigger function to enforce quota at database level upon student insertion
CREATE OR REPLACE FUNCTION public.check_madrasa_student_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_students INTEGER;
  v_active_count INTEGER;
BEGIN
  -- Only enforce for active or non-withdrawn students being inserted or reactivated
  IF NEW.status IS NULL OR NEW.status NOT IN ('left', 'withdrawn') THEN
    -- Look up the madrasa limit
    SELECT max_students INTO v_max_students
    FROM public.madrasas
    WHERE id = NEW.madrasa_id;

    -- If madrasa not found or limit is null, default to 50
    IF v_max_students IS NULL THEN
      v_max_students := 50;
    END IF;

    -- Count existing active students for this madrasa (excluding current row if updating)
    SELECT COUNT(*) INTO v_active_count
    FROM public.students
    WHERE madrasa_id = NEW.madrasa_id
      AND (status IS NULL OR status NOT IN ('left', 'withdrawn'))
      AND (TG_OP = 'INSERT' OR id != NEW.id);

    -- Check if limit is reached
    IF v_active_count >= v_max_students THEN
      RAISE EXCEPTION 'آپ کے ادارے کی منظور شدہ حد (% طلباء) مکمل ہو چکی ہے۔ مزید طلباء کے اندراج کے لیے برائے کرم اپنا پلان اپ گریڈ فرمائیں۔', v_max_students;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to students table for INSERT and UPDATE of status or madrasa_id
DROP TRIGGER IF EXISTS trg_check_student_quota ON public.students;
CREATE TRIGGER trg_check_student_quota
BEFORE INSERT OR UPDATE OF status, madrasa_id ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.check_madrasa_student_quota();
