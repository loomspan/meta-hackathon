# 2026-10-27-04-poc-gate1-run-and-evidence Code Review — Cycle 2

## Scope and Repository State

- Ticket (controlling, ticket-led fast-track; no research/plan/testing artifacts required): `ai/thoughts/tickets/2026-10-27-04-poc-gate1-run-and-evidence.md`, governing plan `ai/thoughts/plans/proof_of_concept.md` (Gate 1, Results worksheet, Decision after the experiment). Selected profile: `fast-track`; developer approval recorded in the ticket's Execution notes (2026-10-28).
- Independent reconstruction from Git at HEAD `1f2b275` (no prior review document read or used; a prior-cycle review file exists untracked and was excluded). Ticket-scoped diff: modified `ai/thoughts/tickets/2026-10-27-04-poc-gate1-run-and-evidence.md`, `poc/README.md`, `poc/mcp-server/supabase/functions/mcp/core.test.ts` (test-only); untracked `poc/fixtures/grocery-list-v2-update.sql`, `poc/fixtures/gate1-worksheet-muse.md`, `poc/fixtures/gate1-worksheet-chatgpt-web.md`, `poc/mcp-server/tests/gate1-artifacts.test.mjs`. No production MCP code (`core.ts`, `data.ts`, `index.ts`), schema/migration, seed, or web page changed.
- Reviewed in full: the v2 SQL, both worksheets, the Gate 1 runbook section of `poc/README.md` (including the inline version-1 reset), both test files, and the connected executor path (`core.ts` version-check precedence and generic delete effect, `data.ts` per-call DB definition/pack loads, migration schema, v1 seed/expected fixture).

## Findings

No actionable findings.

Review notes (verified, not findings): the Deno G1.7 test exercises the stale→`get_pack`→retry-once sequence with `remove_item`, while the runbook prescribes `add_item` for the companion-facing stale call; the components are separately covered (stale `add_item` rejection, v2 `remove_item` execution, exactly-one-write retry), and the runbook sequence itself is executable as written, so this is a coverage-shape observation, not a defect.

## Findings Resolved in This Context

None — no implementation artifact was changed in this context.

## Acceptance-Criteria and Plan Conformance

| Criterion/decision | Code evidence | Test evidence | Result |
| --- | --- | --- | --- |
| AC1: v2 fixture update artifact + per-surface runbook in repo; no Edge Function change/redeploy/reconnect/tool change | `poc/fixtures/grocery-list-v2-update.sql` touches only `poc_app_definitions`/`poc_apps`/`poc_packs`, guarded 1→2 and idempotent; `data.ts` loads definitions/packs from Postgres per call (no caching, no code path change); runbook in `poc/README.md` "Gate 1 runbook (Ticket 4)" | `gate1-artifacts.test.mjs` (DB-only, definition JSON adds `remove_item` delete-by-name, v1 ops carried forward, pack rules kept out of definition); Deno suite incl. DB-added `remove_item` execution | implemented (criterion checked in ticket) |
| AC2: completed worksheets for both surfaces, every field, G1.1–G1.7 marked | Both worksheets exist as blank `not-run` templates with all 13 plan Results-worksheet fields; no human has run either surface | `gate1-artifacts.test.mjs` asserts every field, each G1 row `not-run`, none pre-marked passed | partial — correctly remains unchecked (human-run-dependent) |
| AC3: per-surface cold-setup duration/manual steps, native-vs-session for Build/Run and app pack, fresh-chat behavior recorded separately | Worksheets have separate Build/Run, app-pack, fresh-chat rows plus a pack-delivery table (Build, Run, grocery, fresh-chat reload) and run-measurements table | Static assertions on the four never-merged outcomes and per-pack rows | partial — template implemented; values correctly `not-run`, criterion unchecked |
| AC4: G1.6 and G1.7 separate results with tool-log evidence, exactly one write after retry | Runbook scores them separately; G1.6 runs in conversation A after the operator bump, G1.7 returns to untouched conversation B holding v1 and prescribes a stale `add_item` call (an operation the v1 pack knows), `stale_version` before mutation, one `get_pack`, one v2 retry, exactly one write, with a not-observed fallback if the companion reloads early; between-surfaces reset restores the v1 fixture (guarded transaction, v1 pack text matching the seed) | Deno G1.7 sequence test (stale rejected, 0 mutations; `get_pack` at v2; one retry, exactly 1 mutation) plus pre-existing stale-precedence test | partial — mechanism proven locally; surface evidence correctly `not-run`, criterion unchecked |
| AC5: every blocker dual-classified (category + root cause/unknown), workaround burden stated | Runbook scoring rules enumerate all 7 categories and 5 root causes, eligibility-vs-runtime distinction, OAuth cause-unconfirmed until checked against the ticket-3 reference flow; worksheets carry a dual-classification blocker table with burden/remedy columns | Static assertions on categories, causes, burden, cause-unconfirmed wording | partial — template implemented; no real blockers yet, criterion unchecked |
| AC6: stored evidence contains no credentials or tokens | No run evidence stored yet; runbook/worksheets prohibit credentials and require `[REDACTED]`; secret search over all new/changed artifacts found no token/secret material | `secret-scan.test.mjs` passed in the full Node run | partial — nothing stored to violate it; correctly unchecked until evidence exists |
| AC7: Gate 1 exit decision recorded in plan categories citing per-surface evidence | Decision recorded as **pending / not-run** in the runbook and both worksheets, with the exact evidence required and the four plan categories stated; no go/narrow/revise/stop verdict fabricated | Static assertions on `pending / not-run` and all four categories | partial — pending state correctly recorded; criterion unchecked |
| Plan: pack-delivery outcomes never merged; native install not required if repeatable loading works | Stated in runbook scoring rules and worksheet pack table with four distinct outcomes | Static assertions | implemented (as recording rule) |
| Plan/ticket: do not fix fixture defects in this ticket; escalate MCP/schema/pack-semantics/web changes to full | Diff contains no such change; v2 pack-text update is the ticket's own fixture-update artifact | Diff inventory (above) | implemented |

