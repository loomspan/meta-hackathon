-- Fixture assertions: run after migration + seed on an empty Postgres schema.
-- Any failure raises an exception so psql -v ON_ERROR_STOP=1 exits non-zero.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM poc_apps WHERE id = 'grocery-list' AND current_version = 1) THEN
    RAISE EXCEPTION 'grocery app row with current_version = 1 missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM poc_app_definitions d
    WHERE d.app_id = 'grocery-list' AND d.version = 1
      AND d.definition @> '{"operations":[{"name":"list_items","kind":"read","arguments":[]}]}'::jsonb
  ) THEN
    RAISE EXCEPTION 'list_items read operation with no arguments missing from definition v1';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM poc_app_definitions d
    WHERE d.app_id = 'grocery-list' AND d.version = 1
      AND d.definition @> '{"operations":[{"name":"add_item","kind":"write","arguments":[{"name":"name","type":"string","required":true,"min_length":1,"trim":true},{"name":"quantity","type":"integer","required":true,"minimum":1}]}]}'::jsonb
  ) THEN
    RAISE EXCEPTION 'add_item write operation with argument definitions missing from definition v1';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM poc_app_definitions d
    WHERE d.app_id = 'grocery-list' AND d.version = 1
      AND d.definition @> '{"operations":[{"name":"list_items","effect":{"action":"list","resource":"grocery_items","order":[{"field":"id","direction":"asc"}]}}]}'::jsonb
  ) THEN
    RAISE EXCEPTION 'list_items effect missing from definition v1';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM poc_app_definitions d
    WHERE d.app_id = 'grocery-list' AND d.version = 1
      AND d.definition @> '{"operations":[{"name":"add_item","effect":{"action":"insert","resource":"grocery_items","fields":["name","quantity"]}}]}'::jsonb
  ) THEN
    RAISE EXCEPTION 'add_item effect missing from definition v1';
  END IF;

  IF EXISTS (
    SELECT 1 FROM poc_app_definitions d
    WHERE d.app_id = 'grocery-list' AND d.version = 1
      AND (d.definition::text ILIKE '%alphabetical%' OR d.definition::text ~* 'ask[^"]*quantity')
  ) THEN
    RAISE EXCEPTION 'pack-only presentation rule leaked into app definition';
  END IF;

  IF (SELECT count(*) FROM poc_packs) <> 3 THEN
    RAISE EXCEPTION 'expected exactly 3 packs';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM poc_packs WHERE id = 'build' AND kind = 'build' AND version = 1) THEN
    RAISE EXCEPTION 'build pack not retrievable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM poc_packs WHERE id = 'run' AND kind = 'run' AND version = 1) THEN
    RAISE EXCEPTION 'run pack not retrievable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM poc_packs WHERE id = 'grocery-list' AND kind = 'app' AND app_id = 'grocery-list' AND version = 1) THEN
    RAISE EXCEPTION 'grocery pack not retrievable';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM poc_packs WHERE id = 'grocery-list'
      AND instructions ILIKE '%alphabetical%'
      AND instructions ILIKE '%count%'
      AND instructions ~* 'ask.*quantity'
  ) THEN
    RAISE EXCEPTION 'grocery pack missing alphabetical/count/ask-for-quantity rules';
  END IF;

  IF EXISTS (
    SELECT 1 FROM poc_packs WHERE id IN ('build', 'run')
      AND (instructions ILIKE '%alphabetical%' OR instructions ~* 'ask.*quantity')
  ) THEN
    RAISE EXCEPTION 'grocery presentation rule leaked into Build/Run pack';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM poc_app_memberships WHERE app_id = 'grocery-list' AND role = 'owner') THEN
    RAISE EXCEPTION 'owner membership row missing';
  END IF;

  IF (SELECT string_agg(name, ',' ORDER BY id) FROM poc_grocery_items) <> 'Oats,Apples,Milk' THEN
    RAISE EXCEPTION 'items in insertion order are not Oats,Apples,Milk';
  END IF;
  IF (SELECT string_agg(name, ',' ORDER BY name) FROM poc_grocery_items) = 'Oats,Apples,Milk' THEN
    RAISE EXCEPTION 'insertion order must differ from alphabetical order';
  END IF;
  IF (SELECT string_agg(quantity::text, ',' ORDER BY id) FROM poc_grocery_items) <> '2,4,1' THEN
    RAISE EXCEPTION 'item quantities are not 2,4,1 in insertion order';
  END IF;

  IF (SELECT count(*) FROM poc_tool_call_log) <> 0 THEN
    RAISE EXCEPTION 'tool_call_log must start empty';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'poc_tool_call_log'
      AND (column_name ILIKE '%token%' OR column_name ILIKE '%secret%'
           OR column_name ILIKE '%credential%' OR column_name ILIKE '%password%')
  ) THEN
    RAISE EXCEPTION 'tool_call_log must not have credential-like columns';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_name = 'poc_tool_call_log'
        AND column_name IN ('user_id', 'app_id', 'operation', 'app_version', 'outcome', 'created_at')) <> 6 THEN
    RAISE EXCEPTION 'tool_call_log missing required columns user/app/operation/app_version/outcome/timestamp';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'poc_tool_call_log' AND column_name = 'user_id' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'tool_call_log.user_id must be nullable for rejected/unauthenticated calls';
  END IF;
END $$;

-- Validation at rest: each invalid insert must raise a check violation.
DO $$
BEGIN
  BEGIN
    INSERT INTO poc_grocery_items (name, quantity) VALUES ('', 1);
    RAISE EXCEPTION 'empty name was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO poc_grocery_items (name, quantity) VALUES ('   ', 1);
    RAISE EXCEPTION 'whitespace-only name was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO poc_grocery_items (name, quantity) VALUES ('X', 0);
    RAISE EXCEPTION 'zero quantity was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO poc_grocery_items (name, quantity) VALUES ('X', -3);
    RAISE EXCEPTION 'negative quantity was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- Valid boundary control (quantity 1) inside a rolled-back transaction.
BEGIN;
INSERT INTO poc_grocery_items (name, quantity) VALUES ('Control', 1);
ROLLBACK;

DO $$
BEGIN
  IF (SELECT count(*) FROM poc_grocery_items) <> 3 THEN
    RAISE EXCEPTION 'item count changed after validation probes';
  END IF;
  IF (SELECT count(*) FROM poc_apps) <> 1
     OR (SELECT count(*) FROM poc_app_definitions) <> 1
     OR (SELECT count(*) FROM poc_packs) <> 3
     OR (SELECT count(*) FROM poc_app_memberships) <> 1 THEN
    RAISE EXCEPTION 'unexpected row counts (seed idempotency check after re-run)';
  END IF;
END $$;
