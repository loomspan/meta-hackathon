# 2026-10-27-01-poc-foundation-supabase-fixture Code Review — Cycle 2

## Scope and Repository State
- Fresh independent review (no prior review document read) against ticket, research, implementation plan, testing plan, and governing plan. Profile: full (Full 5-Step Pipeline) — no reassessment trigger found; profile remains matched.
- Base: `main` @ `7ddf1ae`. All ticket work is untracked: `.gitignore`, `poc/` (12 files), plus plan/research artifacts under `ai/thoughts/`. No other root additions. No active design-lens guardrails recorded.
- Files read in full: `poc/README.md`, migration `20261027000001_poc_fixture_schema.sql`, `seed.sql`, `fixture.assertions.sql`, `structure.test.mjs`, `secret-scan.test.mjs`, `expected-fixture.json`, `config.toml`, `.env.example`, `.gitignore`.

## Findings

### [P2] Fix README local-setup sequence failing before Postgres is ready
- Location: `poc/README.md:33` (pre-fix)
- Scenario: On a machine where `postgres:16` is already cached, `docker run -d` returns immediately and the next README command (`docker exec ... psql`) runs before the server accepts connections.
- Impact: The only documented from-empty recreation/verification procedure fails for a fresh developer following it verbatim, undermining acceptance criterion 3's documented proof path.
- Evidence: Reproduced — fresh container with cached image, immediate migration apply: `psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: No such file or directory`, exit 2. (The first review run masked this because image pull time let the server start.)
- Fix: Added a `pg_isready` wait loop between `docker run` and the first `psql` in `poc/README.md`. Re-ran the full updated sequence on a cached image: `no response` → `accepting connections`, then migration/seed/assertions/seed-re-run/assertions all exit 0.

### [P3] Strengthen add_item SQL assertion to verify kind and full argument definitions
- Location: `poc/mcp-server/tests/fixture.assertions.sql:18` (pre-fix)
- Scenario: The old check used three independent `LIKE` patterns (`%"add_item"%`, `%"quantity"%`, `%"minimum": 1%`). Changing `add_item.kind` to `read`, or dropping/altering the `name` argument (type/required/min_length/trim) or `quantity.type/required`, still passed.
- Impact: Acceptance criterion 3 (operations defined in the stored definition with argument definitions) had executable evidence too weak to detect a broken ticket-2 executor contract.
- Evidence: Mutation probe — after `UPDATE ... jsonb_set(definition,'{operations,1,kind}','"read"')`, the strengthened assertion fails with `add_item write operation with argument definitions missing from definition v1`, psql exit 3. The old `LIKE` check would have passed that mutation.
- Fix: Replaced the `LIKE` check with a JSONB containment check mirroring the `list_items` check, asserting `add_item`/`write` with both argument definitions exactly as planned.

### [P3] Correct README status wording claiming files are committed
- Location: `poc/README.md:3` (pre-fix)
- Scenario: README stated scaffold/fixture files "are committed"; `git status` shows all of `poc/` untracked.
- Impact: Misleading state claim in the evidence record for a ticket whose acceptance depends on committed scaffold/secrets hygiene.
- Evidence: `git status --short` → `?? poc/`, `?? .gitignore`.
- Fix: Wording changed to "present in this repository".

## Findings Resolved in This Context
- All three findings above were fixed in this context (README readiness loop + status wording; strengthened `add_item` assertion) and re-verified: Node suite 12/12 PASS; full Docker from-empty sequence (migration → seed → assertions → seed re-run → assertions) all exit 0; mutation probe confirms the new assertion detects a kind mutation (exit 3); all created containers removed (`docker ps -a --filter name=loomspan-poc` empty).

