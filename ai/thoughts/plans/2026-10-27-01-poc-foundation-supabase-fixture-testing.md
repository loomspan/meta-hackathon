# POC Foundation: Supabase Preflight, Scaffold, and Grocery Fixture Testing Plan

## Change Summary
New `poc/` scaffold (README, placeholders, fixtures expectation file), one Postgres migration creating six `poc_`-prefixed tables, an idempotent seed storing the grocery app definition v1 (`list_items`/`add_item` + argument definitions), Build/Run/grocery packs, a placeholder owner-membership row, synthetic non-alphabetically-ordered items, and an empty tool-call log table. No server code, web pages, or live-service automation. Implementation plan: `ai/thoughts/plans/2026-10-27-01-poc-foundation-supabase-fixture.md`.

## Impacted Areas and Risks
| Category | Risk | Planned evidence |
| --- | --- | --- |
| Persisted contract | Definition/pack/version shape breaks ticket 2 executor or ticket 4 DB-only v2 update | SQL assertions on stored JSONB operations/argument definitions, `current_version`, per-pack retrievability |
| Presentation-rule leakage | Alphabetical/count/ask-quantity rules leak into definition or Build/Run packs, or server data orders alphabetically | Positive phrase assertion on grocery pack; negative assertions on definition + Build/Run; insertion-order ≠ name-order assertion |
| Validation at rest | Empty/whitespace name or non-positive quantity can be stored, contradicting ticket `:19` | Exception-expecting `DO` blocks for `('',1)`, `('   ',1)`, `('X',0)`, `('X',-1)` |
| Membership | Placeholder UUID reported as a real authenticated owner; or no membership row after recreation | Shape assertion locally; README/dashboard check (optional, nonblocking) for the real-UUID replacement; explicit no-pass-claim rule below |
| Secret hygiene | Key/token/password committed in scaffold, SQL, README, or a local `.env` | Automated secret-scan test over `poc/`; empty-value `.env.example` assertion; `.gitignore` coverage assertion |
| Recreation | Migration/seed fails on empty schema, is non-idempotent, or depends on Supabase `auth` schema | Fresh Docker Postgres run with `ON_ERROR_STOP=1`; seed re-run; plain-`postgres:16` (no Supabase extensions) proves portability |
| Preflight evidence | Live verification claimed that was never done, or secrets transcribed | No automated live check exists by design; structure test only asserts the redacted table section/rows exist; developer dashboard observation is the sole criterion-1 evidence |

## Existing Coverage and Environment Constraints
- Existing tests: none. No test runner, `package.json`, CI, fixtures, or SQL tooling in the repo (research §Existing Tests and Fixtures). This plan creates the repo's first tests; conventions chosen are dependency-free so no install step is invented.
- Test stack: Node `v24.22.1` built-in `node:test` + `node:assert` for file/structure/secret/content checks (`.mjs`, runnable without `package.json`); SQL assertions executed by `psql` inside the official `postgres:16` Docker image for persistence behavior. Docker `29.8.1` present on this machine.
- Not available and not required: Supabase CLI, local `psql`, Deno. No test installs them.
- Hard constraints: no test contacts `https://yjrwyfkybszlpufsflan.supabase.co` or any live service, uses a real credential, or writes outside a throwaway local Docker container on port `54329` with container-only password `poc-local-only`. Hosted-project steps are developer-only and are never automated gates.
- Active design-lens guardrails: none recorded; nothing additional to cover.

## Failing Test First
- Name: `poc scaffold exists with required structure`
- Type: Node built-in unit/structure test (new behavior — first acceptance test demonstrating the missing capability)
- Location: `poc/mcp-server/tests/structure.test.mjs`
- Arrange/Act/Assert: Arrange — clean repo with no `poc/`. Act — run `node --test poc/mcp-server/tests/structure.test.mjs` (test file itself is added with the implementation; to demonstrate red first, Step 4 adds this test before the scaffold files). Assert — existence of `poc/README.md`, `poc/mcp-server/supabase/config.toml`, `poc/mcp-server/supabase/migrations/`, `poc/mcp-server/supabase/seed.sql`, `poc/mcp-server/supabase/functions/mcp/.gitkeep`, `poc/web/.gitkeep`, `poc/fixtures/expected-fixture.json`.
- Expected pre-fix failure: test fails/errors with missing-path assertion (`poc/README.md does not exist`) because the scaffold does not exist yet — the intended red reason, not a harness error. The SQL counterpart (`fixture.assertions.sql` against an empty database) likewise fails pre-implementation because the `poc_*` tables do not exist.

