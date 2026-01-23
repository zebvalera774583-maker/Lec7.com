-- Ensure unique email regardless of case
-- Check for duplicates before creating index
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT lower(email) AS le, count(*) AS c
      FROM "User"
      GROUP BY lower(email)
      HAVING count(*) > 1
    ) t
  ) THEN
    RAISE EXCEPTION 'Duplicate emails found by lower(email). Resolve duplicates before applying this migration.';
  END IF;
END $$;

-- Create unique index on lower(email)
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_lower_key"
ON "User" (lower(email));