## Acceptance-Criteria and Plan Conformance
| Criterion/decision | Code evidence | Test evidence | Result |
| --- | --- | --- | --- |
| 1. Redacted preflight evidence or blocker (cause unconfirmed) in `poc/README.md` | README preflight table honestly records all three items `NOT VERIFIED — developer dashboard action required`; blocker branch text present; no live claim made (README:9-17) | Structure test asserts section/rows exist; secret scan passes. No automated live evidence exists by design | partial — developer-to-perform; not passed, not faked |
| 2. `poc/` structure exactly; nothing POC at root | `poc/mcp-server/`, `poc/web/`, `poc/fixtures/`, `poc/README.md`; sole root addition `.gitignore` (plan-approved hygiene) | `structure.test.mjs`: required paths, placeholder-only dirs, root scan — PASS | implemented |
| 3. Migrations/seed recreate fixture from empty schema (definition v1 + ops/args, 3 packs, membership, items, log table) | Migration creates 6 `poc_*` tables + RLS-on/no policies; seed stores DB-persisted definition v1 (`list_items` read/no-args, `add_item` write with `name` string required min_length 1 trim, `quantity` integer required minimum 1), 3 packs, placeholder owner membership, Oats/Apples/Milk, empty log table with user/app/operation/app_version/outcome/created_at and no credential columns | Docker from-empty run this cycle: migration/seed/assertions/seed-re-run/assertions all exit 0; strengthened `add_item` containment + mutation probe (exit 3 on mutated kind) | implemented |
| 4. Grocery pack only: alphabetical-with-count-header + ask-for-quantity; server data/definition does not order alphabetically | Grocery pack instructions (seed.sql:46) carry both rules; definition JSONB, migration, Build/Run packs do not; items seeded Oats,Apples,Milk (insertion ≠ alphabetical); no `ORDER BY name` anywhere | SQL positive (grocery pack) + negative (definition, Build/Run) assertions PASS in Docker run; structure content tests PASS | implemented |
| 5. No credential/token/service-role key/secret committed | `.gitignore` covers `.env*` with `!.env.example` negated; `.env.example` values empty; only UUID in seed is the documented placeholder; only password literal is throwaway `poc-local-only` | `secret-scan.test.mjs` (incl. JWT-regex self-check on a fabricated variant) PASS; independent grep found no key/token material | implemented |
| Validation before mutation (ticket :19) | Stored argument definitions declare the rules; `CHECK (btrim(name) <> '')` + `CHECK (quantity > 0)` at rest | SQL exception probes for `''`, `'   '`, `0`, `-3` + valid-quantity-1 rolled-back control PASS in Docker run. Executor-side type rejection (float/string) is ticket 2 scope, correctly not claimed here | implemented (fixture scope) |
| Owner membership honest placeholder; dashboard steps documented | Placeholder UUID commented not-a-real-identity in seed; README "Test owner setup (dashboard)" gives creation + UUID replacement `UPDATE`; explicitly forbids claiming authenticated-owner pass from local proof | Membership shape asserted in SQL run; README section asserted by structure test | implemented |
| Synthetic data only | Items/packs are synthetic; README states synthetic-only | Content review of seed | implemented |

## Active Project Guardrails
- None recorded (`ai/thoughts/design-lens.md`).

## Open Questions and Assumptions
- Criterion 1 remains open by design: it can only be closed by the developer's dashboard observation transcribed into `poc/README.md`. This review does not treat the `NOT VERIFIED` table as a pass, and no code change in this ticket's scope can close it.
- `node --test poc/mcp-server/tests/` (directory form, testing-plan wording) fails in this sandbox with a module-resolution error on the `\\?\` long path, while the README's explicit-file form passes 12/12. Recorded as an environment quirk, not a repository defect; the documented README command is the operative one.

## Verification Results
- PASS — `node --test poc/mcp-server/tests/structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs` — 12/12 (run before and after fixes)
- PASS — Docker from-empty sequence from `poc/README.md` §Local fixture setup (escalated shell, fresh `postgres:16`): migration exit 0, seed exit 0, assertions exit 0, seed re-run exit 0 (all `INSERT 0 0`), assertions exit 0. Run twice: once pre-fix (image-pull timing masked the readiness race) and once post-fix with cached image using the new `pg_isready` loop
- PASS — Readiness defect reproduction (pre-fix): immediate psql on cached-image container → exit 2, socket error (finding P2 evidence)
- PASS — Mutation probe: `add_item.kind` mutated to `read` → assertions exit 3 with expected message (proves strengthened assertion sensitivity)
- PASS — Container cleanup: `docker rm -f` for every created container; final `docker ps -a --filter name=loomspan-poc` empty
- FAIL (environment, not repository) — `node --test poc/mcp-server/tests/` directory form in sandbox: `Cannot find module '\\?\C:\...\tests'`. Explicit-file form (README command) PASS; see Open Questions
- NOT RUN — Live Supabase preflight / hosted migration application: prohibited as routine verification; developer dashboard checks only

## Residual Risks and Optional Developer Checks
- Developer performs the three dashboard preflight items (OAuth Server enablement, DCR toggle, JWT Signing Keys algorithm) and transcribes redacted results into `poc/README.md`; if any item cannot be enabled, record `BLOCKER — authentication/integration blocker, cause unconfirmed` and stop. This is the sole evidence for criterion 1.
- Developer creates the synthetic test owner in the dashboard, replaces the placeholder membership UUID per README on the hosted project, and confirms the row (no credentials recorded).
- Developer visually confirms `poc/README.md` contains no key/token/credential before commit.

## Disposition
- `fixes-applied`
