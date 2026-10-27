# POC Foundation: Supabase Preflight, Scaffold, and Grocery Fixture Implementation Plan

## Overview
- Ticket: `ai/thoughts/tickets/2026-10-27-01-poc-foundation-supabase-fixture.md`
- Research: `ai/thoughts/research/2026-10-27-01-poc-foundation-supabase-fixture.md`
- Governing plan: `ai/thoughts/plans/proof_of_concept.md`
- Outcome: `poc/` scaffold exists, redacted Supabase preflight evidence (or a cause-unconfirmed blocker) is recorded in `poc/README.md`, and committed Postgres migrations + seed recreate the grocery-list v1 fixture — DB-persisted app definition, three stored packs, owner membership, synthetic items, tool-call log — from an empty schema, with no secret committed.

## Current State
- Repository is documentation-only (27 tracked files, all under `ai/`); no `poc/`, code, migrations, seed, tests, `package.json`, or `.gitignore` exist (research §Repository State; verified this session: root contains only `.agents/.eden/.git/.hg/.muse/.sl/ai`).
- No operation, validation, ordering, membership, or log behavior exists; `list_items`/`add_item`, insertion order, and validation are requirements only (ticket `:15-22`; governing plan `:95`).
- Tooling on this machine (research §Repository State; re-verified this session): Node `v24.22.1` and Docker `29.8.1` present; `supabase` CLI, `psql`, `deno` not found; no `SUPABASE*`/`DATABASE*` env vars. Docker's bundled `psql` (inside a `postgres` image) is therefore the planned from-empty verification vehicle; no live external service is contacted by automated steps.
- Downstream contract this fixture must satisfy (ticket 2, `2026-10-27-02-poc-mcp-server-gate1-tools.md:12-21`): DB-driven executor reading stored definitions, `list_apps`/`get_pack`/`call_operation`, stale-version rejection, membership enforcement, per-call log writes. Ticket 4's v2 update (`remove_item`) must be a DB-row edit only.

## Desired End State
- Developer-performed dashboard preflight for **Loomspan Testing** (`https://yjrwyfkybszlpufsflan.supabase.co`, existing nano project, never replaced) is transcribed redacted into `poc/README.md`, or the unavailable item is recorded as an authentication/integration blocker with cause unconfirmed and work stops for a developer decision.
- `poc/mcp-server/`, `poc/web/`, `poc/fixtures/`, `poc/README.md` exist; nothing POC-related at repo root.
- Applying the committed migration then seed to an empty Postgres schema yields: grocery app definition v1 with `list_items` (read) and `add_item` (write) plus argument definitions; Build/Run/grocery packs as independently retrievable stored rows; one owner membership row; synthetic grocery items whose insertion order is visibly non-alphabetical; an empty `tool_call_log` table able to record user/app/operation/app version/outcome/timestamp with no credential columns.
- Alphabetical-with-count-header and ask-for-quantity rules appear only in the stored grocery pack record — never in the app definition, items table, or any server data.
- No credential, token, service-role key, JWT secret, or owner password appears in any committed file.

## Acceptance-Criteria Mapping
| Ticket criterion (`:27-31`) | Desired-state evidence |
| --- | --- |
| 1. Redacted preflight evidence in `poc/README.md`, or blocker (cause unconfirmed) | README §Preflight evidence table (Phase 1) |
| 2. `poc/` structure; no POC files at root | Phase 2 file list; structure test |
| 3. Migrations/seed recreate fixture from empty schema | Phases 3–4 schema/seed; from-empty Docker run + SQL assertions |
| 4. Pack-only alphabetical/count/ask-quantity rules; server data does not order alphabetically | Seed content rules (§Seed content decisions); positive + negative SQL assertions |
| 5. No secret anywhere in scaffold/migrations/seed/README | `.gitignore`, `.env.example` placeholders, automated secret scan |

## Scope
### In scope
- Dashboard preflight procedure + redacted README evidence record (developer performs dashboard actions; implementer transcribes).
- `poc/` scaffold exactly as listed in Phase 2, including root `.gitignore` (repo hygiene, not a POC file at root in the prohibited sense — it protects the whole repo and is required by criterion 5; no other root additions).
- Postgres schema, migration, seed, owner-membership reconciliation procedure, README setup/runbook skeleton.
- Automated verification: Node structure/content/secret tests + SQL assertions against a throwaway local Docker Postgres.

