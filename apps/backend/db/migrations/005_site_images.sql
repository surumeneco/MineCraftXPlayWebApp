-- Site images share the existing immutable image blob store with notice images.
-- statement
ALTER TABLE images DROP CONSTRAINT images_mime_type_check;
-- statement
ALTER TABLE images ADD CONSTRAINT images_mime_type_check CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'));
-- statement
CREATE TABLE site_image_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT COLLATE "C" NOT NULL UNIQUE CHECK (char_length(key) BETWEEN 3 AND 80 AND key ~ '^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$'),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  created_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- statement
CREATE TABLE site_image_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES site_image_resources(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  image_id UUID UNIQUE REFERENCES images(id) ON DELETE RESTRICT,
  static_path TEXT CHECK (static_path IN ('/images/discord.png', '/images/card-ofuse.jpg', '/images/bluemap.png')),
  uploaded_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT site_image_version_source CHECK ((image_id IS NULL) <> (static_path IS NULL)),
  UNIQUE (resource_id, version_number),
  UNIQUE (resource_id, id)
);
-- statement
CREATE TABLE site_image_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- statement
CREATE UNIQUE INDEX site_image_one_default_idx ON site_image_presets(is_default) WHERE is_default;
-- statement
CREATE TABLE site_image_preset_items (
  preset_id UUID NOT NULL REFERENCES site_image_presets(id) ON DELETE RESTRICT,
  resource_id UUID NOT NULL REFERENCES site_image_resources(id) ON DELETE RESTRICT,
  version_id UUID,
  PRIMARY KEY (preset_id, resource_id),
  FOREIGN KEY (resource_id, version_id) REFERENCES site_image_versions(resource_id, id) ON DELETE RESTRICT
);
-- statement
CREATE TABLE site_image_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  active_preset_id UUID NOT NULL REFERENCES site_image_presets(id) ON DELETE RESTRICT,
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- statement
CREATE TABLE site_image_preset_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  previous_preset_id UUID NOT NULL REFERENCES site_image_presets(id) ON DELETE RESTRICT,
  next_preset_id UUID NOT NULL REFERENCES site_image_presets(id) ON DELETE RESTRICT,
  applied_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- statement
INSERT INTO site_image_resources(key, name, description) VALUES
 ('site.logo', 'サイトロゴ', '未設定時は既存のテキストロゴを表示'),
 ('site.background', 'サイト背景', '未設定時は既存のグラデーションを表示'),
 ('site.header.background', 'ヘッダーメニュー背景', '未設定時は単色表示'),
 ('card.discord', 'Discord参加カード', 'ホームの参加カード'),
 ('card.ofuse', 'OFUSE支援カード', 'ホームの支援カード'),
 ('card.bluemap', 'BlueMapカード', 'ホームの地図カード');
-- statement
INSERT INTO site_image_presets(name, description, is_default) VALUES ('通常設定', '常設画像の構成', true);
-- statement
INSERT INTO site_image_settings(singleton, active_preset_id)
 SELECT true, id FROM site_image_presets WHERE is_default;
-- statement
INSERT INTO site_image_versions(resource_id, version_number, name, note, static_path)
 SELECT r.id, 1, s.name, '導入前の画像。public/images に保持される読み取り専用の初版。', s.path
 FROM (VALUES
  ('card.discord', '初期Discordカード', '/images/discord.png'),
  ('card.ofuse', '初期OFUSEカード', '/images/card-ofuse.jpg'),
  ('card.bluemap', '初期BlueMapカード', '/images/bluemap.png')
 ) AS s(key, name, path) JOIN site_image_resources r ON r.key=s.key;
-- statement
INSERT INTO site_image_preset_items(preset_id, resource_id, version_id)
 SELECT p.id, v.resource_id, v.id FROM site_image_presets p
 CROSS JOIN site_image_versions v WHERE p.is_default AND v.static_path IS NOT NULL;
