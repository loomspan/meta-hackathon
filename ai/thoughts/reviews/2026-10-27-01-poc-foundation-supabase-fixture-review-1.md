# 2026-10-27-01-poc-foundation-supabase-fixture Code Review — Cycle 1

## Scope and Repository State
- Fresh independent review (pipeline step 5, cycle 1, Full 5-Step Pipeline). Prior review documents: none read (none exist).
- Inputs read completely: ticket, research, implementation plan, testing plan, governing plan (`ai/thoughts/plans/proof_of_concept.md`), `ai/thoughts/design-lens.md` (no active guardrails recorded), pipeline/review commands.
- Repository state (this session, `git -c safe.directory=... status --short`): everything ticket-scoped is untracked — `.gitignore`, `poc/` (README, `mcp-server/` with config/migration/seed/tests/placeholders, `web/.gitkeep`, `fixtures/expected-fixture.json`), plus the research/plan artifacts under `ai/thoughts/`. No staged or modified tracked files. Base `main` is documentation-only, so the untracked tree is the entire change; all files were read in full (not hunks).
- No implementation artifact was changed by this review.

## Findings
No actionable findings.

Independently traced and verified against the code (not summaries):
- Scaffold: exactly `poc/mcp-server/`, `poc/web/`, `poc/fixtures/`, `poc/README.md`; root listing shows no POC file at root; sole root addition is `.gitignore` (`.env`, `.env.*`, `!.env.example`, `node_modules/`, `.supabase/`).
- DB-persisted definition: `poc/mcp-server/supabase/seed.sql` stores grocery app v1 JSONB in `poc_app_definitions` with `list_items` (read, `arguments: []`, description states insertion order by ascending id) and `add_item` (write; `name` string required `min_length:1` + `trim:true`, `quantity` integer required `minimum:1`). No operation behavior exists solely in code (no server code in this ticket at all).
- Ordering split: `alphabetical` / count-header / ask-for-quantity occur only in the grocery pack `instructions` (seed line 46), `poc/fixtures/expected-fixture.json` expectations, and tests. No `ORDER BY name` in migration or seed (only in the assertion comparator and the test regex). Seed insertion order Oats/2, Apples/4, Milk/1 differs from alphabetical.
- Validation before mutation: stored argument definitions (executor-facing) plus `CHECK (btrim(name) <> '')` and `CHECK (quantity > 0)` on an `integer` column in `20261027000001_poc_fixture_schema.sql`; `fixture.assertions.sql` probes `''`, `'   '`, `0`, `-3` expecting `check_violation`, with a rolled-back valid control (quantity 1).
- Three packs: `build`/`run`/`grocery-list` rows, kind build/run/app, all version 1, grocery pack linked to `grocery-list`; Build/Run instructions verified free of the grocery rules.
- Membership: seed inserts the documented placeholder UUID `00000000-0000-4000-8000-000000000001` with SQL comment and README wording stating it is not a real identity and no authenticated-owner pass may be claimed; README documents the dashboard user-creation + UUID-replacement procedure.
- Tool-call log: `poc_tool_call_log` has `user_id` (nullable), `app_id`, `operation`, `app_version`, `environment`, `outcome` (`ok|rejected|error`), `error_code`, `created_at`; no token/secret/credential/password or raw-argument columns; RLS enabled with no permissive policies on all six tables.
- Preflight honesty: `poc/README.md` records all three items (OAuth 2.1, DCR, asymmetric JWT) as NOT VERIFIED — developer dashboard action required, with dashboard locations, redaction rule, and the blocker-escalation rule. No live verification is claimed anywhere; no live service was contacted by this review either.
- Secrets: none found (see Verification). `.env.example` values are all empty; the only UUID literal in `seed.sql` is the placeholder; `poc-local-only` is the documented throwaway local-container password.

Non-actionable observations (checked, not defects): `fixture.assertions.sql` asserts an owner membership row exists without pinning the placeholder UUID at SQL level — the UUID is pinned at source level by `secret-scan.test.mjs` (only UUID in seed) and `structure.test.mjs` (README), matching the testing plan's shape-only intent. `expected-fixture.json` lists only `alphabetical` under `forbidden_in_definition_phrases`; the ask-for-quantity leak is covered by the Node and SQL assertions instead.

## Findings Resolved in This Context
None — no implementation artifact was changed.

