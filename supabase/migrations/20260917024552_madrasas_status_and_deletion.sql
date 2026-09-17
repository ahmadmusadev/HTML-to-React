-- ==============================================================================
-- MIGRATION: Madrasas Status, Foreign Key Cascades & Deletion RPC
-- ==============================================================================

-- 1. Add status column to madrasas table
ALTER TABLE public.madrasas 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled'));

-- 2. Ensure foreign keys cascade when a madrasa is deleted
ALTER TABLE public.exam_miqdar
  DROP CONSTRAINT IF EXISTS exam_miqdar_madrasa_id_fkey,
  ADD CONSTRAINT exam_miqdar_madrasa_id_fkey FOREIGN KEY (madrasa_id) REFERENCES public.madrasas(id) ON DELETE CASCADE;

ALTER TABLE public.exam_miqdar
  DROP CONSTRAINT IF EXISTS exam_miqdar_class_id_fkey,
  ADD CONSTRAINT exam_miqdar_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;

ALTER TABLE public.exam_miqdar
  DROP CONSTRAINT IF EXISTS exam_miqdar_student_id_fkey,
  ADD CONSTRAINT exam_miqdar_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.exam_results
  DROP CONSTRAINT IF EXISTS exam_results_madrasa_id_fkey,
  ADD CONSTRAINT exam_results_madrasa_id_fkey FOREIGN KEY (madrasa_id) REFERENCES public.madrasas(id) ON DELETE CASCADE;

ALTER TABLE public.exam_results
  DROP CONSTRAINT IF EXISTS exam_results_class_id_fkey,
  ADD CONSTRAINT exam_results_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;

ALTER TABLE public.exam_results
  DROP CONSTRAINT IF EXISTS exam_results_student_id_fkey,
  ADD CONSTRAINT exam_results_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.staff_attendance
  DROP CONSTRAINT IF EXISTS staff_attendance_madrasa_id_fkey,
  ADD CONSTRAINT staff_attendance_madrasa_id_fkey FOREIGN KEY (madrasa_id) REFERENCES public.madrasas(id) ON DELETE CASCADE;

ALTER TABLE public.staff_attendance
  DROP CONSTRAINT IF EXISTS staff_attendance_staff_id_fkey,
  ADD CONSTRAINT staff_attendance_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;

ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_madrasa_id_fkey,
  ADD CONSTRAINT staff_madrasa_id_fkey FOREIGN KEY (madrasa_id) REFERENCES public.madrasas(id) ON DELETE CASCADE;

-- 3. Atomic RPC function to delete a madrasa and all associated records
CREATE OR REPLACE FUNCTION public.delete_madrasa_completely(p_madrasa_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  
  -- Detach profiles associated with this madrasa
  UPDATE public.profiles SET madrasa_id = NULL WHERE madrasa_id = p_madrasa_id;

  -- Finally, delete the madrasa itself
  DELETE FROM public.madrasas WHERE id = p_madrasa_id;

  RETURN TRUE;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_madrasa_completely(UUID) TO authenticated;
