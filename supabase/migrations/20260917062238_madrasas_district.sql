-- Migration: Add district column to public.madrasas
-- File timestamp matches the version recorded in the remote Supabase history.
-- Allows regional filtering, grouping, and district-wise listing of institutions.

ALTER TABLE public.madrasas
ADD COLUMN IF NOT EXISTS district TEXT;

COMMENT ON COLUMN public.madrasas.district IS 'District (ضلع) where the madrasa is located for regional filtering and sorting';
