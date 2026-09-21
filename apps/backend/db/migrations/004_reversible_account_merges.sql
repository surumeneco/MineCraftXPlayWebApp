-- Never rewrite applied migrations: preserve merged account rows and original ownership.
-- statement
CREATE TABLE account_merges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  target_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  source_was_admin BOOLEAN NOT NULL,
  target_was_admin BOOLEAN NOT NULL,
  merged_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  restored_at TIMESTAMPTZ,
  CONSTRAINT account_merges_distinct CHECK (source_account_id <> target_account_id)
);
-- statement
CREATE UNIQUE INDEX account_merges_active_source_idx ON account_merges(source_account_id) WHERE restored_at IS NULL;
-- statement
CREATE UNIQUE INDEX account_merges_active_target_idx ON account_merges(target_account_id) WHERE restored_at IS NULL;
-- statement
ALTER TABLE account_discord_identities ADD COLUMN merge_origin UUID REFERENCES accounts(id) ON DELETE RESTRICT;
-- statement
ALTER TABLE account_minecraft_identities ADD COLUMN merge_origin UUID REFERENCES accounts(id) ON DELETE RESTRICT;
-- statement
ALTER TABLE images ADD COLUMN merge_origin UUID REFERENCES accounts(id) ON DELETE RESTRICT;
-- statement
CREATE INDEX account_discord_merge_origin_idx ON account_discord_identities(merge_origin) WHERE merge_origin IS NOT NULL;
-- statement
CREATE INDEX account_minecraft_merge_origin_idx ON account_minecraft_identities(merge_origin) WHERE merge_origin IS NOT NULL;
-- statement
CREATE INDEX images_merge_origin_idx ON images(merge_origin) WHERE merge_origin IS NOT NULL;
