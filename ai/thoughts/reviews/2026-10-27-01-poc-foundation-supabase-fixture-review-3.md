# 2026-10-27-01-poc-foundation-supabase-fixture Code Review — Cycle 3

Fresh independent review. No prior review document was read. Scope was reconstructed from the ticket, research, implementation plan, testing plan, and the current repository state.

## Scope and Repository State
- Ticket-scoped change is entirely uncommitted/untracked: `.gitignore` (repo root, sole root addition) and the whole `poc/` tree (`poc/README.md`, `poc/mcp-server/` with `supabase/config.toml`, `supabase/migrations/20261027000001_poc_fixture_schema.sql`, `supabase/seed.sql`, `supabase/functions/mcp/.gitkeep`, `.env.example`, `tests/structure.test.mjs`, `tests/secret-scan.test.mjs`, `tests/fixture.assertions.sql`, `poc/web/.gitkeep`, `poc/fixtures/expected-fixture.json`). Verified via `git -c safe.directory=... status --short` and full reads of every `poc/` file.
- No POC file exists at the project root. `poc/web/` and `poc/mcp-server/supabase/functions/mcp/` contain only `.gitkeep` placeholders (no ticket 2/3 content).
- Profile reassessment: selected profile is Full 5-Step Pipeline; the change touches persisted contracts, a migration, and an external auth boundary, so the full profile remains matched. No escalation.

## Findings
No actionable findings.

Review notes (checked and cleared, not findings):
- DB-persisted definition: `poc_app_definitions.definition` (JSONB, PK `(app_id, version)`) stores `list_items` (read, no arguments, insertion-order description) and `add_item` (write, `name` string required `min_length 1` `trim`, `quantity` integer required `minimum 1`); no behavior depends solely on code (no server code exists in this ticket). `poc_apps.current_version = 1` is the version source.
- Ordering split: seed inserts `Oats/2, Apples/4, Milk/1` (insertion order deliberately non-alphabetical); no `ORDER BY name` and no alphabetical/count/ask-for-quantity rule exists in the migration, the stored definition, or Build/Run packs. The alphabetical-with-count-header and ask-for-quantity rules appear only in the stored grocery pack `instructions`.
- Validation before mutation at rest: `CHECK (btrim(name) <> '')` rejects empty and whitespace-only names; `quantity integer CHECK (quantity > 0)` rejects zero/negatives; non-integer quantity forms are declared invalid by the stored argument definition for ticket 2's executor (correct boundary for this ticket, which ships no executor).
- Packs: `build`/`run`/`grocery-list` are three independently retrievable `poc_packs` rows (kind build/run/app, all version 1; grocery pack linked to `grocery-list`).
- Membership: seed inserts only the documented placeholder UUID `00000000-0000-4000-8000-000000000001` with role `owner`, commented in `seed.sql` as not a real identity; `poc/README.md` §Test owner setup documents the dashboard creation + UUID-replacement procedure and explicitly forbids claiming an authenticated-owner pass from the placeholder. The placeholder is never passed off as real.
- Tool-call log: `poc_tool_call_log` records `user_id` (nullable), `app_id`, `operation`, `app_version`, `environment`, `outcome` (`ok`/`rejected`/`error`), `error_code`, `created_at`; no token/secret/credential/password or raw-argument columns. An independent probe inserted a rejected-call row with NULL `user_id` successfully.
- Synthetic data only; no real user data, billing, invitations, or Gate 2 scope anywhere in the diff.
- Secrets: Node secret-scan passes; an independent ripgrep over `poc/` for JWT-shaped strings, private-key headers, Supabase token prefixes, and service-role key material returned no hits. `.env.example` values are all empty; the only non-empty password literal is the documented throwaway local-Docker value `poc-local-only`; the only UUID literal in `seed.sql` is the placeholder.
- Preflight honesty: `poc/README.md` §Supabase preflight evidence records all three items (OAuth 2.1 server, dynamic client registration, asymmetric JWT signing) as `NOT VERIFIED — developer to perform`, with dashboard locations, redaction rule, and the `BLOCKER — authentication/integration blocker, cause unconfirmed` escalation branch. No live verification is claimed anywhere; no live service was contacted by this review.

## Findings Resolved in This Context
None — this context made no implementation-artifact changes. The full review was completed before any editing decision, and no edit was needed.