### Out of scope
- Any MCP server / Edge Function code, `list_apps`/`get_pack`/`call_operation` implementation, validation execution, or log writer (ticket 2; only the log *table* is created here).
- Web/onboarding/consent pages and any anon-key value in `poc/web/` (ticket 3; only the directory placeholder is created here).
- Gate 2 tools/apps, participant identity, billing, invitations, production schema design, real user data (ticket `:23`).
- Creating a replacement Supabase project; contacting live services from automated steps; DCR round-trip or token-flow proof (ticket 3).
- Redeploy/reconnect mechanics for the v2 update (ticket 4; this plan only keeps the definition DB-editable).

## Active Project Guardrails
None recorded (`ai/thoughts/design-lens.md`: "There are currently no active project-specific design guardrails recorded here."). Proceed from ticket + governing plan + research only.

## Impact and Risk Analysis
- **Persisted-contract risk (highest):** definition/pack/version shapes chosen here bind tickets 2 and 4. Mitigated by storing operations + argument definitions as data (JSONB document per app version) and keeping `apps.current_version` as the single version source the stale-version check compares against.
- **Blocked-preflight risk:** a required OAuth capability may be unavailable on the nano project. Ticket `:12,42` mandates stop + blocker record, cause unconfirmed; Phase 1 is a hard gate before the fixture is treated as buildable.
- **JWT migration blast radius:** moving off HS256 in the dashboard affects all project tokens/keys (research §Supabase Preflight). Plan records algorithm + `kid` fingerprint only and leaves timing/execution to the developer.
- **Owner-identity reconciliation risk:** the real Auth UUID cannot be committed or known before dashboard user creation, yet criterion 3 requires membership in the from-empty recreation. Resolved by the placeholder-UUID + documented replacement procedure in Phase 4; the placeholder must never be reported as a verified authenticated owner.
- **Secret-leak risk:** no `.gitignore`/`.env` precedent exists. Root `.gitignore` + placeholder-only `.env.example` + automated scan (Phase 5).
- **Ordering-testability risk:** if seed insertion order equalled alphabetical order, criterion 4 would be untestable. Seed items are deliberately non-alphabetical (§Seed content decisions).
- **Tooling risk:** no Supabase CLI/`psql` locally. Verification uses Docker Postgres only; hosted-project application of migrations is a documented developer step, never an automated one.

