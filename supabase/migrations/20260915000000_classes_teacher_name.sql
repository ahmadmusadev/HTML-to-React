-- ==============================================================================
-- MIGRATION: Add teacher_name column to public.classes
-- ==============================================================================

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS teacher_name TEXT;

CREATE INDEX IF NOT EXISTS idx_classes_madrasa_id_created ON public.classes(madrasa_id, created_at);
