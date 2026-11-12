-- Add department column to students table for Qaida, Nazira, Hifz classification
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS department TEXT DEFAULT '';
