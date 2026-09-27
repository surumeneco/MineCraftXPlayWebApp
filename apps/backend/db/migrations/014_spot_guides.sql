-- Public and tourist spot guides are separate from notice publication and site-image presets.
-- statement
CREATE TABLE spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('public','tourist')),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  body_delta JSONB NOT NULL DEFAULT '{"ops":[]}'::jsonb,
  main_image_id UUID REFERENCES images(id) ON DELETE RESTRICT,
  dimension TEXT CHECK (dimension IS NULL OR char_length(btrim(dimension)) BETWEEN 1 AND 100),
  pos_x INTEGER, pos_y INTEGER, pos_z INTEGER,
  territory_id UUID REFERENCES territories(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','unpublished')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  published_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CONSTRAINT spots_location_check CHECK (
    (kind='public' AND territory_id IS NULL) OR
    (kind='tourist' AND dimension IS NULL AND pos_x IS NULL AND pos_y IS NULL AND pos_z IS NULL)
  ),
  CONSTRAINT spots_publication_dates CHECK (
    (status='draft' AND published_at IS NULL) OR
    (status IN ('published','unpublished') AND published_at IS NOT NULL)
  )
);
-- statement
CREATE INDEX spots_public_order_idx ON spots(kind,sort_order,id) WHERE status='published';
-- statement
CREATE INDEX spots_tourist_date_idx ON spots(kind,published_at DESC,id) WHERE status='published';
-- statement
CREATE TABLE spot_tags (
  spot_id UUID NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
  PRIMARY KEY (spot_id,tag_id)
);
-- statement
CREATE INDEX spot_tags_tag_idx ON spot_tags(tag_id);
-- statement
CREATE TABLE spot_images (
  image_id UUID PRIMARY KEY REFERENCES images(id) ON DELETE CASCADE,
  spot_id UUID NOT NULL REFERENCES spots(id) ON DELETE CASCADE
);
-- statement
CREATE INDEX spot_images_spot_idx ON spot_images(spot_id);
-- statement
-- Preserve existing hub/card customizations; add the two new fixed destinations after notices.
UPDATE home_layout h SET data=jsonb_set(data,'{hubs}',
  (SELECT jsonb_agg(item ORDER BY place,rank) FROM (
    SELECT ordinal::INTEGER AS place,0 AS rank,element AS item
    FROM jsonb_array_elements(h.data->'hubs') WITH ORDINALITY AS existing(element,ordinal)
    UNION ALL
    SELECT ordinal::INTEGER,1,jsonb_build_object('key','info.public-spots','note','','image',null)
    FROM jsonb_array_elements(h.data->'hubs') WITH ORDINALITY AS existing(element,ordinal)
    WHERE element->>'key'='info.notice'
    UNION ALL
    SELECT ordinal::INTEGER,2,jsonb_build_object('key','info.tourist-spots','note','','image',null)
    FROM jsonb_array_elements(h.data->'hubs') WITH ORDINALITY AS existing(element,ordinal)
    WHERE element->>'key'='info.notice'
  ) expanded)
),revision=revision+1,updated_at=clock_timestamp()
WHERE singleton AND NOT data->'hubs' @> '[{"key":"info.public-spots"}]'::jsonb;
