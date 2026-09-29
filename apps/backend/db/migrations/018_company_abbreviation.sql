-- Optional company abbreviation is reviewed together with the official name.
-- statement
ALTER TABLE companies ADD COLUMN current_abbreviation TEXT
  CHECK (current_abbreviation IS NULL OR
    (char_length(btrim(current_abbreviation)) BETWEEN 1 AND 100
      AND current_abbreviation = btrim(current_abbreviation)));
-- statement
ALTER TABLE company_applications ADD COLUMN abbreviation TEXT
  CHECK (abbreviation IS NULL OR
    (char_length(btrim(abbreviation)) BETWEEN 1 AND 100
      AND abbreviation = btrim(abbreviation)));