## Tests to Add or Update

### 1. `structure.test.mjs` — scaffold layout and root cleanliness
- Type: Node unit/structure test
- Location: `poc/mcp-server/tests/structure.test.mjs`
- Proves: Acceptance criterion 2 — exact `poc/` layout; `poc/web/` and `functions/mcp/` contain only `.gitkeep` placeholders (no ticket 2/3 content smuggled in); no POC file at repo root (only `.gitignore` may be added there); `poc/README.md` contains the preflight-evidence section with three item rows and the Test-owner-setup and Local-fixture-setup sections.
- Inputs/fixture: the working tree itself; expected path list inline in the test.
- Doubles or boundary isolation: none; read-only filesystem reads.
- Edge cases: fails if a `poc`-named file/dir appears at root, if `poc/web/` gains any non-placeholder file, or if README preflight rows are missing.

### 2. `structure.test.mjs` — definition and pack source content
- Type: Node unit/content test (same file, separate cases)
- Location: `poc/mcp-server/tests/structure.test.mjs`
- Proves: Criterion 4 at source level — `seed.sql` grocery pack text contains `alphabetical` + count-header + ask-for-quantity phrasing; the definition JSONB text and Build/Run pack text contain neither `alphabetical` nor the ask-for-quantity phrase; no `ORDER BY name` (case-insensitive) anywhere in migration or seed; `expected-fixture.json` parses and its item order is Oats, Apples, Milk.
- Inputs/fixture: `poc/mcp-server/supabase/seed.sql`, `poc/mcp-server/supabase/migrations/20261027000001_poc_fixture_schema.sql`, `poc/fixtures/expected-fixture.json`.
- Doubles or boundary isolation: none; the stored-record (DB-level) counterpart is test 4 — source assertions alone are not accepted as criterion-4 proof.
- Edge cases: phrase checks are case-insensitive; whitespace-only differences tolerated, missing rule phrases fail.

### 3. `secret-scan.test.mjs` — no committed secret
- Type: Node unit/security test
- Location: `poc/mcp-server/tests/secret-scan.test.mjs`
- Proves: Criterion 5 — recursively scans every committed file under `poc/` (plus asserts root `.gitignore` covers `.env*` with `!.env.example`) for JWT-shaped strings (`eyJ...` long base64url triples), non-empty values assigned to `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY`/`password`, `service_role` key material, and private-key headers; asserts every value in `poc/mcp-server/.env.example` is empty and the placeholder membership UUID is the only UUID literal in `seed.sql`.
- Inputs/fixture: working tree under `poc/`; synthetic positive control — the test includes an inline self-check that its JWT regex matches a fabricated sample string (in-memory only, never written to a scanned file).
- Doubles or boundary isolation: in-memory regex self-check; no network, no real key ever used as a fixture.
- Edge cases: the public project URL in prose is allowed (not a secret); `kid` fingerprint fragments (≤8 chars) in README are below the JWT-shape threshold and allowed; any real-looking key fails the suite.

### 4. `fixture.assertions.sql` — from-empty fixture recreation
- Type: SQL integration assertions against a real Postgres (cheapest true persistence boundary)
- Location: `poc/mcp-server/tests/fixture.assertions.sql`, run after migration + seed on a fresh `postgres:16` container
- Proves: Criterion 3 + stored-record half of criterion 4 — `poc_apps` grocery row with `current_version = 1`; `poc_app_definitions` v1 JSONB contains `list_items` (read, no arguments) and `add_item` (write, `name` string required min_length 1 trim, `quantity` integer required minimum 1); three `poc_packs` rows retrievable individually by id with kinds build/run/app and version 1; grocery pack instructions contain the alphabetical/count/ask phrases while definition::text and Build/Run instructions do not; one `poc_app_memberships` row `(grocery-list, owner)` exists; `poc_grocery_items` ordered by `id` equals `(Oats,2),(Apples,4),(Milk,1)` and differs from name order; `poc_tool_call_log` exists, is empty, exposes `user_id, app_id, operation, app_version, outcome, created_at`, and has no column matching `%token%|%secret%|%credential%|%password%`.
- Inputs/fixture: implementation plan §Seed Content Decisions; expectations mirrored in `poc/fixtures/expected-fixture.json`.
- Doubles or boundary isolation: throwaway Docker container only; no Supabase extensions, no `auth` schema — proving the fixture does not depend on hosted-only state. Placeholder membership UUID is asserted as a shape; it is never treated as an authenticated-owner pass.
- Edge cases: assertion failure raises via `DO $$ ... RAISE EXCEPTION` so `psql -v ON_ERROR_STOP=1` exits non-zero; nullable `user_id/app_id/operation` on the log table is asserted via `information_schema` (rejected/unauthenticated calls must be representable for ticket 2).

