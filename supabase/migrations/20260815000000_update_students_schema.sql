-- ==============================================================================
-- MIGRATION: Update students table with full admission details
-- Adds all required fields for student registration, parental data, and status
-- ==============================================================================

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS admission_date DATE,
  ADD COLUMN IF NOT EXISTS father_name TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'لڑکا',
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS b_form_number TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS father_cnic TEXT,
  ADD COLUMN IF NOT EXISTS father_education TEXT,
  ADD COLUMN IF NOT EXISTS father_occupation TEXT,
  ADD COLUMN IF NOT EXISTS father_mobile TEXT,
  ADD COLUMN IF NOT EXISTS father_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS father_email TEXT,
  ADD COLUMN IF NOT EXISTS father_income TEXT,
  ADD COLUMN IF NOT EXISTS is_father_guardian BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS mother_name TEXT,
  ADD COLUMN IF NOT EXISTS mother_cnic TEXT,
  ADD COLUMN IF NOT EXISTS mother_education TEXT,
  ADD COLUMN IF NOT EXISTS mother_occupation TEXT,
  ADD COLUMN IF NOT EXISTS mother_mobile TEXT,
  ADD COLUMN IF NOT EXISTS mother_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS mother_income TEXT,
  ADD COLUMN IF NOT EXISTS guardian_name TEXT,
  ADD COLUMN IF NOT EXISTS guardian_relation TEXT,
  ADD COLUMN IF NOT EXISTS guardian_cnic TEXT,
  ADD COLUMN IF NOT EXISTS guardian_education TEXT,
  ADD COLUMN IF NOT EXISTS guardian_occupation TEXT,
  ADD COLUMN IF NOT EXISTS guardian_income TEXT,
  ADD COLUMN IF NOT EXISTS guardian_mobile TEXT,
  ADD COLUMN IF NOT EXISTS guardian_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS withdrawal_date DATE,
  ADD COLUMN IF NOT EXISTS withdrawal_reason TEXT;
