-- ==============================================================================
-- MIGRATION: Update fees table with invoice_id, arrears, and payment_method
-- ==============================================================================

ALTER TABLE public.fees
  ADD COLUMN IF NOT EXISTS invoice_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS arrears NUMERIC NOT NULL DEFAULT 0 CHECK (arrears >= 0),
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

CREATE INDEX IF NOT EXISTS idx_fees_invoice_id ON public.fees(invoice_id);
