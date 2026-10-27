# 2026-10-27-02-poc-mcp-server-gate1-tools Code Review — Cycle 2

## Scope and Repository State

- Ticket: `ai/thoughts/tickets/2026-10-27-02-poc-mcp-server-gate1-tools.md`; research, implementation plan, and testing plan for the same stem read in full. Prior review documents were not read.
- Repository state reconstructed from Git: base commit `826814c` (ticket-1 foundation); all ticket-2 work is unstaged/untracked working-tree changes. No staged changes.
- Ticket-scoped changes inventoried: modified `poc/README.md`, `poc/fixtures/expected-fixture.json`, `poc/mcp-server/supabase/config.toml`, `poc/mcp-server/supabase/seed.sql`, `poc/mcp-server/tests/fixture.assertions.sql`, `poc/mcp-server/tests/structure.test.mjs`; deleted `poc/mcp-server/supabase/functions/mcp/.gitkeep`; new `poc/mcp-server/supabase/functions/mcp/{core.ts,data.ts,index.ts,core.test.ts}` and `poc/mcp-server/tests/mcp-structure.test.mjs`. Untracked plan/research artifacts for this ticket are pipeline artifacts, not implementation scope. No unrelated dirty files observed.
- Files read in full: `core.ts`, `data.ts`, `index.ts`, `core.test.ts`, `mcp-structure.test.mjs`, `structure.test.mjs`, `secret-scan.test.mjs`, `seed.sql`, `config.toml`, migration schema, `fixture.assertions.sql`, `expected-fixture.json` (via diff), and `poc/README.md`.
- Selected profile: full (Full 5-Step Pipeline). Reassessment: no profile mismatch — the ticket itself names the full triggers (external MCP protocol, authorization boundary, persisted definition contract), and the implementation matches that scope. No escalation.

## Findings

No actionable findings.

Review notes (candidates checked and cleared):

- Executor is genuinely DB-driven: `core.ts` contains no operation-name dispatch (verified by reading and by `mcp-structure.test.mjs`); behavior comes from the stored `effect` descriptor (`list`/`insert`/`delete` over the single allowlisted `grocery_items` resource, column allowlists `name|quantity` plus `id` for match). `validateEffect` requires insert/match fields to be declared *required* arguments, so a definition cannot insert/match on an unvalidated optional value. The fake-repo test adds `remove_item` at runtime (definition data only, version bumped to 2) and executes it — the ticket `:17,31` contract.
- Authorization: membership is checked in `handleCallOperation` before version/definition/operation resolution beyond app existence (non-member learns neither operation validity nor stale state), in `handleGetPack` for app packs, and `list_apps` returns member apps only. The privileged client in `data.ts` issues only parameterized supabase-js queries; no SQL is built from definition content.
- Version contract: stale check compares against a fresh `poc_apps.current_version` read, applies to reads and writes, runs before any mutation, and returns exactly `{ok:false, error_code:"stale_version", current_version, guidance}` (asserted by deep equality in tests).
- Validation: strict JSON typing (floats, numeric strings, booleans, null rejected for `integer`; trim-then-`min_length` for strings; unknown/extra arguments rejected), all before mutation, with mutation counters asserted at 0 in tests.
- Logging: every handler path funnels through `finish`/`safeInsertLog`; log failure never alters the payload (tested). The pre-handler 401 wrapper in `index.ts` extracts only tool/app/operation/version/environment from a parseable `tools/call` — never `arguments`, headers, or tokens (tested with a sentinel argument value). Log rows carry no credential-like fields (key scan asserted).
- Error taxonomy/precedence matches plan Q4: `unknown_app` → `not_member` → malformed `app_version` (`invalid_arguments`) → `stale_version` → `unknown_operation` → argument/environment `invalid_arguments` → `invalid_definition` → `item_not_found`/`internal_error`. No stack traces, SQL, or token material appear in any payload.
- Scope: exactly three tools registered (statically asserted); no Gate 2 names; `verify_jwt = false` set for the function per the Supabase guide pattern; `.gitkeep` removed.

## Findings Resolved in This Context

None — this context made no implementation-artifact changes.

## Acceptance-Criteria and Plan Conformance

