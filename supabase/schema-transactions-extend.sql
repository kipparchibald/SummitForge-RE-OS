-- Sprint 2b: extend transactions for dual-store CRM handoff
-- Safe to re-run. Core `transactions` table is in schema.sql.

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_land BOOLEAN DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_new_construction BOOLEAN DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS contact_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS property_address TEXT; -- alias safety

CREATE INDEX IF NOT EXISTS idx_transactions_contact ON transactions (contact_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions (status);
CREATE INDEX IF NOT EXISTS idx_transactions_updated ON transactions (updated_at DESC);

-- RLS already: authenticated all transactions (schema.sql)
