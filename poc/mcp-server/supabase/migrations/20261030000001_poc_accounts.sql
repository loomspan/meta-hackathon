-- POC Cloud internal accounts. Adds poc_accounts and renames identity
-- columns from Supabase user ID to internal account ID. No fixture row is
-- inserted, updated, or deleted by this migration.
CREATE TABLE poc_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_email text NOT NULL UNIQUE
    CHECK (normalized_email <> '' AND normalized_email = lower(btrim(normalized_email))),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE poc_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE poc_app_memberships RENAME COLUMN user_id TO account_id;
ALTER TABLE poc_tool_call_log RENAME COLUMN user_id TO account_id;