## Acceptance-Criteria and Plan Conformance
| Criterion/decision | Code evidence | Test evidence | Result: implemented/partial/missing/safe deviation |
| --- | --- | --- | --- |
| 1. Redacted preflight evidence in `poc/README.md`, or blocker (cause unconfirmed) | README preflight table: all three items NOT VERIFIED with dashboard locations + redaction rule; blocker branch documented | `structure.test.mjs` README-section test PASS; developer dashboard observation not yet performed (by design, non-automated) | partial — honestly recorded developer input pending; neither passed nor blocker (nothing observed unavailable) |
| 2. `poc/` structure; no POC files at root | Full `poc/` tree + root `.gitignore` only (verified by listing and `git status`) | `structure.test.mjs` scaffold/root/placeholder tests PASS | implemented |
| 3. Migrations/seed recreate fixture from empty schema (definition v1 + ops/args, 3 packs, membership, items, log table) | Migration creates six `poc_*` tables; idempotent seed (ON CONFLICT / NOT EXISTS guard) | Node source/content tests PASS; **Docker from-empty run NOT RUN — daemon unavailable in this context (see Verification)**; SQL assertions therefore never executed | partial — source-proven, executable recreation evidence missing |
| 4. Grocery pack only: alphabetical-with-count-header + ask-quantity; server data does not order alphabetically | Grocery pack instructions only; definition JSONB clean; items seeded Oats, Apples, Milk | Node content tests PASS; SQL positive/negative + ordering assertions written but NOT RUN (same Docker blocker) | partial — source-proven, stored-record evidence pending the Docker run |
| 5. No credential/token/service key/secret committed | Empty `.env.example`, `.gitignore` coverage, placeholder-only seed/README | `secret-scan.test.mjs` PASS (12/12 suite incl. JWT-regex self-check) + independent pattern search over `poc/**` (only hit: the scan's own regex literal) | implemented |

## Active Project Guardrails
- None recorded (`ai/thoughts/design-lens.md`: "There are currently no active project-specific design guardrails recorded here.").

## Open Questions and Assumptions
- Whether the SQL migration/seed/assertions execute cleanly on real Postgres (jsonb containment shape, `"minimum": 1` text form, identity ordering from the `VALUES` insert) is reasoned from the SQL but unproven until the Docker run executes. This is the sole load-bearing unknown.
- Criterion 1 and the hosted owner-UUID replacement remain developer-performed dashboard inputs, exactly as the ticket's Pipeline notes and the plans prescribe; they are not represented as passed.

## Verification Results
- PASS — `node --test poc/mcp-server/tests/structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs` — 12/12 pass (Node v24.22.1), re-run independently this session.
- PASS — repository pattern search over `poc/**` + `.gitignore` for JWT/private-key/key-material patterns — no secret material (only the secret-scan test's own regex literal).
- PASS — `git -c safe.directory=C:/opendev/code/meta-hackathon status --short` + root listing — untracked scope confined to `poc/`, `.gitignore`, and `ai/thoughts/` artifacts; no POC file at root.
- NOT RUN — Docker from-empty sequence (`docker run ... postgres:16`, migration → seed → `fixture.assertions.sql` → seed re-run → assertions, per `poc/README.md` §Local fixture setup) — Docker daemon unavailable: `docker info` fails with `open //./pipe/docker_engine: The system cannot find the file specified`; `com.docker.service` is Stopped and `Start-Service` fails (`Cannot open com.docker.service service`); launching Docker Desktop from this sandboxed context produced no running process/daemon. No `psql`/`postgres` binary exists locally as an alternative. Same limitation Step 4 reported; never faked as a pass.

## Residual Risks and Optional Developer Checks
- Residual risk: criterion 3 (and the stored-record half of criterion 4) rests on static SQL review + Node source tests until the from-empty run executes once. The SQL was written for exactly this run and reads correctly, but an unexecuted assertion suite can hide a runtime-only failure.
- Optional developer checks: (a) start Docker Desktop and run the README §Local fixture setup sequence (or re-invoke step 5 afterwards); (b) perform the README dashboard preflight and transcribe the redacted table; (c) create the synthetic test owner and replace the placeholder membership UUID on the hosted project per README; (d) visually confirm the README contains no key/token/credential before commit.

## Disposition
- `needs-developer`
