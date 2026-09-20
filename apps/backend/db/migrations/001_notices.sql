-- Initial notice schema. Applied in order by scripts/migrate.mjs.
-- statement
CREATE TABLE notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT COLLATE "C" NOT NULL UNIQUE,
  body_delta JSONB NOT NULL DEFAULT '{"ops":[]}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'unpublished')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  published_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CONSTRAINT notices_publication_dates CHECK (
    (status = 'draft' AND published_at IS NULL) OR
    (status IN ('published', 'unpublished') AND published_at IS NOT NULL)
  ),
  CONSTRAINT notices_title_not_blank CHECK (char_length(title) > 0)
);
-- statement
CREATE INDEX notices_public_order_idx ON notices (published_at DESC, id) WHERE status = 'published';
-- statement
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 20),
  normalized_name TEXT COLLATE "C" NOT NULL UNIQUE
);
-- statement
CREATE TABLE notice_tags (
  notice_id UUID NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id),
  PRIMARY KEY (notice_id, tag_id)
);
-- statement
CREATE INDEX notice_tags_tag_idx ON notice_tags (tag_id);
-- statement
CREATE TABLE admin_users (
  discord_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- statement
CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL REFERENCES admin_users(discord_id) ON DELETE CASCADE,
  csrf_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- statement
CREATE INDEX admin_sessions_expiry_idx ON admin_sessions (expires_at);
-- statement
CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose TEXT NOT NULL CHECK (char_length(purpose) > 0),
  data BYTEA NOT NULL CHECK (octet_length(data) <= 5242880),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size INTEGER NOT NULL CHECK (size BETWEEN 1 AND 5242880),
  uploaded_by TEXT NOT NULL REFERENCES admin_users(discord_id),
  upload_session_id UUID,
  upload_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT images_upload_state CHECK ((upload_session_id IS NULL) = (upload_expires_at IS NULL))
);
-- statement
CREATE INDEX images_temporary_idx ON images (upload_expires_at) WHERE upload_session_id IS NOT NULL;
-- statement
CREATE TABLE notice_images (
  image_id UUID PRIMARY KEY REFERENCES images(id) ON DELETE CASCADE,
  notice_id UUID NOT NULL REFERENCES notices(id) ON DELETE CASCADE
);
-- statement
CREATE INDEX notice_images_notice_idx ON notice_images (notice_id);
