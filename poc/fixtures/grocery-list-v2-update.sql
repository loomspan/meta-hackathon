-- Gate 1 version-2 fixture update (ticket 2026-10-27-04, G1.6/G1.7).
-- DB-definition-only update: adds remove_item to the grocery app and bumps
-- it from version 1 to version 2. Applying this file changes no Edge
-- Function code, requires no Edge Function redeploy, no companion
-- reconnect, and no MCP tool change: call_operation reads the operation
-- definitions from poc_app_definitions at the app's current version.
--
-- Apply once, mid-run, after G1.5 and before G1.6, through the same
-- developer-run channel used for the seed (Supabase dashboard SQL editor
-- or CLI against the hosted Loomspan Testing project). Never record any
-- credential used to apply it. Safe to re-run: every statement is guarded
-- so a second application is a no-op (the definition insert is
-- ON CONFLICT DO NOTHING and both updates only match version 1 rows).
--
-- Expected effect after applying:
--   * poc_apps.current_version for 'grocery-list' is 2.
--   * poc_app_definitions has a ('grocery-list', 2) row whose definition
--     adds remove_item (delete effect matched by exact item name).
--   * poc_packs 'grocery-list' is version 2 and its instructions name
--     remove_item while keeping the pack-only presentation rules
--     (alphabetical presentation with a count header; ask for a missing
--     quantity instead of inventing one). Those rules stay in the pack
--     only, never in the definition.
-- A call_operation still carrying app_version 1 after this update is
-- rejected with stale_version before any mutation (G1.7).

BEGIN;

INSERT INTO poc_app_definitions (app_id, version, definition)
VALUES (
  'grocery-list',
  2,
  '{"operations":[{"name":"list_items","kind":"read","description":"Returns items in insertion order (ascending id).","arguments":[],"effect":{"action":"list","resource":"grocery_items","order":[{"field":"id","direction":"asc"}]}},{"name":"add_item","kind":"write","description":"Adds one item after validation.","arguments":[{"name":"name","type":"string","required":true,"min_length":1,"trim":true},{"name":"quantity","type":"integer","required":true,"minimum":1}],"effect":{"action":"insert","resource":"grocery_items","fields":["name","quantity"]}},{"name":"remove_item","kind":"write","description":"Removes the item with the exact given name.","arguments":[{"name":"name","type":"string","required":true,"min_length":1,"trim":true}],"effect":{"action":"delete","resource":"grocery_items","match":["name"]}}]}'::jsonb
)
ON CONFLICT (app_id, version) DO NOTHING;

UPDATE poc_apps
SET current_version = 2
WHERE id = 'grocery-list' AND current_version = 1;

UPDATE poc_packs
SET version = 2,
    instructions = 'Grocery List app guidance. When showing the list, present the items alphabetically with a count header such as "3 items" above the list. When adding an item and the quantity is not known, ask the user for a quantity instead of inventing one. Use list_items to read the list, add_item to add an item with a name and a quantity, and remove_item to remove an item by its exact name.'
WHERE id = 'grocery-list' AND version = 1;

COMMIT;

-- Post-apply verification (read-only; record only versions, operation
-- names, and counts -- never credentials or tokens):
--   SELECT current_version FROM poc_apps WHERE id = 'grocery-list';  -- expect 2
--   SELECT version FROM poc_packs WHERE id = 'grocery-list';         -- expect 2
--   SELECT definition -> 'operations' FROM poc_app_definitions
--     WHERE app_id = 'grocery-list' AND version = 2;                 -- expect list_items, add_item, remove_item
