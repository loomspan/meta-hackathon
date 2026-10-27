# 2026-10-27-02-poc-mcp-server-gate1-tools Code Review — Cycle 1

## Scope and Repository State
- Ticket: `ai/thoughts/tickets/2026-10-27-02-poc-mcp-server-gate1-tools.md`; research, implementation plan, and testing plan read in full. No prior review read (none exists).
- Base: `main` at `826814c`. Ticket-scoped change is entirely uncommitted: modified `poc/README.md`, `poc/fixtures/expected-fixture.json`, `poc/mcp-server/supabase/config.toml`, `poc/mcp-server/supabase/seed.sql`, `poc/mcp-server/tests/fixture.assertions.sql`, `poc/mcp-server/tests/structure.test.mjs`; deleted `poc/mcp-server/supabase/functions/mcp/.gitkeep`; new `core.ts`, `data.ts`, `index.ts`, `core.test.ts`, `poc/mcp-server/tests/mcp-structure.test.mjs` (plus the untracked research/plan artifacts, which are Step 1–3 outputs, not implementation).
- All changed production files were read in full and traced beyond diff hunks (handlers → executor → repo interface → Supabase implementation → seed/schema). Profile remains Full 5-Step Pipeline: external protocol + authorization boundary + persisted-contract triggers all apply; no reassessment escalation.

## Findings

### [P2] Malformed top-level tool arguments bypassed structured errors and logging
- Location: `poc/mcp-server/supabase/functions/mcp/index.ts:59,68,71` (pre-fix)
- Scenario: `get_pack` with a missing/empty `pack_id`, or `call_operation` with a missing/empty `app_id` or `operation`, is rejected by the Zod input schema before the handler runs.
- Impact: The caller gets an SDK protocol error instead of the ticket-required structured, actionable payload (`unknown_pack`/`unknown_app`/`unknown_operation`), and no tool-call log row is written — even though `core.ts` already implements exactly those cases (`handleGetPack` non-string/empty pack, `handleCallOperation` missing app/operation) and the plan's Phase 3 note applies this same reasoning to `app_version` only.
- Evidence: Pre-fix schemas used `z.string().min(1)` for `pack_id`/`app_id`/`operation`; core handlers accept `unknown` and judge those cases themselves but were unreachable for them. A reviewer probe also confirmed `z.unknown()` alone still rejects a missing key, so `.optional()` is required.
- Fix: All judged fields now use `z.unknown().optional()` in `index.ts`, so the core produces the structured payload and the log row.

### [P3] Pre-handler 401 log write could replace the 401 response
- Location: `poc/mcp-server/supabase/functions/mcp/index.ts:99` (pre-fix)
- Scenario: A parseable unauthenticated `tools/call` returns 401, then `serviceRepo()` is evaluated outside `safeInsertLog`'s try/catch; `createClient` with missing/empty `SUPABASE_URL`/service-role env throws.
- Impact: The exception replaces the 401 response, violating the plan Q6 rule that a log-write failure never changes the tool response.
- Evidence: `await safeInsertLog(serviceRepo(), ...)` — argument construction precedes the guarded call.
- Fix: The wrapper logging block is wrapped in try/catch that logs `tool-call log write failed` and returns the original response.

### [P3] In-handler unauthenticated payload was returned without any log row
- Location: `poc/mcp-server/supabase/functions/mcp/index.ts:45-46,54,60,76` (pre-fix)
- Scenario: The auth pipeline passes but `supabase.auth.getUser()` yields no user (e.g. deleted user/error), so `requireUser()` short-circuits the tool handlers.
- Impact: The tool call returns `unauthenticated` but writes no `poc_tool_call_log` row, violating "write every tool call to the tool-call log"; the 401 wrapper does not fire because the HTTP status is 200.
- Evidence: `toolResult(requireUser() ?? ...)` bypassed the handlers, which are the only in-handler log writers via `finish`.
- Fix: Each tool now routes the no-user case through `rejectUnauthenticated`, which writes the `unauthenticated` log row (tool/app/operation/version/environment only, never arguments) before returning the payload.

