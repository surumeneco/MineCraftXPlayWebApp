-- Fill only unbound operator portraits. Older migration 011 may already be recorded,
-- so do not modify it or overwrite a previously assigned account.
-- statement
UPDATE operator_members o
SET account_id = matches.account_id
FROM (
  SELECT member.member_key, MIN(identity.account_id::text)::uuid AS account_id
  FROM operator_members member
  JOIN account_minecraft_identities identity
    ON lower(identity.username) = lower(member.minecraft_name)
    AND identity.edition IN ('je','be')
  JOIN accounts account
    ON account.id = identity.account_id AND account.retired_at IS NULL
  WHERE member.account_id IS NULL
  GROUP BY member.member_key
  HAVING COUNT(DISTINCT identity.account_id) = 1
) matches
WHERE o.member_key = matches.member_key AND o.account_id IS NULL;
