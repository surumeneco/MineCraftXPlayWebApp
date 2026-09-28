-- Separate the notice and tourist-spot tag namespaces without renumbering notice tags.
-- statement
ALTER TABLE tags ADD COLUMN scope TEXT NOT NULL DEFAULT 'notice'
  CONSTRAINT tags_scope_check CHECK (scope IN ('notice','tourist'));
-- statement
ALTER TABLE tags DROP CONSTRAINT tags_normalized_name_key;
-- statement
ALTER TABLE tags ADD CONSTRAINT tags_scope_normalized_name_key UNIQUE (scope,normalized_name);
-- statement
-- Reproduce the existing display spelling for each tourist tag before redirecting its associations.
INSERT INTO tags(name,normalized_name,scope)
SELECT DISTINCT t.name,t.normalized_name,'tourist'
FROM tags t JOIN spot_tags st ON st.tag_id=t.id
ON CONFLICT (scope,normalized_name) DO NOTHING;
-- statement
UPDATE spot_tags st SET tag_id=tourist.id
FROM tags previous
JOIN tags tourist ON tourist.scope='tourist'
  AND tourist.normalized_name=previous.normalized_name
WHERE st.tag_id=previous.id AND previous.scope='notice';
-- statement
-- A previously shared tag that was only used by tourist spots must not remain
-- as a phantom suggestion in the notice namespace.
DELETE FROM tags t WHERE t.scope='notice'
  AND EXISTS (SELECT 1 FROM tags tourist WHERE tourist.scope='tourist'
    AND tourist.normalized_name=t.normalized_name)
  AND NOT EXISTS (SELECT 1 FROM notice_tags nt WHERE nt.tag_id=t.id);
