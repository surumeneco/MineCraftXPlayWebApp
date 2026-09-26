-- Extend existing territory data without replacing approved boundaries, applications, or images.
-- statement
ALTER TABLE territory_applications ADD COLUMN image_id UUID REFERENCES images(id) ON DELETE RESTRICT;
-- statement
ALTER TABLE territories ADD COLUMN current_name TEXT CHECK (current_name IS NULL OR length(btrim(current_name)) BETWEEN 1 AND 100);
-- statement
ALTER TABLE territories ADD COLUMN current_image_id UUID REFERENCES images(id) ON DELETE RESTRICT;
-- statement
UPDATE territories t SET current_name = a.name
FROM LATERAL (SELECT 1) AS seed,
LATERAL (SELECT name FROM territory_applications a
  WHERE a.territory_id = t.id AND a.status = 'approved'
  ORDER BY a.decided_at DESC NULLS LAST, a.submitted_at DESC, a.id DESC LIMIT 1) a
WHERE t.id IS NOT NULL;
-- statement
ALTER TABLE territory_operations DROP CONSTRAINT territory_operations_operation_kind_check;
-- statement
ALTER TABLE territory_operations ADD CONSTRAINT territory_operations_operation_kind_check
  CHECK (operation_kind IN ('create','reapply','edit','withdraw','approve','return','reject','transfer'));
-- statement
CREATE TABLE territory_change_history (
  operation_id UUID PRIMARY KEY REFERENCES territory_operations(operation_id) ON DELETE RESTRICT,
  territory_id UUID NOT NULL REFERENCES territories(id) ON DELETE RESTRICT,
  actor_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('metadata','owner')),
  old_name TEXT,
  new_name TEXT,
  old_image_id UUID REFERENCES images(id) ON DELETE RESTRICT,
  new_image_id UUID REFERENCES images(id) ON DELETE RESTRICT,
  old_owner_type TEXT,
  new_owner_type TEXT,
  old_owner_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  new_owner_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- statement
CREATE INDEX territory_change_history_territory_idx ON territory_change_history(territory_id,changed_at DESC);
-- statement
INSERT INTO site_image_resources(key,name,description) VALUES
  ('card.info','情報カード','情報トップへの導線'),
  ('card.lists','一覧カード','一覧トップへの導線'),
  ('card.applications','申請カード','申請トップへの導線')
ON CONFLICT (key) DO NOTHING;
-- statement
UPDATE site_image_settings SET revision=revision+1,updated_at=clock_timestamp() WHERE singleton=true;
