-- Store home and hub layouts independent of site-image presets.
-- statement
CREATE TABLE home_layout (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  revision BIGINT NOT NULL DEFAULT 1,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- statement
INSERT INTO home_layout(singleton,data) VALUES (true, $layout$
{
  "categories": [
    {"id":"legacy-quick-links","title":"クイックリンク","cards":[
      {"id":"legacy-ofuse","type":"custom","title":"ご支援はこちらから","note":"","url":"https://ofuse.me/mofupark","image":{"static_path":"/images/card-ofuse.jpg"},"new_tab":true},
      {"id":"legacy-bluemap","type":"custom","title":"Bluemapを見る","note":"","url":"/bluemap/","image":{"static_path":"/images/bluemap.png"},"new_tab":false}
    ]},
    {"id":"legacy-site-guide","title":"サイト案内","cards":[
      {"id":"legacy-info","type":"custom","title":"情報","note":"","url":"/info","image":null,"new_tab":false},
      {"id":"legacy-lists","type":"custom","title":"一覧","note":"","url":"/lists","image":null,"new_tab":false},
      {"id":"legacy-applications","type":"custom","title":"申請","note":"","url":"/applications","image":null,"new_tab":false}
    ]}
  ],
  "hubs": [
    {"key":"info.notice","note":"","image":null},
    {"key":"info.about","note":"","image":null},
    {"key":"info.operators","note":"","image":null},
    {"key":"info.server","note":"","image":null},
    {"key":"info.rules","note":"","image":null},
    {"key":"lists.territories","note":"","image":null},
    {"key":"applications.territories","note":"","image":null}
  ]
}
$layout$::jsonb);
-- statement
-- Snapshot each effective image on migration only; later preset changes do not affect layout.
DO $migration$
DECLARE item RECORD;
DECLARE asset JSONB;
DECLARE legacy_paths TEXT[];
DECLARE key_names TEXT[];
DECLARE h INTEGER;
BEGIN
  key_names := ARRAY['card.ofuse','card.bluemap','card.info','card.lists','card.applications'];
  legacy_paths := ARRAY['{categories,0,cards,0,image}','{categories,0,cards,1,image}',
    '{categories,1,cards,0,image}','{categories,1,cards,1,image}','{categories,1,cards,2,image}'];
  FOR h IN 1..array_length(key_names,1) LOOP
    SELECT CASE WHEN v.image_id IS NOT NULL THEN jsonb_build_object('image_id', v.image_id)
                WHEN v.static_path IS NOT NULL THEN jsonb_build_object('static_path', v.static_path)
                ELSE NULL END INTO asset
    FROM site_image_resources r CROSS JOIN site_image_settings s CROSS JOIN site_image_presets p
    LEFT JOIN site_image_preset_items base ON base.resource_id=r.id AND base.preset_id=p.id
    LEFT JOIN site_image_preset_items active ON active.resource_id=r.id AND active.preset_id=s.active_preset_id
    LEFT JOIN site_image_versions v ON v.id=CASE WHEN active.preset_id IS NOT NULL THEN active.version_id ELSE base.version_id END
    WHERE r.key=key_names[h] AND s.singleton AND p.is_default;
    IF asset IS NOT NULL THEN
      UPDATE home_layout SET data=jsonb_set(data,legacy_paths[h]::text[],asset) WHERE singleton;
    END IF;
  END LOOP;
  FOR item IN SELECT entry.image AS key, entry.group_name FROM (VALUES
    ('info','card.info'),('lists','card.lists'),('applications','card.applications')
  ) AS entry(group_name,image) LOOP
    SELECT CASE WHEN v.image_id IS NOT NULL THEN jsonb_build_object('image_id',v.image_id)
                WHEN v.static_path IS NOT NULL THEN jsonb_build_object('static_path',v.static_path)
                ELSE NULL END INTO asset
    FROM site_image_resources r CROSS JOIN site_image_settings s CROSS JOIN site_image_presets p
    LEFT JOIN site_image_preset_items base ON base.resource_id=r.id AND base.preset_id=p.id
    LEFT JOIN site_image_preset_items active ON active.resource_id=r.id AND active.preset_id=s.active_preset_id
    LEFT JOIN site_image_versions v ON v.id=CASE WHEN active.preset_id IS NOT NULL THEN active.version_id ELSE base.version_id END
    WHERE r.key=item.key AND s.singleton AND p.is_default;
    IF asset IS NOT NULL THEN
      FOR h IN 0..6 LOOP
        IF (SELECT data->'hubs'->h->>'key' FROM home_layout WHERE singleton) LIKE item.group_name||'.%' THEN
          UPDATE home_layout SET data=jsonb_set(data,ARRAY['hubs',h::text,'image'],asset) WHERE singleton;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $migration$;
-- statement
-- Account binding happens once by a unique existing JE Minecraft name, never at request time.
CREATE TABLE operator_members (
  member_key TEXT PRIMARY KEY,
  minecraft_name TEXT NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  merge_origin UUID REFERENCES accounts(id) ON DELETE RESTRICT,
  image_id UUID REFERENCES images(id) ON DELETE RESTRICT,
  static_path TEXT
);
-- statement
INSERT INTO operator_members(member_key,minecraft_name,static_path) VALUES
 ('surumeneco','surumeneco164','/images/operators/surumeneco.png'),
 ('zawazawa123','zawazawa123','/images/operators/zawazawa123.png'),
 ('loofgald','Loofgald','/images/operators/Loofgald.png'),
 ('rnad0','rnad0','/images/operators/rnad0.png'),
 ('shirokana','shirokana_22','/images/operators/shirokana.png');
-- statement
UPDATE operator_members o SET account_id=(
  SELECT (array_agg(m.account_id))[1] FROM account_minecraft_identities m
  JOIN accounts a ON a.id=m.account_id AND a.retired_at IS NULL
  WHERE m.edition='je' AND lower(m.username)=lower(o.minecraft_name)
  HAVING COUNT(DISTINCT m.account_id)=1
);
-- statement
UPDATE operator_members o SET
  image_id=COALESCE(v.image_id,o.image_id),
  static_path=CASE WHEN v.image_id IS NOT NULL THEN NULL ELSE COALESCE(v.static_path,o.static_path) END
FROM site_image_resources r CROSS JOIN site_image_settings s CROSS JOIN site_image_presets p
LEFT JOIN site_image_preset_items base ON base.resource_id=r.id AND base.preset_id=p.id
LEFT JOIN site_image_preset_items active ON active.resource_id=r.id AND active.preset_id=s.active_preset_id
LEFT JOIN site_image_versions v ON v.id=CASE WHEN active.preset_id IS NOT NULL THEN active.version_id ELSE base.version_id END
WHERE s.singleton AND p.is_default AND r.key='operator.'||o.member_key;
