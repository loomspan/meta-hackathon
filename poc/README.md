# Loomspan POC — Foundation Fixture (Ticket 1)

Purpose: self-contained foundation for the Loomspan companion feasibility POC (Gate 1). This ticket provides the repository scaffold and the Postgres grocery-list fixture only. Status: scaffold and fixture files are present in this repository; Supabase dashboard preflight is **developer-to-perform** (see below) and has **not** been live-verified by automation. No live external service was contacted while building this fixture.

Existing Supabase project (do not replace): Loomspan Testing at `https://yjrwyfkybszlpufsflan.supabase.co`.

## Supabase preflight evidence

Recorded honestly: the three items below are **NOT VERIFIED — developer dashboard action required**. No dashboard observation has been transcribed yet, so acceptance criterion 1 is not passed. Do not treat this fixture as buildable on the hosted project until the developer completes this table. If any item cannot be enabled, record it as `BLOCKER — authentication/integration blocker, cause unconfirmed`, stop, and escalate for a developer decision; do not design around it and do not create a replacement project.

| Item | Dashboard location | Observed state | Verified by | Date |
| --- | --- | --- | --- | --- |
| OAuth 2.1 authorization server can be enabled | Authentication > OAuth Server | NOT VERIFIED — developer to perform: confirm the toggle is present, enable it if off, and record the Authorization Path and Site URL seen | — | — |
| Dynamic client registration can be turned on | Authentication > OAuth Server | NOT VERIFIED — developer to perform: turn on dynamic client registration and note the open-registration caution (any MCP client may register) | — | — |
| JWT signing is asymmetric (ES256 or RS256), not HS256 | Authentication > JWT Signing Keys | NOT VERIFIED — developer to perform: record the current signing algorithm and key id fingerprint (first/last 4 characters only); if on legacy HS256, the developer decides if/when to migrate given the project-wide token impact | — | — |

Redaction rule: record toggle state, Authorization Path, Site URL, signing algorithm, and key id fingerprint only. Never record access or refresh tokens, client secrets, the JWT secret, anon or service-role key values, or the test owner credentials.

## Repository layout

- `poc/mcp-server/` — Supabase config, migrations, seed, and tests for the fixture (Edge Function code is ticket 2; `supabase/functions/mcp/` is a placeholder).
- `poc/web/` — placeholder only in this ticket; onboarding and consent pages are ticket 3.
- `poc/fixtures/expected-fixture.json` — machine-readable expectations used by the automated tests.
- `poc/README.md` — this file.

Nothing POC-related is added at the project root. The sole root addition is `.gitignore` (repository hygiene protecting against accidental secret commits).

## Local fixture setup

Automated verification uses a throwaway local Docker Postgres only. It never contacts the hosted project.

```powershell
docker run --name loomspan-poc-pg -e POSTGRES_PASSWORD=poc-local-only -p 54329:5432 -d postgres:16
# Wait until Postgres accepts connections; the first psql below fails if run before the server is ready (notably when the image is already cached).
do { docker exec loomspan-poc-pg pg_isready -U postgres; $ready = ($LASTEXITCODE -eq 0); if (-not $ready) { Start-Sleep -Seconds 1 } } while (-not $ready)
Get-Content poc/mcp-server/supabase/migrations/20261027000001_poc_fixture_schema.sql | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1
Get-Content poc/mcp-server/supabase/seed.sql | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1
Get-Content poc/mcp-server/tests/fixture.assertions.sql | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1
# Re-run the seed once to prove idempotency, then re-run the assertions.
Get-Content poc/mcp-server/supabase/seed.sql | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1
Get-Content poc/mcp-server/tests/fixture.assertions.sql | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1
docker rm -f loomspan-poc-pg
node --test poc/mcp-server/tests/structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs
```

`poc-local-only` is a throwaway container-only password for the local Docker container; it is not a real credential. Applying the migration and seed to the hosted Loomspan Testing project is a developer-run step (Supabase CLI or dashboard SQL editor) with no connection string or key printed here.

## Test owner setup (dashboard)

Developer-to-perform on the hosted project. Until this is done, the hosted membership row points at the placeholder UUID `00000000-0000-4000-8000-000000000001`, which is not a real identity, and no authenticated-owner pass may be claimed. The local from-empty proof verifies only the placeholder row shape.

1. In the Loomspan Testing dashboard, create the synthetic test owner under Authentication > Users (for example `poc-owner@example.invalid`). Set the password in the dashboard only; never record it here or anywhere in the repository.
2. Copy the new user UUID from Authentication > Users.
3. Apply the migration and seed to the hosted project, then run this replacement statement with the real UUID substituted:

```sql
UPDATE poc_app_memberships SET user_id = '<paste-real-uuid>' WHERE app_id = 'grocery-list' AND user_id = '00000000-0000-4000-8000-000000000001';
```

