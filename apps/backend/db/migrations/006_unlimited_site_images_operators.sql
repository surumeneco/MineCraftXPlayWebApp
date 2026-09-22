-- Preserve the notice-image limits while removing site-image application size limits.
-- statement
ALTER TABLE images DROP CONSTRAINT images_data_check;
-- statement
ALTER TABLE images ADD CONSTRAINT images_data_check
  CHECK (purpose <> 'notice' OR octet_length(data) <= 5242880);
-- statement
ALTER TABLE images DROP CONSTRAINT images_size_check;
-- statement
ALTER TABLE images ALTER COLUMN size TYPE BIGINT;
-- statement
ALTER TABLE images ADD CONSTRAINT images_size_check
  CHECK (size >= 1 AND (purpose <> 'notice' OR size <= 5242880));
-- statement
ALTER TABLE site_image_versions DROP CONSTRAINT site_image_versions_static_path_check;
-- statement
ALTER TABLE site_image_versions ADD CONSTRAINT site_image_versions_static_path_check
  CHECK (static_path IN (
    '/images/discord.png', '/images/card-ofuse.jpg', '/images/bluemap.png',
    '/images/operators/surumeneco.png', '/images/operators/zawazawa123.png',
    '/images/operators/Loofgald.png', '/images/operators/rnad0.png',
    '/images/operators/shirokana.png'
  ));
-- statement
INSERT INTO site_image_resources(key, name, description) VALUES
  ('operator.surumeneco', '運営メンバー：スルメねこ。', '運営メンバー紹介の surumeneco164 画像'),
  ('operator.zawazawa123', '運営メンバー：カバ', '運営メンバー紹介の zawazawa123 画像'),
  ('operator.loofgald', '運営メンバー：Loofgald', '運営メンバー紹介の Loofgald 画像'),
  ('operator.rnad0', '運営メンバー：まど', '運営メンバー紹介の rnad0 画像'),
  ('operator.shirokana', '運営メンバー：Kana', '運営メンバー紹介の shirokana_22 画像');
-- statement
INSERT INTO site_image_versions(resource_id, version_number, name, note, static_path)
 SELECT r.id, 1, initial.name,
   '導入前の紹介画像。public/images/operators に保持される読み取り専用の初版。', initial.path
 FROM (VALUES
   ('operator.surumeneco', '初期画像：スルメねこ。', '/images/operators/surumeneco.png'),
   ('operator.zawazawa123', '初期画像：カバ', '/images/operators/zawazawa123.png'),
   ('operator.loofgald', '初期画像：Loofgald', '/images/operators/Loofgald.png'),
   ('operator.rnad0', '初期画像：まど', '/images/operators/rnad0.png'),
   ('operator.shirokana', '初期画像：Kana', '/images/operators/shirokana.png')
 ) AS initial(key, name, path) JOIN site_image_resources r ON r.key=initial.key;
-- statement
INSERT INTO site_image_preset_items(preset_id, resource_id, version_id)
 SELECT p.id, v.resource_id, v.id FROM site_image_presets p
 CROSS JOIN site_image_versions v JOIN site_image_resources r ON r.id=v.resource_id
 WHERE p.is_default AND r.key LIKE 'operator.%' AND v.static_path IS NOT NULL;
-- statement
UPDATE site_image_settings SET revision=revision+1, updated_at=clock_timestamp() WHERE singleton=true;
