-- Preserve territory applicant, submitted-by and audit FKs when retiring an account.
-- statement
ALTER TABLE accounts ADD COLUMN retired_at TIMESTAMPTZ;
-- statement
CREATE INDEX accounts_active_name_idx ON accounts(name) WHERE retired_at IS NULL;
