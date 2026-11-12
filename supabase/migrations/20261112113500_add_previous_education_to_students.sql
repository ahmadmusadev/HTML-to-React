-- Add previous education history columns to students table
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS previous_madrasa TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS previous_education TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS previous_leaving_reason TEXT DEFAULT '';