### 5. `fixture.assertions.sql` — validation constraints and seed idempotency
- Type: SQL integration assertions (same file, later sections; idempotency via the run procedure)
- Location: `poc/mcp-server/tests/fixture.assertions.sql`
- Proves: Ticket `:19` at rest — inserts of `('', 1)`, `('   ', 1)`, `('X', 0)`, `('X', -3)` into `poc_grocery_items` each raise a check-violation (caught in exception blocks that raise if the insert unexpectedly succeeds), and the item count is unchanged afterwards; re-running `seed.sql` a second time exits 0 and leaves exactly the same row counts in every `poc_*` table (idempotency, FK-safe order).
- Inputs/fixture: invalid synthetic values above; valid control row inserted and deleted inside a rolled-back transaction so final counts stay at the seeded values.
- Doubles or boundary isolation: all mutation probes run inside transactions that roll back; the container is destroyed after the run.
- Edge cases: quantity `1` (boundary valid) succeeds in the rolled-back control; float/numeric-string quantity rejection is executor (ticket 2) behavior, not asserted at SQL level beyond the integer column type.

## Safe Verification Commands
- Focused: `node --test poc/mcp-server/tests/structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs`
- Related suite: `docker run --name loomspan-poc-pg -e POSTGRES_PASSWORD=poc-local-only -p 54329:5432 -d postgres:16` then, per file in migration → seed → assertions order, `docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1 < poc/mcp-server/supabase/migrations/20261027000001_poc_fixture_schema.sql` (substitute `seed.sql` / `tests/fixture.assertions.sql`; in PowerShell use `Get-Content <file> | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1`), re-run `seed.sql` once for idempotency, then `docker rm -f loomspan-poc-pg`.
- Full safe suite: `node --test poc/mcp-server/tests/` plus the Docker sequence above, in that order. This is the broadest safe suite; the repo has no other tests, build, or CI to run. No command contacts a live service.

## Optional Developer Checks
- Developer performs the Phase 1 dashboard preflight (OAuth Server enablement, DCR toggle, JWT Signing Keys algorithm) and confirms the redacted `poc/README.md` table matches what they saw — sole evidence for acceptance criterion 1; nonblocking for the automated suite and never represented as already performed.
- Developer creates the synthetic test owner in the dashboard, replaces the placeholder membership UUID per the README procedure on the hosted project, and confirms the row — nonblocking here; ticket 2 owns any authenticated-call proof.
- Developer visually confirms README contains no key value, token, or owner credential before commit.

## Exit Criteria
- [ ] The planned red test fails for the intended reason before implementation, when applicable. (Structure test: missing `poc/` paths; SQL assertions: missing `poc_*` tables.)
- [ ] New and updated tests pass after implementation.
- [ ] The broadest safe relevant repository test suite passes. (The suite above is the entire repo test surface; no other suite exists.)
- [ ] Acceptance criteria map to executable evidence. (Criteria 2–5 automated per traceability table in the implementation plan; criterion 1 by recorded developer dashboard observation, explicitly not automated.)
- [ ] Routine automated tests do not perform unintended live or destructive operations. (Docker container is local, throwaway, synthetic-data-only; no live URL is contacted.)
- [ ] Material risks and edge cases identified above are covered. (Rule leakage, invalid-item rejection, idempotency, placeholder-membership shape, secret patterns including a variant not enumerated in the ticket — JWT-shaped strings.)
- [ ] Any optional check is reported as nonblocking and is not represented as already performed. (Preflight + hosted membership replacement are developer checks; placeholder row ≠ verified owner.)
