-- Companies retain published values while an edit application is awaiting review.
-- statement
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  representative_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','returned','withdrawn','rejected')),
  current_name TEXT CHECK (current_name IS NULL OR char_length(btrim(current_name)) BETWEEN 1 AND 100),
  current_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  current_activities TEXT NOT NULL DEFAULT '',
  headquarters_territory_id UUID REFERENCES territories(id) ON DELETE RESTRICT,
  current_image_id UUID REFERENCES images(id) ON DELETE RESTRICT,
  introduction_delta JSONB NOT NULL DEFAULT '{"ops":[]}'::jsonb,
  first_applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  approved_at TIMESTAMPTZ,
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- statement
CREATE INDEX companies_representative_idx ON companies(representative_account_id);
-- statement
CREATE INDEX companies_status_idx ON companies(status);
-- statement
CREATE TABLE company_members (
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  PRIMARY KEY (company_id,account_id)
);
-- statement
CREATE INDEX company_members_account_idx ON company_members(account_id);
-- statement
CREATE TABLE company_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  application_type TEXT NOT NULL CHECK (application_type IN ('new','edit')),
  submitted_by_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  representative_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  activities TEXT NOT NULL CHECK (char_length(btrim(activities)) BETWEEN 1 AND 20000),
  status TEXT NOT NULL CHECK (status IN ('pending','approved','returned','withdrawn','rejected')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  decided_at TIMESTAMPTZ,
  reason TEXT
);
-- statement
CREATE INDEX company_applications_company_idx ON company_applications(company_id,submitted_at DESC);
-- statement
CREATE UNIQUE INDEX company_one_pending_application_idx
  ON company_applications(company_id) WHERE status='pending';
-- statement
CREATE TABLE company_operations (
  operation_id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  operation_kind TEXT NOT NULL CHECK (operation_kind IN ('create','reapply','edit','withdraw','approve','return','reject')),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- statement
CREATE INDEX company_operations_company_idx ON company_operations(company_id,completed_at DESC);
-- statement
ALTER TABLE territories DROP CONSTRAINT territories_owner_type_check;
-- statement
ALTER TABLE territories ADD CONSTRAINT territories_owner_type_check
  CHECK (owner_type IN ('account','company','shared_area','administration','protected_area'));
-- statement
ALTER TABLE territories ADD COLUMN owner_company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
-- statement
ALTER TABLE territories ADD CONSTRAINT territories_company_owner_check
  CHECK ((owner_type='company')=(owner_company_id IS NOT NULL));
-- statement
CREATE INDEX territories_company_owner_idx ON territories(owner_company_id);
-- statement
ALTER TABLE territory_change_history ADD COLUMN old_owner_company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
-- statement
ALTER TABLE territory_change_history ADD COLUMN new_owner_company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
-- statement
UPDATE home_layout SET
  data=jsonb_set(data,'{hubs}',data->'hubs' ||
    '[{"key":"lists.companies","note":"","image":null},{"key":"applications.companies","note":"","image":null}]'::jsonb),
  revision=revision+1,updated_at=clock_timestamp()
WHERE singleton AND NOT data->'hubs' @> '[{"key":"lists.companies"}]'::jsonb;

-- statement
-- Reversible account merging follows the existing account/territory provenance contract.
ALTER TABLE companies ADD COLUMN applicant_merge_origin UUID REFERENCES accounts(id) ON DELETE RESTRICT;
-- statement
ALTER TABLE companies ADD COLUMN representative_merge_origin UUID REFERENCES accounts(id) ON DELETE RESTRICT;
-- statement
ALTER TABLE company_members ADD COLUMN merge_origin UUID REFERENCES accounts(id) ON DELETE RESTRICT;
-- statement
ALTER TABLE company_applications ADD COLUMN representative_merge_origin UUID REFERENCES accounts(id) ON DELETE RESTRICT;
