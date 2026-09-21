-- Account records contain only internal identity and creation time.
-- statement
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- statement
CREATE TABLE account_discord_identities (
  discord_id TEXT PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- statement
CREATE INDEX account_discord_account_idx ON account_discord_identities(account_id);
-- statement
CREATE TABLE account_roles (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin')),
  PRIMARY KEY (account_id, role)
);
-- statement
CREATE TEMP TABLE legacy_accounts (
  discord_id TEXT PRIMARY KEY,
  account_id UUID NOT NULL DEFAULT gen_random_uuid()
) ON COMMIT DROP;
-- statement
INSERT INTO legacy_accounts(discord_id) SELECT discord_id FROM admin_users;
-- statement
INSERT INTO accounts(id, created_at)
SELECT l.account_id, u.created_at FROM legacy_accounts l JOIN admin_users u USING (discord_id);
-- statement
INSERT INTO account_discord_identities(discord_id, account_id)
SELECT discord_id, account_id FROM legacy_accounts;
-- statement
INSERT INTO account_roles(account_id, role)
SELECT account_id, 'admin' FROM legacy_accounts;
-- statement
CREATE TABLE account_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  csrf_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- statement
CREATE INDEX account_sessions_expiry_idx ON account_sessions(expires_at);
-- statement
INSERT INTO account_sessions(token_hash, account_id, csrf_hash, expires_at, created_at)
SELECT s.token_hash, l.account_id, s.csrf_hash, s.expires_at, s.created_at
FROM admin_sessions s JOIN legacy_accounts l ON l.discord_id=s.discord_id;
-- statement
DROP TABLE admin_sessions;
-- statement
ALTER TABLE images DROP CONSTRAINT images_uploaded_by_fkey;
-- statement
UPDATE images i SET uploaded_by=l.account_id::TEXT
FROM legacy_accounts l WHERE i.uploaded_by=l.discord_id;
-- statement
ALTER TABLE images ALTER COLUMN uploaded_by TYPE UUID USING uploaded_by::UUID;
-- statement
ALTER TABLE images ADD CONSTRAINT images_uploaded_by_fkey
FOREIGN KEY (uploaded_by) REFERENCES accounts(id);
-- statement
DROP TABLE admin_users;
