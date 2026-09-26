-- Territory-level concept is independent from the review workflow.
-- statement
ALTER TABLE territories ADD COLUMN development_concept TEXT NOT NULL DEFAULT '';
-- statement
ALTER TABLE territory_applications ADD COLUMN note TEXT NOT NULL DEFAULT '';
-- statement
UPDATE territory_applications SET note=reason WHERE status IN ('returned','rejected') AND reason IS NOT NULL;
