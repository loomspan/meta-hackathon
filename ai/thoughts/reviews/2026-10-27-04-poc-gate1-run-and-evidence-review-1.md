# 2026-10-27-04 Run Gate 1 on Muse and ChatGPT web and record the go/narrow/revise/stop evidence Code Review — Cycle 1

## Scope and Repository State

- Ticket-led fast-track (developer approved 2026-10-28); no research/implementation-plan/testing-plan artifacts exist and none were required. Governing plan: `ai/thoughts/plans/proof_of_concept.md` (Gate 1, Results worksheet, Decision after the experiment).
- Reviewed the actual diff vs `HEAD` independently (tracked, staged/unstaged, and untracked): `ai/thoughts/tickets/2026-10-27-04-poc-gate1-run-and-evidence.md` (AC1 checked + execution notes), `poc/README.md` (Gate 1 runbook), `poc/mcp-server/supabase/functions/mcp/core.test.ts` (new G1.7 Deno test only), plus untracked `poc/fixtures/grocery-list-v2-update.sql`, `poc/fixtures/gate1-worksheet-muse.md`, `poc/fixtures/gate1-worksheet-chatgpt-web.md`, `poc/mcp-server/tests/gate1-artifacts.test.mjs`. No prior review document was read (none exists).
- Profile reassessment: the diff changes no MCP server behavior, pack semantics beyond the ticket's own version-2 fixture artifact, schema, Edge Function code, or web pages. `core.test.ts` is test-only. Fast-track eligibility holds; no full-profile trigger. No escalation.

## Findings

### [P2] Make the G1.7 stale-version call actually occur, in a conversation that still holds version 1
- Location: `poc/README.md:246-256` (pre-fix)
- Scenario: The runbook ran G1.6 in an unspecified "companion conversation" and then directed G1.7 in "the G1.5 conversation, kept open across the G1.6 update". A tester following the sequence linearly would run G1.6 in the most recent (G1.5) conversation, loading the version-2 pack there and destroying the version-1 state G1.7 depends on, forcing a not-observed result. Independently, the G1.7 prompt asked that conversation to `remove_item` ("Remove Apples…") — an operation the version-1 pack never disclosed, so the companion had no basis to issue the stale call the ticket requires as tool-log evidence.
- Impact: G1.7 could not reliably produce its required evidence (stale `app_version` 1 rejection, one `get_pack`, exactly one version-2 write), failing a primary acceptance criterion through runbook construction rather than companion behavior.
- Evidence: Pre-fix `poc/README.md` G1.6/G1.7 paragraphs; version-1 operations are only `list_items`/`add_item` in `poc/mcp-server/supabase/seed.sql:13` and `poc/fixtures/expected-fixture.json`.
- Fix: Applied in this context (see Findings Resolved).

### [P2] Provide an executable version-1 reset so the second surface runs the identical sequence
- Location: `poc/README.md:191,210` (pre-fix)
- Scenario: After surface 1 completes G1.6/G1.7 the hosted fixture is at version 2 with mutated items (Bread/Eggs added, Milk removed). The runbook required each surface to run identically from version 1 but gave no reset procedure; re-running `seed.sql` cannot restore it because its inserts are `ON CONFLICT DO NOTHING` and items are inserted only when the table is empty (`poc/mcp-server/supabase/seed.sql:5-58`).
- Impact: The second surface (or any repeat run) could not start G1.1–G1.5 against the version-1 fixture the runbook's own preconditions demand.
- Evidence: Pre-fix "Before either surface runs" step 1 and per-surface sequence heading; `seed.sql` idempotence guards.
- Fix: Applied in this context (see Findings Resolved).

## Findings Resolved in This Context

- [P2] G1.7 preservable and well-formed: `poc/README.md` now names conversation A (original G1.1–G1.4) and conversation B (fresh G1.5), directs G1.6 into conversation A only with B left untouched holding version 1, and rewrites the G1.7 prompt to `Add Pears to my grocery list with quantity 3, using the app version you already have loaded.` — a stale `add_item` call the version-1 pack knows, followed by `get_pack` and exactly one version-2 write. `poc/mcp-server/tests/gate1-artifacts.test.mjs` updated to expect the new prompt and to assert the conversation separation and `add_item` stale call.
- [P2] Between-surface reset: `poc/README.md` gained an OPERATOR "Between surfaces: restore the version-1 fixture" section with explicit SQL (restore seeded items, delete the version-2 definition, set app and pack back to version 1 with the exact version-1 pack instructions from `seed.sql`), a note that re-running `seed.sql` alone is insufficient, and a requirement to re-confirm version 1 and record the reset. The artifact test asserts the reset section and the version-2 definition deletion.