## Active Project Guardrails

- None recorded (`ai/thoughts/design-lens.md` states no active project-specific guardrails).

## Open Questions and Assumptions

- None affecting correctness. Human Gate 1 runs on Muse and ChatGPT web remain outstanding by design (ticket Pipeline notes).

## Verification Results

- PASS — `node --test poc/mcp-server/tests/gate1-artifacts.test.mjs` — 5/5 pass.
- PASS — `node --test poc/mcp-server/tests/gate1-artifacts.test.mjs poc/mcp-server/tests/mcp-structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs poc/mcp-server/tests/structure.test.mjs poc/web/tests/consent-core.test.mjs poc/web/tests/web-structure.test.mjs` — 35/35 pass, no live service contacted.
- PASS — `& "$env:USERPROFILE\.deno\bin\deno.exe" test poc/mcp-server/supabase/functions/mcp/core.test.ts` — 8 passed, 0 failed (output `ok | 8 passed`; the PowerShell wrapper surfaced Deno's stderr colour codes as a NativeCommandError exit, the test summary itself is a pass).
- NOT RUN — Local Postgres application of `grocery-list-v2-update.sql` (migration + v1 seed, apply twice): Docker daemon unreachable from the sandbox and no local Postgres binaries; residual risk is low — the SQL is three guarded statements against the reviewed schema, its definition JSON is parsed and compared by the Node suite, and idempotency follows from `ON CONFLICT DO NOTHING` plus `current_version = 1`/`version = 1` guards inspected directly.
- NOT RUN — Hosted/human Gate 1 runs (G1.1–G1.7 on Muse and ChatGPT web): no human tester has run either surface; per ticket instructions these are never routine verification and must stay `not-run`.

## Residual Risks and Optional Developer Checks

- The Step 4 ticket note claims a local-Postgres v2 apply/re-apply proof; this review could not reproduce it (Docker unavailable) and relied on static guard inspection plus the Node/Deno suites. A developer with Docker can re-run it via the README local-fixture recipe plus the v2 file.
- Companion behaviour (whether each surface preserves the v1 pack in conversation B, reloads on request, follows pack-only rules) is exactly what the pending human runs must establish; the runbook records a not-observed fallback if the stale call cannot be elicited.

## Disposition

- `clean`

Profile reassessment: the diff changes no MCP server behaviour, pack semantics beyond the ticket's own v2 fixture artifact, schema, or web pages; the fast-track eligibility holds and no full-profile trigger was found.
