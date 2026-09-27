-- Company colours are independent of the representative's account colour.
-- statement
CREATE TABLE company_bluemap_colors (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  red SMALLINT NOT NULL CHECK (red BETWEEN 0 AND 255),
  green SMALLINT NOT NULL CHECK (green BETWEEN 0 AND 255),
  blue SMALLINT NOT NULL CHECK (blue BETWEEN 0 AND 255),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- statement
-- Backfill existing companies with vivid HSV colours (S=100%, V=100%, random hue).
WITH hues AS (
  SELECT id, floor(random() * 360)::integer AS hue FROM companies
)
INSERT INTO company_bluemap_colors(company_id,red,green,blue)
SELECT id,
  (CASE
    WHEN hue < 60 THEN 255
    WHEN hue < 120 THEN round((120-hue) * 255.0 / 60)
    WHEN hue < 240 THEN 0
    WHEN hue < 300 THEN round((hue-240) * 255.0 / 60)
    ELSE 255
  END)::smallint,
  (CASE
    WHEN hue < 60 THEN round(hue * 255.0 / 60)
    WHEN hue < 180 THEN 255
    WHEN hue < 240 THEN round((240-hue) * 255.0 / 60)
    ELSE 0
  END)::smallint,
  (CASE
    WHEN hue < 120 THEN 0
    WHEN hue < 180 THEN round((hue-120) * 255.0 / 60)
    WHEN hue < 300 THEN 255
    ELSE round((360-hue) * 255.0 / 60)
  END)::smallint
FROM hues
ON CONFLICT (company_id) DO NOTHING;