### [P3] Stored list `order` direction `desc` was validated but silently ignored
- Location: `poc/mcp-server/supabase/functions/mcp/core.ts:165-173,201-203` (pre-fix)
- Scenario: A DB-stored definition declares a list effect with `order: [{field: "id", direction: "desc"}]`.
- Impact: `validateEffect` accepted `desc`, but the executor and `data.ts listItems` always return ascending `id`, so the DB-driven definition's stated ordering is silently not honored — the same class of failure as a blocked DB-added operation, in miniature.
- Evidence: Executor returned `repo.listItems` order unchanged; repo hardcodes `order("id", { ascending: true })`.
- Fix: The executor now sorts by `id` in the effect's declared direction. Covered by a new fake-repo test.

### [P3] Delete executed as SELECT-then-DELETE, so reported removals could diverge from actual deletions
- Location: `poc/mcp-server/supabase/functions/mcp/data.ts:50-59` (pre-fix)
- Scenario: Two concurrent `remove_item`-style calls (or a concurrent insert matching the criteria) interleave between the SELECT and the DELETE.
- Impact: Rows inserted between the statements are deleted but not reported in `removed`; the response understates the mutation.
- Evidence: Two separate awaited statements built from the same criteria.
- Fix: Single `delete().eq(...).select("id,name,quantity")` statement returning exactly the deleted rows.

### [P3] Insert/delete effects could reference optional arguments, sending `undefined` to the database
- Location: `poc/mcp-server/supabase/functions/mcp/core.ts:175-188` (pre-fix)
- Scenario: A stored definition declares an insert field or delete match on an argument with `required` not set, and a call omits it.
- Impact: `values[field]` is `undefined`, producing an insert with an undefined field or a PostgREST `eq` on `undefined` — an `internal_error` (or worse, an ill-defined match) instead of failing closed as the plan's effect-allowlist design intends.
- Evidence: `validateEffect` checked only that fields/match are declared argument names in the column allowlist.
- Fix: `validateEffect` now requires insert fields and delete match fields to be `required: true` arguments, else `invalid_definition` with no query issued. Covered by a new fake-repo test.

## Findings Resolved in This Context
All six findings above were fixed in this context:
- `poc/mcp-server/supabase/functions/mcp/index.ts` — `z.unknown().optional()` for all core-judged tool fields; `rejectUnauthenticated` log-writing path for the no-user case in all three tools; try/catch around the 401 wrapper's log write.
- `poc/mcp-server/supabase/functions/mcp/core.ts` — executor honors the stored list order direction; `validateEffect` requires insert/delete fields to be required arguments.
- `poc/mcp-server/supabase/functions/mcp/data.ts` — atomic single-statement delete returning the removed rows.
- `poc/mcp-server/supabase/functions/mcp/core.test.ts` — new test covering list `desc` ordering and the optional-match `invalid_definition` case (zero item queries, zero mutations).

Re-review after fixes: full diff re-read; no further actionable findings. Remaining known limits are recorded under Residual Risks, not findings, because they are gated on environments unavailable to this review.

