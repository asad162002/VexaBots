-- Migration: Add updated_at column to lead_activities table
-- The log_call_outcome function references updated_at in its INSERT
-- but the column was missing from the table.

ALTER TABLE public.lead_activities
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Ensure updated_at is set on insert (in case the function relies on it)