## Implementation Approach
Postgres-first, files-as-scaffold. One SQL migration creates five tables in the `public` schema with `poc_`-prefixed names (no new schema, no dependency on Supabase's `auth` schema, so the same files run on plain Docker Postgres and on the hosted project): `poc_apps`, `poc_app_definitions`, `poc_packs`, `poc_app_memberships`, `poc_grocery_items`, plus `poc_tool_call_log`. Rejected alternative — a dedicated `poc` schema — adds search-path/RLS surface that ticket 2's Edge Function would have to configure for no fixture benefit. Rejected alternative — one relational row per operation (`poc_app_operations`) — makes ticket 4's update an INSERT either way, but forces the executor to reassemble definitions from rows; a versioned JSONB definition document is read in one query and edited as one row, matching governing plan `:125` ("an edit to the app-definition row"). `poc_packs.instructions` holds pack prose as a stored record (not a file the server reads at runtime), satisfying "persist app definitions and packs in Postgres" (ticket `:14`). `poc/fixtures/` is needed only as the test-expectation fixture (IDs, versions, item order, required/forbidden phrases), keeping pack prose solely in the seed to avoid two prose sources of truth. Validation is expressed twice, deliberately: argument-definition constraints in the stored definition (executor-facing, ticket 2 enforces before mutation) and `CHECK` constraints on `poc_grocery_items` (defense-in-depth at rest); neither contradicts the other. RLS is enabled with no permissive policies in this ticket — direct PostgREST access is denied by default and ticket 2 chooses RLS policies and/or explicit membership checks (its `:16` permits either).

## Schema Decisions (binding for Phases 3–4)
- `poc_apps`: `id text PRIMARY KEY` (`'grocery-list'`), `name text NOT NULL`, `summary text NOT NULL` (one line, for `list_apps`), `current_version integer NOT NULL CHECK (current_version > 0)`, `environments text[] NOT NULL DEFAULT '{production}'`, `created_at timestamptz NOT NULL DEFAULT now()`.
- `poc_app_definitions`: `app_id text NOT NULL REFERENCES poc_apps(id)`, `version integer NOT NULL CHECK (version > 0)`, `definition jsonb NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`, `PRIMARY KEY (app_id, version)`. v1 `definition` shape: `{"operations":[{"name":"list_items","kind":"read","arguments":[]},{"name":"add_item","kind":"write","arguments":[{"name":"name","type":"string","required":true,"min_length":1,"trim":true},{"name":"quantity","type":"integer","required":true,"minimum":1}]}]}`. Whitespace-only `name` is invalid via `trim`+`min_length` semantics recorded here so ticket 2 does not invent a conflicting rule; quantity must be a JSON integer `>= 1` (floats, numeric strings, booleans, missing, `0`, negatives invalid — executor enforcement is ticket 2; the fixture only declares it).
- `poc_packs`: `id text PRIMARY KEY` (`'build'`, `'run'`, `'grocery-list'`), `kind text NOT NULL CHECK (kind IN ('build','run','app'))`, `app_id text REFERENCES poc_apps(id)` (null for Build/Run, `'grocery-list'` for the app pack), `version integer NOT NULL CHECK (version > 0)` (all three seeded at `1`; grocery pack version mirrors the app version), `title text NOT NULL`, `instructions text NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`. Independent retrievability = `SELECT ... WHERE id = $1` per pack.
- `poc_app_memberships`: `app_id text NOT NULL REFERENCES poc_apps(id)`, `user_id uuid NOT NULL`, `role text NOT NULL CHECK (role IN ('owner'))`, `created_at timestamptz NOT NULL DEFAULT now()`, `PRIMARY KEY (app_id, user_id)`. No FK to `auth.users` (keeps from-empty recreation portable to plain Postgres; integrity of the real UUID is established by the README replacement procedure).
- `poc_grocery_items`: `id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY` (identity order = insertion order; `list_items` semantics are `ORDER BY id ASC`, stated in the definition document's operation description, with **no** `ORDER BY name` anywhere), `app_id text NOT NULL REFERENCES poc_apps(id) DEFAULT 'grocery-list'`, `name text NOT NULL CHECK (btrim(name) <> '')`, `quantity integer NOT NULL CHECK (quantity > 0)`, `created_at timestamptz NOT NULL DEFAULT now()`.
- `poc_tool_call_log`: `id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`, `user_id uuid NULL` (nullable so unauthenticated/rejected calls are representable), `app_id text NULL`, `operation text NULL`, `app_version integer NULL`, `environment text NULL`, `outcome text NOT NULL CHECK (outcome IN ('ok','rejected','error'))`, `error_code text NULL`, `created_at timestamptz NOT NULL DEFAULT now()` (the recorded timestamp). Deliberately no token/credential/argument columns; raw arguments are never logged (ticket `:22`).
- RLS: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on all six tables; no policies created in this ticket.

## Seed Content Decisions (binding for Phase 4)
- Synthetic items, inserted in exactly this order (non-alphabetical by design): `('Oats', 2)`, `('Apples', 4)`, `('Milk', 1)` — insertion order `Oats, Apples, Milk` vs alphabetical `Apples, Milk, Oats`.
- Grocery pack `instructions` must state, in substance: present items alphabetically with a count header (e.g. "3 items"), and ask the user for a quantity instead of inventing one. These phrases/rules appear nowhere in `poc_app_definitions.definition`, the migration, or item data.
- Build pack `instructions`: minimal delivery-check text only — Loomspan Build guidance placeholder stating Gate 1 verifies Build-pack delivery, not a publishing workflow (governing plan `:123`). Run pack `instructions`: minimal text — select Loomspan, discover apps with `list_apps`, load the selected app pack with `get_pack`, call operations with `call_operation`. Neither invents Gate 2 workflow scope.
- Owner membership seed uses placeholder UUID `00000000-0000-4000-8000-000000000001` with role `'owner'` for app `'grocery-list'`, clearly commented in `seed.sql` as not-a-real-identity.

## Phase 1: Supabase Preflight Gate (Developer Dashboard, Redacted Record)

### Changes
- [ ] `poc/README.md` — create with a `## Supabase preflight evidence` section containing a table with one row per item (OAuth 2.1 server can be enabled; dynamic client registration can be turned on; JWT signing is ES256/RS256, not HS256) and columns: Item | Dashboard location | Observed state | Verified by | Date. Dashboard locations: **Authentication > OAuth Server** (enablement + DCR toggle; record Authorization Path and Site URL values seen), **Authentication > JWT Signing Keys** (record signing algorithm and `kid` fingerprint — first/last 4 characters only). Record toggle/path/URL/algorithm facts only; never tokens, client secrets, JWT secret, anon/service-role key values, or owner credentials.
- [ ] Developer performs, in order: (1) open Loomspan Testing dashboard, confirm **Authentication > OAuth Server** toggle is present and enable it if off; (2) turn on dynamic client registration in the same screen and note the open-registration caution; (3) open **Authentication > JWT Signing Keys** and record the current algorithm — if HS256/legacy, the developer decides if/when to migrate (`Migrate JWT secret`, add ES256/RS256 key) given the project-wide token impact, and records the resulting algorithm; (4) transcribe only the redacted fields above into the README table and report back to the implementer.
- [ ] Blocker branch: if any toggle is absent/cannot be enabled or the project cannot move off HS256, record that item in the README as `BLOCKER — authentication/integration blocker, cause unconfirmed`, stop, and return `STATUS: needs-developer`. Do not design around it, do not create a replacement project, and do not mark acceptance criterion 1 passed (ticket `:12,27,42`; governing plan `:25`).

### Automated verification
- [ ] None — no live external service is contacted by automation in this step, and no live verification is claimed. Evidence is the developer's dashboard observation transcribed redacted into `poc/README.md`.

### Optional developer checks
- [ ] Developer confirms the README table matches the dashboard screens they actually saw (this observation is the criterion-1 evidence; it is not represented as automated proof).

**Gate:** Phases 2–5 may be built regardless, but the fixture is not "buildable/complete" and criterion 1 is not passed until this table shows all three items available (or the blocker branch fires).

## Phase 2: Repository Scaffold and Secret Hygiene

### Changes
- [ ] `.gitignore` (repo root) — add `.env`, `.env.*` with `!.env.example` negated, `node_modules/`, and local Supabase temp (`.supabase/`) entries. This is repo hygiene required by criterion 5, not POC product content at root.
- [ ] `poc/README.md` — sections in order: purpose/status, `## Supabase preflight evidence` (Phase 1), `## Repository layout`, `## Local fixture setup` (Docker verification + hosted application steps, Phase 5), `## Test owner setup (dashboard)` (Phase 4 procedure), `## What this ticket does not do` (tickets 2–4 pointers). Reserve headings only; do not write ticket 3/4 runbook content.
- [ ] `poc/mcp-server/supabase/config.toml` — minimal Supabase CLI config with `project_id = "loomspan-testing"` and no secrets, no `[auth.oauth_server]` claims (dashboard state lives only in the README evidence table).
- [ ] `poc/mcp-server/supabase/functions/mcp/.gitkeep` — empty placeholder reserving ticket 2's Edge Function location (`functions/v1/mcp`); no function code in this ticket.
- [ ] `poc/mcp-server/.env.example` — placeholder names with empty values only: `SUPABASE_URL=`, `SUPABASE_ANON_KEY=`, `SUPABASE_SERVICE_ROLE_KEY=`. No real project URL key values; the public project URL may appear in prose docs (it is already in the ticket) but no key value is ever written.
- [ ] `poc/web/.gitkeep` — empty placeholder; ticket 3 owns all page content and the anon-key usage decision.
- [ ] `poc/fixtures/expected-fixture.json` — machine-readable expectations for tests: app id/version, pack ids/kinds/versions, grocery operations + argument definitions summary, expected item `[name, quantity]` pairs in insertion order, required grocery-pack phrases (`alphabetically`, `count`), and forbidden-in-definition phrases. Contains no prose pack text beyond those assertion phrases and no secrets.

### Automated verification
- [ ] `node --test poc/mcp-server/tests/structure.test.mjs` — asserts every path above exists, `poc/web/` and `poc/mcp-server/supabase/functions/mcp/` contain only placeholders, and no POC file exists at repo root (root additions limited to `.gitignore`).

### Optional developer checks
- [ ] None.

## Phase 3: Postgres Schema Migration

### Changes
- [ ] `poc/mcp-server/supabase/migrations/20261027000001_poc_fixture_schema.sql` — `CREATE TABLE` for `poc_apps`, `poc_app_definitions`, `poc_packs`, `poc_app_memberships`, `poc_grocery_items`, `poc_tool_call_log` exactly per §Schema Decisions (constraints, identity columns, FKs, `CHECK`s as specified), followed by `ENABLE ROW LEVEL SECURITY` on all six tables and no `CREATE POLICY`. Header comment states: synthetic fixture only, no credentials stored, `poc_tool_call_log` intentionally has no token/argument columns. No alphabetical `ORDER BY`, index on `name`, or presentation logic anywhere in the file.

### Automated verification
- [ ] From-empty application in Phase 5's Docker Postgres run succeeds with `ON_ERROR_STOP=1` (exit 0).

### Optional developer checks
- [ ] None.

## Phase 4: Seed (App Definition v1, Three Packs, Membership, Items, Log Table)

### Changes
- [ ] `poc/mcp-server/supabase/seed.sql` — idempotent (`INSERT ... ON CONFLICT DO NOTHING` on natural keys) inserts, in FK-safe order: (1) `poc_apps` row `('grocery-list', 'Grocery List', '<one-line summary>', 1, '{production}')`; (2) `poc_app_definitions` row `('grocery-list', 1, '<definition JSONB per §Schema Decisions>')` — `list_items` read with no arguments and an operation note that results are returned in insertion order, `add_item` write with `name`/`quantity` argument definitions as specified; the JSONB must not contain the words `alphabetical` or any count-header/ask-for-quantity rule; (3) `poc_packs` rows `'build'`/`'run'`/`'grocery-list'` (kind, `app_id`, version `1`, title, instructions per §Seed Content Decisions — grocery instructions contain the alphabetical-with-count-header rule and the ask-for-quantity-instead-of-inventing rule, Build/Run instructions do not); (4) `poc_app_memberships` row `('grocery-list', '00000000-0000-4000-8000-000000000001', 'owner')` with an SQL comment that this placeholder is not a real identity; (5) `poc_grocery_items` inserts in the exact order Oats/2, Apples/4, Milk/1 relying on identity order. `poc_tool_call_log` is left empty (table only).
- [ ] `poc/README.md` §Test owner setup (dashboard) — documented developer procedure: create the Auth user in the Loomspan Testing dashboard (synthetic email, e.g. `poc-owner@example.invalid`; password set in dashboard only, never recorded), copy the new user's UUID from **Authentication > Users**, then run the documented replacement statement against the hosted project — `UPDATE poc_app_memberships SET user_id = '<paste-real-uuid>' WHERE app_id = 'grocery-list' AND user_id = '00000000-0000-4000-8000-000000000001';` — and re-run seed/`db reset` locally only with the same replacement applied. State explicitly: until this step is done the hosted membership row points at the placeholder and no authenticated-owner pass may be claimed; the local from-empty proof intentionally verifies the placeholder row's shape, not a real login.

### Automated verification
- [ ] SQL assertions in Phase 5 prove stored definition, packs, membership row, items, and empty log table after seed on an empty schema.

### Optional developer checks
- [ ] After performing the dashboard user creation + UUID replacement on the hosted project, the developer confirms one membership row exists for the real UUID (dashboard/SQL observation; non-automated, recorded in README with date, no credentials).

## Phase 5: From-Empty Verification, Secret Scan, and README Completion

### Changes
- [ ] `poc/mcp-server/tests/fixture.assertions.sql` — `DO`-block/`SELECT`-based assertions run with `ON_ERROR_STOP=1` (any failure aborts non-zero): app row + `current_version = 1`; definition v1 contains operations `list_items`/`add_item` with the specified argument definitions; definition text contains neither `alphabetical` nor `quantity` presentation rules beyond argument definitions; three packs retrievable by id with kinds/versions; grocery pack instructions contain `alphabetical` and a count-header phrase and an ask-for-quantity phrase; Build/Run instructions contain neither grocery rule; membership row `(grocery-list, placeholder-or-replaced UUID, owner)` exists; items in `ORDER BY id` equal Oats/Apples/Milk with quantities 2/4/1 and differ from `ORDER BY name`; `poc_grocery_items` rejects `('', 1)` and `('X', 0)` (assert via exception-expecting `DO` blocks); `poc_tool_call_log` exists, is empty, and has no column named like `%token%`/`%secret%`/`%credential%`/`%password%`.
- [ ] `poc/mcp-server/tests/secret-scan.test.mjs` (or a `node --test` case in `structure.test.mjs`) — scans all committed `poc/` files plus `.gitignore` coverage for high-signal secret patterns (Supabase key prefixes, `service_role` value assignments with non-empty values, JWT-shaped strings, `password =` with a value) and fails on any hit; `.env.example` values must all be empty.
- [ ] `poc/README.md` §Local fixture setup — exact safe commands: start throwaway Postgres (`docker run --name loomspan-poc-pg -e POSTGRES_PASSWORD=poc-local-only -p 54329:5432 -d postgres:16`), apply migration + seed + assertions via `docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1 < <file>` (PowerShell equivalent noted), then `docker rm -f loomspan-poc-pg`. The local password is a throwaway container-only value, stated as such; hosted application is described as developer-run Supabase CLI/dashboard steps with no connection string or key printed.

### Automated verification
- [ ] `node --test poc/mcp-server/tests/` — structure + secret-scan tests pass.
- [ ] Docker from-empty run (commands above) — migration, seed, and `fixture.assertions.sql` all exit 0 on a fresh container; re-running seed exits 0 (idempotency).

### Optional developer checks
- [ ] Developer visually confirms `poc/README.md` preflight table is fully redacted before commit.

## Test Strategy
Node built-in test runner (`node:test`, no new dependencies, no `package.json` required — `.mjs` files run directly) for structure/secret/content checks; plain SQL assertions executed by the `postgres:16` Docker image's `psql` for persistence behavior. Cheapest boundaries: file-system assertions for criterion 2/5, one real Postgres instance for criterion 3/4. No live Supabase, network, or credential is used by any automated test. Full detail, red-test ordering, and exit criteria: `ai/thoughts/plans/2026-10-27-01-poc-foundation-supabase-fixture-testing.md`.

## Acceptance-Criteria Traceability
| Acceptance criterion | Planned code evidence | Planned test evidence |
| --- | --- | --- |
| 1. Redacted preflight evidence or blocker (cause unconfirmed) in `poc/README.md` | Phase 1 README §Supabase preflight evidence table / blocker branch | Developer dashboard observation recorded in README (non-automated by design); structure test asserts the section + three item rows exist with no secret-pattern hits (secret scan) |
| 2. `poc/` structure; nothing POC-related at root | Phase 2 exact file list; `.gitignore` sole root addition | `structure.test.mjs` path + root-scan assertions |
| 3. Migrations/seed recreate fixture from empty schema (definition v1 + ops/args, 3 packs, membership, items, log table) | `20261027000001_poc_fixture_schema.sql`, `seed.sql` (§Schema/§Seed decisions) | Docker from-empty run exit 0 + `fixture.assertions.sql` record assertions + seed re-run idempotency |
| 4. Grocery pack only: alphabetical-with-count-header + ask-for-quantity; server data/definition does not order alphabetically | Grocery `instructions` text; definition JSONB without those rules; items seeded Oats/Apples/Milk; no `ORDER BY name` in SQL | SQL positive (pack) + negative (definition/Build/Run) phrase assertions; insertion-order ≠ alphabetical-order assertion |
| 5. No credential/token/service key/secret committed | `.gitignore`, empty-value `.env.example`, placeholder-only seed/README | `secret-scan` test over `poc/`; assertion that `.env.example` values are empty |

## Risks and Rollback/Recovery
- Preflight blocker fires → stop per Phase 1; rollback is deleting the uncommitted scaffold or leaving the README blocker record for the developer decision — no hosted state has been changed by automation.
- JWT migration (if developer performs it) invalidates existing project tokens — developer-owned timing, recorded redacted; this plan never automates it.
- Schema/seed defects are recovered by dropping the throwaway Docker container and re-running from empty; hosted mistakes are recovered by re-running the idempotent seed and, if needed, the documented membership UUID replacement — no destructive hosted operation is planned.
- Placeholder membership mistaken for a real owner → mitigated by SQL comment, README wording, and testing plan explicitly forbidding an authenticated-owner pass claim from local evidence.
- All POC content is deletable as one `poc/` directory plus the `.gitignore` additions (governing plan `:29`).

## References
- Ticket: `ai/thoughts/tickets/2026-10-27-01-poc-foundation-supabase-fixture.md`
- Research: `ai/thoughts/research/2026-10-27-01-poc-foundation-supabase-fixture.md`
- Governing plan: `ai/thoughts/plans/proof_of_concept.md` (`:17-25` config/preflight, `:27-40` structure, `:89-127` fixture)
- Downstream contracts: `ai/thoughts/tickets/2026-10-27-02-poc-mcp-server-gate1-tools.md`, `ai/thoughts/tickets/2026-10-27-03-poc-web-oauth-onboarding-consent.md`, `ai/thoughts/tickets/2026-10-27-04-poc-gate1-run-and-evidence.md`
- Testing plan: `ai/thoughts/plans/2026-10-27-01-poc-foundation-supabase-fixture-testing.md`