## Acceptance-Criteria and Plan Conformance
| Criterion/decision | Code evidence | Test evidence | Result |
| --- | --- | --- | --- |
| 1. Redacted preflight evidence in `poc/README.md`, or blocker (cause unconfirmed) | `poc/README.md:7-17` table with all three items, dashboard locations, redaction rule, blocker branch | Structure test asserts section/items present; secret scan passes. Dashboard observation itself is developer-only by ticket design | partial — honestly recorded as NOT VERIFIED, developer-to-perform; no unverified live claim made or accepted |
| 2. `poc/` structure exactly; nothing POC at root | `poc/mcp-server/`, `poc/web/`, `poc/fixtures/`, `poc/README.md`; root addition is `.gitignore` only | `structure.test.mjs` scaffold/root/placeholder tests PASS | implemented |
| 3. Migrations/seed recreate fixture from empty schema (definition v1 + ops/args, 3 packs, membership, synthetic items, log table) | Migration creates six `poc_*` tables with RLS enabled and no policies; idempotent seed in FK-safe order | Docker from-empty run (migration → seed → assertions → seed re-run → assertions) all exit 0; independent probe queries confirmed stored definition JSON, 3 packs, item order, log insert, and quantity-0 rejection | implemented |
| 4. Grocery pack only: alphabetical-with-count-header + ask-for-quantity; server data/definition must not order alphabetically | Grocery pack instructions contain both rules; definition JSONB, migration, Build/Run packs contain neither; items seeded Oats/Apples/Milk | SQL positive (grocery pack) and negative (definition, Build/Run) assertions PASS; insertion-order ≠ name-order assertion PASS; Node source-content tests PASS | implemented |
| 5. No credential/token/service-role key/secret committed | `.gitignore` covers `.env*` with `!.env.example` negated; empty-value `.env.example`; placeholder-only seed/README | `secret-scan.test.mjs` PASS; independent ripgrep over `poc/` found no secret patterns | implemented |
| Validation rejects empty name / non-positive-integer quantity before mutation | Stored argument definitions (`min_length 1` + `trim`; integer `minimum 1`) plus DB `CHECK`s | SQL exception-expecting probes for `('',1)`, `('   ',1)`, `('X',0)`, `('X',-3)` PASS; quantity-1 control succeeds (rolled back) | implemented (executor enforcement is ticket 2) |
| README local setup sequence works verbatim incl. Postgres readiness | `poc/README.md:32-44` PowerShell block with `pg_isready` readiness loop | Ran the block verbatim with escalated Docker: readiness loop observed `no response` then `accepting connections`; every step exit 0; containers cleaned up | implemented |

## Active Project Guardrails
- None recorded (`ai/thoughts/design-lens.md` states no active project-specific guardrails). Conformance checked against ticket, governing plan, and plans only.

## Open Questions and Assumptions
- None affecting correctness of the committed fixture. Criterion 1 remains open by design until the developer performs the dashboard preflight; it is not represented as passed.

## Verification Results
- PASS — `node --test poc/mcp-server/tests/structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs` — 12/12 tests pass.
- PASS — Verbatim `poc/README.md` Docker sequence (escalated): `docker run --name loomspan-poc-pg -e POSTGRES_PASSWORD=poc-local-only -p 54329:5432 -d postgres:16`, `pg_isready` loop, migration (exit 0), seed (exit 0), `fixture.assertions.sql` (exit 0), seed re-run (exit 0, all `INSERT 0 0`), assertions re-run (exit 0), `docker rm -f loomspan-poc-pg`, Node tests (12/12).
- PASS — Independent probe on a second fresh `postgres:16` container: direct `SELECT` of the stored definition JSON (both operations with argument definitions), per-pack rows, insertion-order items; `INSERT` of a rejected tool-call log row with NULL `user_id`; quantity-0 item insert rejected with check-violation (exit 1 as expected). Container removed; `docker ps -a --filter name=loomspan` confirms no leftovers.
- NOT RUN — Live Supabase preflight (OAuth 2.1 enablement, DCR toggle, JWT signing algorithm) and hosted test-owner creation/UUID replacement: developer dashboard actions by ticket design; never automated, and no live claim is made. Residual risk: criterion 1 is unverified until the developer completes the README table (or the blocker branch fires).

## Residual Risks and Optional Developer Checks
- Residual risk: hosted-project preflight state is unknown. If any of the three items cannot be enabled on Loomspan Testing, the ticket requires recording a blocker with cause unconfirmed and stopping for a developer decision.
- Optional developer checks: perform the Phase 1 dashboard preflight and transcribe the redacted table; create the synthetic test owner, replace the placeholder membership UUID on the hosted project, and confirm the row; visually confirm the README contains no key/token/credential before commit.

## Disposition
- `clean`
