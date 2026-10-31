-- POC fixture seed (synthetic data only, idempotent). No credentials are stored here.
-- The membership UUID below is a documented placeholder, not a real identity.
-- See poc/README.md "Test owner setup (dashboard)" for the replacement procedure.

INSERT INTO poc_apps (id, name, summary, current_version, environments)
VALUES ('grocery-list', 'Grocery List', 'A simple synthetic grocery list.', 1, '{production}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO poc_app_definitions (app_id, version, definition)
VALUES (
  'grocery-list',
  1,
  '{"operations":[{"name":"list_items","kind":"read","description":"Returns items in insertion order (ascending id).","arguments":[],"effect":{"action":"list","resource":"grocery_items","order":[{"field":"id","direction":"asc"}]}},{"name":"add_item","kind":"write","description":"Adds one item after validation.","arguments":[{"name":"name","type":"string","required":true,"min_length":1,"trim":true},{"name":"quantity","type":"integer","required":true,"minimum":1}],"effect":{"action":"insert","resource":"grocery_items","fields":["name","quantity"]}}]}'::jsonb
)
ON CONFLICT (app_id, version) DO NOTHING;

INSERT INTO poc_packs (id, kind, app_id, version, title, instructions)
VALUES (
  'build',
  'build',
  NULL,
  1,
  'Loomspan Build',
  'Loomspan Build guidance (Gate 1 placeholder). Gate 1 verifies that this Build pack can be retrieved and delivered. It does not implement a publishing workflow.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO poc_packs (id, kind, app_id, version, title, instructions)
VALUES (
  'run',
  'run',
  NULL,
  1,
  'Loomspan Run',
  'Loomspan Run guidance. Select Loomspan, discover apps with list_apps, load the selected app pack with get_pack, then call operations with call_operation using the current app version.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO poc_packs (id, kind, app_id, version, title, instructions)
VALUES (
  'grocery-list',
  'app',
  'grocery-list',
  1,
  'Grocery List',
  'Grocery List app guidance. When showing the list, present the items alphabetically with a count header such as "3 items" above the list. When adding an item and the quantity is not known, ask the user for a quantity instead of inventing one. Use list_items to read the list and add_item to add an item with a name and a quantity.'
)
ON CONFLICT (id) DO NOTHING;

-- Placeholder only: 00000000-0000-4000-8000-000000000001 is not a real identity.
-- It is a placeholder account ID, not a Supabase user ID.
INSERT INTO poc_app_memberships (app_id, account_id, role)
VALUES ('grocery-list', '00000000-0000-4000-8000-000000000001', 'owner')
ON CONFLICT (app_id, account_id) DO NOTHING;

INSERT INTO poc_grocery_items (app_id, name, quantity)
SELECT 'grocery-list', v.name, v.quantity
FROM (VALUES ('Oats', 2), ('Apples', 4), ('Milk', 1)) AS v(name, quantity)
WHERE NOT EXISTS (SELECT 1 FROM poc_grocery_items);
