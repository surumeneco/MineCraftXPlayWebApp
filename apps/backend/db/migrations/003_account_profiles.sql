-- Account display names are non-unique. Existing accounts receive a stable fallback.
-- statement
ALTER TABLE accounts ADD COLUMN name TEXT NOT NULL DEFAULT '未設定';
-- statement
UPDATE accounts a SET name = COALESCE((SELECT i.discord_id FROM account_discord_identities i WHERE i.account_id=a.id ORDER BY i.linked_at, i.discord_id LIMIT 1), a.id::TEXT);
-- statement
ALTER TABLE accounts ADD CONSTRAINT accounts_name_nonempty CHECK (length(btrim(name)) > 0);
-- statement
ALTER TABLE account_discord_identities ADD COLUMN username TEXT NOT NULL DEFAULT '';
-- statement
ALTER TABLE account_discord_identities ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
-- statement
UPDATE account_discord_identities SET username=discord_id, display_name=discord_id;
-- statement
CREATE TABLE account_minecraft_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  edition TEXT NOT NULL CHECK (edition IN ('je', 'be')),
  username TEXT NOT NULL CHECK (length(btrim(username)) > 0),
  linked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (edition, username)
);
-- statement
CREATE INDEX account_minecraft_account_idx ON account_minecraft_identities(account_id);