## Acceptance-Criteria and Plan Conformance
| Criterion/decision | Code evidence | Test evidence | Result |
| --- | --- | --- | --- |
| Owner `list_apps` summary without instructions; unauthenticated rejected | `core.ts handleListApps` (member-only summaries); `index.ts` auth pipeline + 401 wrapper + `rejectUnauthenticated` | Deno list_apps/member/empty cases; 401 serve probe NOT RUN (no local stack) | partial (hosted/local-serve evidence pending) |
| `get_pack` Build/Run/grocery by ID with version, instructions, app-only operations/arguments, `effect` stripped | `core.ts handleGetPack` | Deno three-pack, unknown-pack, non-member cases | implemented |
| Owner lists in insertion order, adds, persists in later list | Executor `list`/`insert` over `listItems ORDER BY id ASC` | Deno list→add→list sequence | implemented |
| Empty name / invalid quantity mutates nothing, actionable guidance | `validateArguments` (trim+min_length, strict integer, minimum) | Deno table-driven invalid variants, mutation count 0 | implemented |
| Stale `app_version` after bump mutates nothing, exact `stale_version` payload | Stale check in `handleCallOperation` before dispatch | Deno stale read+write exact-payload tests | implemented |
| DB-only update adds operation; shown by `get_pack`, executed by `call_operation`, no redeploy | Declarative `effect` interpreter; no operation-name dispatch | Deno `remove_item` failing-test-first case; Node no-dispatch guard | implemented |
| Non-member cannot list/mutate; each rejection recorded | Membership gates in `handleCallOperation`/`handleGetPack`/`handleListApps` + log writer | Deno non-member read/write + `rejected/not_member` log rows | implemented |
| Log entries for all calls, no credentials/tokens | `shapeLogRow`/`safeInsertLog`; 401 wrapper extracts only tool/app/operation/version/environment | Deno log-shaping cases incl. secret-argument scan; Node token/header logging scan | implemented |
| Plan Q1–Q10 decisions (effect vocabulary, privileged client + explicit checks, wire shapes, error taxonomy/precedence, version source, logging, environment, `verify_jwt = false`, hosted runbook, guard updates) | `core.ts`/`data.ts`/`index.ts`/`config.toml`/seed/expected-fixture/README as planned | Deno + Node suites | implemented (Q9 hosted steps remain developer-performed) |

## Active Project Guardrails
- None recorded (`ai/thoughts/design-lens.md` states no active project-specific guardrails). Review proceeded from the ticket, governing plan, and research.

## Open Questions and Assumptions
- None blocking. The hosted preflight (OAuth 2.1, dynamic client registration, asymmetric JWT) remains NOT VERIFIED per `poc/README.md`; per the parent brief, hosted acceptance is treated as optional developer checks, not pass/fail gates for this review.

## Verification Results
- PASS — `node --test "poc/mcp-server/tests/*.mjs"` — 17 passed, 0 failed (structure, secret-scan, mcp-structure guards). Note: `node --test poc/mcp-server/tests/` (directory form) fails on this Windows/Node combination with a module-resolution error; the glob form is the working invocation.
- PASS — `deno test poc/mcp-server/supabase/functions/mcp/core.test.ts` — 7 passed, 0 failed (6 pre-existing + 1 added by this review).
- PASS — `deno check poc/mcp-server/supabase/functions/mcp/index.ts` (also `core.ts`, `data.ts`) — exit 0, zero type errors.
- PASS — reviewer Zod probe via `deno eval` — confirmed `z.unknown()` rejects missing keys (`missing false`), motivating the `.optional()` fix.
- NOT RUN — Docker from-empty fixture sequence in `poc/README.md` §Local fixture setup — Docker pipe access denied in this sandbox (`permission denied while trying to connect to the docker API at npipe:////./pipe/docker_engine`); requires escalated Docker. The `effect` SQL assertions therefore have no fresh execution evidence in this cycle.
- NOT RUN — Local serve smoke (`supabase start` / `functions serve mcp`, unauthenticated 401 probe) and all hosted acceptance — Supabase CLI not installed and hosted preflight unverified; developer-performed per plan Phase 5.

## Residual Risks and Optional Developer Checks
- `data.ts` (including the new single-statement delete) and the `index.ts` MCP/Supabase pipeline wiring are type-checked but have no integration execution evidence; the fake-repo tests cover `core.ts` only. The first local serve against a real Postgres is the earliest point these paths execute.
- `deno lint`/`deno fmt` are not configured gates in this repo (no `deno.json`, no CI) and were not used as pass/fail evidence; pre-existing lint noise in test files is unchanged by this review.
- Optional developer checks: complete the README preflight table, owner/non-member setup and membership UUID replacement, hosted deploy, and the hosted acceptance sequence (including log inspection), recording only redacted results; run the Docker from-empty sequence where Docker is available.

## Disposition
- `fixes-applied`