4. Confirm one membership row exists for the real UUID and record the date here (no credentials).

## Definition effect update for an already-seeded hosted database

Fresh seeds need no update: `seed.sql` already carries the v1 `effect` descriptors. Run the statement below only if the hosted project was seeded before ticket 2 (the seed is `ON CONFLICT DO NOTHING`, so re-running it will not add `effect` to an existing row). Raw arguments and tokens are never part of this statement.

```sql
UPDATE poc_app_definitions SET definition = '{"operations":[{"name":"list_items","kind":"read","description":"Returns items in insertion order (ascending id).","arguments":[],"effect":{"action":"list","resource":"grocery_items","order":[{"field":"id","direction":"asc"}]}},{"name":"add_item","kind":"write","description":"Adds one item after validation.","arguments":[{"name":"name","type":"string","required":true,"min_length":1,"trim":true},{"name":"quantity","type":"integer","required":true,"minimum":1}],"effect":{"action":"insert","resource":"grocery_items","fields":["name","quantity"]}}]}'::jsonb WHERE app_id = 'grocery-list' AND version = 1;
SELECT definition FROM poc_app_definitions WHERE app_id = 'grocery-list' AND version = 1;
```

## MCP server (Ticket 2): local serve, deploy, and hosted verification

One self-built MCP Edge Function in `poc/mcp-server/supabase/functions/mcp/` serves exactly `list_apps`, `get_pack`, and `call_operation` over Streamable HTTP. Hosted endpoint: `https://yjrwyfkybszlpufsflan.supabase.co/functions/v1/mcp`. Operation execution is driven by the stored definition's `effect` descriptors, so a database-only definition update (for example adding a delete operation in ticket 4) needs no function code change and no redeploy.

Prerequisites: Deno, Supabase CLI 2.117.0 or later, Docker, Node 20 or later. None of the hosted steps below is automated; tokens are held only in shell environment variables and are never committed, logged, or recorded here.

### Local run

```powershell
cd poc/mcp-server
supabase start
supabase functions serve mcp
# Endpoint: http://127.0.0.1:54321/functions/v1/mcp
```

Unauthenticated probe (expect HTTP 401 with a `WWW-Authenticate` header):

```powershell
curl.exe -i -X POST 'http://127.0.0.1:54321/functions/v1/mcp' -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}'
```

### Hosted deploy (developer-performed)

First complete the preflight table above (or record the blocker and stop), apply the migration and seed to the hosted project, run the definition effect update above if the hosted database was already seeded, create the test owner and replace the placeholder membership UUID (see "Test owner setup"), and create a second signed-in user with no membership row for the non-member checks.

```powershell
cd poc/mcp-server
supabase link --project-ref yjrwyfkybszlpufsflan
supabase config push
supabase functions deploy mcp
```

### Direct-token acquisition (developer-performed)

Ticket 2 may be verified with tokens obtained through Supabase Auth directly; the companion OAuth/consent proof is ticket 3. Obtain an access token for the owner and for the non-member via the Auth token endpoint (`POST https://yjrwyfkybszlpufsflan.supabase.co/auth/v1/token?grant_type=password` with the public anon key in the `apikey` header and the user's email/password as JSON), and hold each token only in a shell environment variable (for example `$env:POC_OWNER_TOKEN`). Never paste a token value into this repository, a log, or a chat transcript.

### Hosted acceptance sequence (developer-performed, record redacted results)

1. Owner `list_apps` returns the grocery summary without instructions; an unauthenticated call returns 401.
2. `get_pack` returns the Build, Run, and grocery packs by ID; only the grocery pack carries operation/argument definitions.
3. Owner lists items in insertion order, adds an item, and sees it persist in a later list.
4. An add with an empty name or invalid quantity mutates nothing and returns actionable guidance.
5. After a scratch version bump, a call carrying the previous `app_version` mutates nothing and returns `stale_version` with the current version and reload guidance; restore the version afterwards.
6. A signed-in non-member cannot list or mutate grocery items.
7. Inspect `poc_tool_call_log` for entries covering the calls above and confirm no credential or token value is stored.

Record only dates, status codes, `error_code` values, and log row counts. Companion OAuth/consent proof is ticket 3; Gate 1 scoring (G1.1-G1.7) is ticket 4.

## What this ticket does not do

- Ticket 1 created only the log table; the MCP server, operation executor, and tool-call log writer are ticket 2 (see "MCP server (Ticket 2)" above).
- No web, onboarding, or consent pages (ticket 3).
- No Gate 1 run, version-2 update, Gate 2 tools or apps, participant identity, billing, invitations, or production schema design.
- Only synthetic grocery data is used.
