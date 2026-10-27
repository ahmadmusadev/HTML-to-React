-- Add English name and English father name columns to students table for English receipt previews and admission records
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS name_english TEXT,
  ADD COLUMN IF NOT EXISTS father_name_english TEXT;