| Criterion/decision | Code evidence | Test evidence | Result: implemented/partial/missing/safe deviation |
| --- | --- | --- | --- |
| Owner `list_apps` returns grocery summary without instructions; unauthenticated rejected | `core.ts handleListApps` (member-only, summary fields only); `index.ts` auth pipeline + 401 logging wrapper | Deno: member/non-member/empty list, no `instructions`/`operations` keys; unauthenticated shaping unit-tested. Hosted/local 401 probe NOT RUN (optional developer check) | implemented (hosted proof optional, per ticket `:37`) |
| `get_pack` returns Build, Run, grocery packs by ID with version, instructions, app-pack operations/arguments | `core.ts handleGetPack`; app-pack version from `poc_apps.current_version`, `effect` stripped | Deno: three pack IDs, app-only operations, unknown pack, non-member app pack, Build/Run open to non-member | implemented |
| Owner lists items in insertion order, adds, persists in later list | Executor `list`/`insert` over `listItems` ordered by `id asc` (`data.ts`) | Deno list→add→list sequence asserts Oats, Apples, Milk, Eggs order | implemented |
| Empty name / invalid quantity mutates nothing, actionable guidance | `validateArguments` (trim + `min_length`, strict integer, `minimum`) | Deno table-driven: 12 invalid variants + staging environment, mutation count 0; trimmed-name and quantity-1 controls pass | implemented |
| Previous `app_version` after bump mutates nothing; `stale_version` with current version + reload guidance | Stale check in `handleCallOperation` before dispatch | Deno: stale read and write, exact payload deep-equality, mutations 0 | implemented |
| DB-only definition update adds an operation; `get_pack` shows it, `call_operation` executes it, no redeploy | `effect` interpreter (plan Phase 1/2); no name dispatch | Deno failing-test-first: `remove_item` unknown at v1, executes after definition-only v2 change; Node no-dispatch guard | implemented |
| Non-member cannot list or mutate; each rejected call recorded | Membership gates in `handleCallOperation`/`handleGetPack`/`handleListApps` + log writer | Deno: non-member read/write rejected, log rows `rejected/not_member`, mutations 0 | implemented |
| Tool-call log entries for the above, no credentials/tokens | `shapeLogRow`, `data.ts insertLog`, 401 wrapper in `index.ts` | Deno log-shaping for all tools/outcomes incl. log-failure passthrough and sentinel-argument extraction; Node secret scan over `poc/` | implemented |
| Plan Q1–Q10 decisions (effect contract, privileged client + explicit checks, wire shapes, taxonomy, version source, logging fields, environment rule, `verify_jwt=false`, hosted runbook, test-guard updates) | `seed.sql`/`expected-fixture.json` effects, `config.toml`, `poc/README.md` runbook + hosted definition-update statement, updated `structure.test.mjs` | Deno + Node suites PASS (below); Docker SQL run NOT RUN this cycle | implemented (Docker re-proof outstanding, see Residual Risks) |

## Active Project Guardrails

- None recorded (`ai/thoughts/design-lens.md`: "There are currently no active project-specific design guardrails recorded here."). Reviewed against ticket, governing plan, and plans only.

## Open Questions and Assumptions

- None affecting correctness. The `index.ts` composition (`withOAuthProtectedResource`/`withSupabase` from `@supabase/server@1`, MCP SDK `^2.0.0`, Zod `unknown` schemas delegating judgment to `core.ts`) type-checks but has not been exercised against a live Supabase stack in this environment; that is the recorded optional developer check, not an automated gate.

## Verification Results

- PASS — `deno test poc/mcp-server/supabase/functions/mcp/core.test.ts` — 7 passed, 0 failed (Deno 2.9.8).
- PASS — `deno check poc/mcp-server/supabase/functions/mcp/index.ts` — exit 0, zero type errors.
- PASS — `deno check poc/mcp-server/supabase/functions/mcp/core.ts poc/mcp-server/supabase/functions/mcp/data.ts` — exit 0.
- PASS — `node --test poc/mcp-server/tests/structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs poc/mcp-server/tests/mcp-structure.test.mjs` — 17 passed, 0 failed.
- NOT RUN — Docker from-empty fixture sequence in `poc/README.md` (migration → seed → `fixture.assertions.sql` → seed re-run → assertions) — Docker is unavailable in this sandbox (`permission denied while trying to connect to the docker API at npipe:////./pipe/docker_engine`). The SQL-side `effect` assertions added this ticket are therefore unproven by execution this cycle; the same contract is covered at the TypeScript level by the Deno fake-repo suites. Residual risk recorded below.
- NOT RUN — Hosted Supabase acceptance and local `supabase functions serve` smoke — hosted acceptance is a developer-performed optional check per the ticket and plans (preflight table still NOT VERIFIED; placeholder membership UUID not yet replaced); not represented as passed.

## Residual Risks and Optional Developer Checks

- The Docker SQL sequence was not re-run this cycle, so the new `fixture.assertions.sql` `effect`-containment assertions and seed idempotency with the effect-bearing JSONB rest on source inspection plus the unchanged ticket-1 assertions, not fresh execution. A developer with Docker should run the `poc/README.md` §Local fixture setup sequence verbatim.
- Optional developer checks (nonblocking): complete the README preflight table (or record the blocker), replace the placeholder membership UUID, create a non-member user, run the Phase 1 hosted definition update if the hosted DB was pre-seeded, deploy, and run the hosted acceptance sequence recording only redacted results. Companion OAuth/consent proof remains ticket 3; G1.1–G1.7 scoring remains ticket 4.

## Disposition

- `clean`