## Acceptance-Criteria and Plan Conformance
| Criterion/decision | Code evidence | Test evidence | Result: implemented/partial/missing/safe deviation |
| --- | --- | --- | --- |
| AC1: v2 update artifact + per-surface runbook in repo; no Edge Function change/reconnect | `poc/fixtures/grocery-list-v2-update.sql` (DB-only, guarded 1→2, idempotent); `poc/README.md` Gate 1 runbook | `gate1-artifacts.test.mjs` (DB-only, guards, prompts, per-surface G1.1–G1.7); Deno G1.7 test | implemented |
| AC2: completed worksheet per surface, every field, G1.1–G1.7 passed/failed/blocked/not-run | Blank `not-run` worksheets at `poc/fixtures/gate1-worksheet-muse.md`, `gate1-worksheet-chatgpt-web.md` | Artifact test asserts every worksheet field and `not-run` G1 rows | partial — correctly not-run; no human has run either surface |
| AC3: per-surface cold-setup duration/steps, native vs session for Build/Run and app pack, fresh-chat behavior | Separate worksheet fields, pack-delivery table (Build/Run/app scored separately), run-measurement rows | Artifact test asserts fields and distinct pack outcomes | partial — template implemented; values correctly not-run |
| AC4: G1.6/G1.7 separate results with tool-log evidence, exactly one write | Separate worksheet rows; runbook G1.6/G1.7 with ordered tool-log evidence (as fixed) | Deno test proves stale rejection before mutation, `get_pack`, exactly one write; artifact test asserts separation | partial — mechanism proven locally; surface evidence correctly not-run |
| AC5: every blocker dual-classified with workaround burden | Worksheet blocker table (category + root cause + burden); runbook scoring rules | Artifact test asserts all categories, causes, burden, `cause-unconfirmed` | partial — template implemented; no real blockers yet |
| AC6: stored evidence contains no credentials/tokens | Runbook/worksheets prohibit credentials; no evidence stored yet | `secret-scan.test.mjs` passes over the diff scope; manual regex scan of new files found nothing | implemented for current artifacts; future evidence is human-captured |
| AC7: Gate 1 exit decision in plan categories citing per-surface evidence | Decision recorded as **pending / not-run** in runbook and both worksheets with required evidence stated; no verdict fabricated | Artifact test asserts `pending / not-run` and all four decision categories present | partial — correctly pending; must remain unchecked until both surfaces run |
| Plan: pack outcomes never merged; persistent install not required if repeatable loading works | Worksheets/runbook score native install, session load, repeatable fresh-chat load, manual workaround separately | Artifact test asserts all four outcomes per worksheet | implemented (template/runbook) |
| Plan/ticket: v2 update is DB-only, no redeploy/reconnect/tool change | SQL touches only `poc_app_definitions`, `poc_apps`, `poc_packs`; diff touches no Edge Function source | Artifact test asserts no function/tool references; structure tests pass | implemented |
| Ticket: stop after one attempt + one targeted correction; thresholds as recording requirements | Runbook G1.1 and scoring rules; worksheet measurement rows | Artifact test asserts stop rule and 10-minute target | implemented (runbook) |

## Active Project Guardrails
- None recorded (`ai/thoughts/design-lens.md` is an empty placeholder).

## Open Questions and Assumptions
- None. Human-run-dependent criteria are honestly unchecked/not-run in the ticket, worksheets, and runbook; the exit decision is pending, not a fabricated verdict.

## Verification Results
- PASS — `node --test poc/web/tests/consent-core.test.mjs poc/web/tests/web-structure.test.mjs poc/mcp-server/tests/gate1-artifacts.test.mjs poc/mcp-server/tests/structure.test.mjs poc/mcp-server/tests/mcp-structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs` — 35/35 pass (includes the 5 new Gate 1 artifact tests, re-run after fixes).
- PASS — `& "$env:USERPROFILE\.deno\bin\deno.exe" test poc/mcp-server/supabase/functions/mcp/core.test.ts` — 8 passed, 0 failed (includes the new G1.7 sequence test; `deno` is not on PATH in this shell, invoked by full path).
- NOT RUN — Hosted/human Gate 1 runs on Muse and ChatGPT web: no human tester has run either surface; per ticket these are not-run, never passed. No live/hosted service was contacted and no credentials were used in this review.

## Residual Risks and Optional Developer Checks
- The Deno G1.7 test simulates the version-2 update with a fake repository; it proves executor semantics (stale rejection before mutation, exactly one retry write), not the hosted SQL artifact against hosted Postgres. Hosted application remains an operator mid-run step in the runbook.
- Optional developer check: after a human completes the first surface, verify the between-surface reset returns app/pack to version 1 with seeded items before starting the second surface.

## Disposition
- `fixes-applied`
