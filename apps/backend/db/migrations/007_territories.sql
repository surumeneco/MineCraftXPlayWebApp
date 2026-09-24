-- Account-specific BlueMap colours are kept separate from the account master.
-- statement
CREATE TABLE account_bluemap_colors (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  red SMALLINT NOT NULL CHECK (red BETWEEN 0 AND 255),
  green SMALLINT NOT NULL CHECK (green BETWEEN 0 AND 255),
  blue SMALLINT NOT NULL CHECK (blue BETWEEN 0 AND 255),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- statement
CREATE TABLE territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_account_id UUID NOT NULL REFERENCES accounts(id),
  applicant_merge_origin UUID REFERENCES accounts(id),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('account','shared_area','administration','protected_area')),
  owner_account_id UUID REFERENCES accounts(id),
  owner_merge_origin UUID REFERENCES accounts(id),
  status TEXT NOT NULL CHECK (status IN ('pending','approved','returned','withdrawn','rejected')),
  first_applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  approved_at TIMESTAMPTZ,
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    (owner_type='account' AND owner_account_id IS NOT NULL)
    OR (owner_type<>'account' AND owner_account_id IS NULL)
  )
);
-- statement
CREATE INDEX territories_applicant_idx ON territories(applicant_account_id);
-- statement
CREATE INDEX territories_owner_idx ON territories(owner_account_id);
-- statement
CREATE INDEX territories_status_idx ON territories(status);
-- statement
CREATE TABLE territory_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
  application_type TEXT NOT NULL CHECK (application_type IN ('new','edit')),
  submitted_by_account_id UUID NOT NULL REFERENCES accounts(id),
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  coordinates JSONB NOT NULL CHECK (jsonb_typeof(coordinates)='array'),
  status TEXT NOT NULL CHECK (status IN ('pending','approved','returned','withdrawn','rejected')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  decided_at TIMESTAMPTZ,
  reason TEXT
);
-- statement
CREATE INDEX territory_applications_territory_idx
  ON territory_applications(territory_id, submitted_at DESC);
-- statement
CREATE UNIQUE INDEX territory_one_pending_application_idx
  ON territory_applications(territory_id) WHERE status='pending';
