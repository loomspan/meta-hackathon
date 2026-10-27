# MCP Server Gate 1 Tools Testing Plan

## Change Summary
Ticket 2 adds one Supabase Edge Function (`poc/mcp-server/supabase/functions/mcp/`) exposing exactly `list_apps`, `get_pack`, `call_operation` over Streamable HTTP, with Supabase-token authentication, explicit membership checks over a privileged client, stale-version and argument enforcement, a generic executor interpreting the stored definition's new declarative `effect` field (implementation plan Q1), structured errors, and credential-free tool-call logging. This plan covers the new Deno unit tests, the updated Node/SQL foundation guards, and the developer-performed hosted checks. It edits no test or production code.

## Impacted Areas and Risks
| Category | Risk | Planned evidence |
| --- | --- | --- |
| DB-driven executor | Operation names hardcoded (switch/dispatch) so a DB-added `remove_item` cannot execute — fails ticket `:17,31` and triggers reassessment | Fake-repo test adds `remove_item` at runtime and executes it; Node guard asserts no operation-name dispatch in `core.ts` |
| Definition safety | A definition row smuggles arbitrary tables/SQL under the privileged client | Disallowed-`effect` tests (`invalid_definition`, zero repo queries/mutations) |
| Authorization | Non-member reads/mutates shared grocery data through the service-role client | Fake-repo non-member read/write tests; `list_apps` filtering test |
| Version contract | Stale write mutates, or stale payload misses `current_version`/guidance | Stale read+write tests asserting exact payload and mutation count 0 |
| Validation | Float/string/boolean quantity or whitespace name reaches Postgres, or valid boundary (quantity 1, padded name) is wrongly rejected | Table-driven argument tests asserting zero mutations on invalid, trimmed storage on valid |
| Error taxonomy | Wrong `error_code` or precedence leaks data (e.g. `unknown_operation` revealed to a non-member) | Precedence tests (implementation plan Q4 order) |
| Logging | Calls unlogged, or tokens/headers/raw arguments enter `poc_tool_call_log` | Log-shaping tests for all tools/outcomes incl. 401 wrapper fields; Node scan for token/header logging |
| Protocol surface | A fourth (Gate 2) tool is registered, or unauthenticated requests reach handlers | Node guard on registered tool names; 401 serve smoke (optional developer check) |
| Persisted fixture | `effect` seed change breaks ticket-1 recreation or pack-only-rule split | Docker from-empty run with extended `fixture.assertions.sql` |
| Secret hygiene | Service-role key or token value committed in new TypeScript/README | Existing secret-scan suite over `poc/` |

## Existing Coverage and Environment Constraints
- Existing: `poc/mcp-server/tests/structure.test.mjs` + `secret-scan.test.mjs` (Node, 12/12 at commit `826814c`; covers scaffold, placeholder dirs, pack-only rules in seed source, no `ORDER BY name`, fixture ordering, secret patterns) and `poc/mcp-server/tests/fixture.assertions.sql` (Docker Postgres; not re-run in research). Ticket 2 deliberately changes the `structure.test.mjs:27-32` placeholder rule and extends the SQL assertions with `effect` containment (implementation plan Phases 1, 3; research Q10).
- No MCP/HTTP/Deno test precedent exists in the repo; the only runners are Node's built-in `node:test` and Docker `psql`. New function-logic tests therefore use `deno test` with an in-memory fake — the cheapest boundary that proves executor behavior without a hosted project.
- Tooling: Node `v24.22.1` and Docker `29.8.1` present; `deno` and Supabase CLI are **not installed** on this machine (research §Repository State). Installing Deno (and Supabase CLI ≥ 2.117.0 for serve/deploy) is a Step 4 prerequisite (implementation plan Q8). If Deno cannot be installed, the Deno suites are NOT RUN with that reason recorded — never reported as passing.
- Hosted constraints: preflight is NOT VERIFIED, the hosted membership row is a placeholder UUID, and owner/non-member tokens require developer dashboard actions (`poc/README.md:48-60`). No automated test contacts the hosted project, and no test commits a credential or token.

## Failing Test First
- Name: `call_operation executes a DB-added remove_item operation with no server change`
- Type: Deno unit test against the pure core with an in-memory `FixtureRepo` fake
- Location: `poc/mcp-server/supabase/functions/mcp/core.test.ts`
- Arrange/Act/Assert: Arrange a fake repo holding the v1 grocery definition (with Phase 1 `effect`s), items Oats/Apples/Milk, and an owner membership. Act 1: assert `remove_item` returns `unknown_operation`. Then mutate **only the fake definition data** to a version-2 document adding `remove_item` (`effect: {action:"delete", resource:"grocery_items", match:["name"]}`, argument `name`) and bump the fake `current_version` to 2 — no code under test changes. Act 2: `call_operation` `remove_item {name:"Milk"}` at `app_version: 2`. Assert `ok:true`, Milk is gone from the fake items, remaining order is Oats, Apples.
- Expected pre-fix failure: Before implementation the file/module does not exist, so `deno test` fails to load (`core.ts` missing). Once a name-dispatch executor exists, Act 2 fails with `unknown_operation` — the exact ticket failure mode (`ticket:17`). Only the generic `effect` interpreter passes.

## Tests to Add or Update

### 1. `core.test.ts` — list/add happy paths and insertion order
- Type: Deno unit (fake repo)
- Location: `poc/mcp-server/supabase/functions/mcp/core.test.ts`
- Proves: Owner `list_items` returns Oats, Apples, Milk (insertion, not alphabetical); `add_item {name:"Eggs",quantity:6}` persists and a later list returns it last; `list_apps` returns the grocery summary with no `instructions`/`operations` keys; `get_pack` returns `build`, `run`, `grocery-list` by ID, with `operations` (argument definitions, no `effect` key) only on the app pack.
- Inputs/fixture: Fake repo seeded from the Phase 1 definition/pack shapes mirroring `poc/fixtures/expected-fixture.json`.
- Doubles or boundary isolation: In-memory `FixtureRepo` fake counting mutations; no DB, network, or token.
- Edge cases: Non-member `list_apps` returns `apps: []`; `get_pack` unknown ID → `unknown_pack`; non-member `get_pack grocery-list` → `not_member`; Build/Run packs succeed for a non-member authenticated user.

### 2. `core.test.ts` — invalid arguments mutate nothing
- Type: Deno unit (fake repo, table-driven)
- Location: `poc/mcp-server/supabase/functions/mcp/core.test.ts`
- Proves: `add_item` rejects, with `invalid_arguments` and actionable guidance and zero recorded mutations, for: empty name `""`, whitespace-only `"   "`, missing `name`, non-string name; quantity `0`, `-3`, `1.5`, `"2"`, `true`, `null`, missing; unknown extra argument; unsupported `environment: "staging"`. Valid controls pass: quantity `1`; name `"  Eggs  "` stored trimmed as `"Eggs"`.
- Inputs/fixture: Same fake repo; mutation counter asserted after each case.
- Doubles or boundary isolation: Fake repo only.
- Edge cases: Missing/non-integer `app_version` (`undefined`, `1.5`, `"1"`) → `invalid_arguments` before any stale comparison.

### 3. `core.test.ts` — stale version, precedence, and error taxonomy
- Type: Deno unit (fake repo)
- Location: `poc/mcp-server/supabase/functions/mcp/core.test.ts`
- Proves: After the fake `current_version` bumps 1→2, `add_item` and `list_items` at `app_version: 1` return exactly `{ok:false,error_code:"stale_version",current_version:2,guidance:"Call get_pack for this app, then retry once with the current app_version."}` with mutation count 0. Precedence (implementation plan Q4): unknown app beats stale; non-member beats stale and unknown-operation (no operation data leaked); stale beats unknown-operation; unknown-operation beats invalid arguments. `remove_item` for an absent name at the current version → `item_not_found`, no mutation.
- Inputs/fixture: Fake repo with mutable `current_version`.
- Doubles or boundary isolation: Fake repo only.
- Edge cases: Definition row missing at `current_version` → `invalid_definition`; definition with `effect.resource: "poc_apps"` or `action: "update"` → `invalid_definition` and zero repo queries executed against items.

### 4. `core.test.ts` — membership enforcement and log shaping
- Type: Deno unit (fake repo)
- Location: `poc/mcp-server/supabase/functions/mcp/core.test.ts`
- Proves: A signed-in user with no membership row gets `not_member` for `list_items` and `add_item` (mutation count 0). Every handler outcome shapes the Q6 log row: success → `outcome:"ok"`; rejections → `outcome:"rejected"` with the matching `error_code`; `call_operation` rows carry requested `app_id`/integer `app_version`/effective `environment`/operation name; `list_apps` rows carry null app/version/environment; Build/Run `get_pack` rows carry null `app_id`; no shaped row contains an arguments, header, or token field (asserted by key scan of the row object).
- Inputs/fixture: Owner and non-member user IDs in the fake repo.
- Doubles or boundary isolation: Fake repo capturing inserted log rows.
- Edge cases: Log-insert failure (fake throws) leaves the tool payload unchanged; the 401 wrapper shaping (null `user_id`, `rejected`/`unauthenticated`, fields extracted from a parseable `tools/call` only) is unit-tested as a pure function if extracted, otherwise covered by the serve smoke below.

### 5. `mcp-structure.test.mjs` — protocol surface and no-dispatch guards
- Type: Node `node:test` static guards
- Location: `poc/mcp-server/tests/mcp-structure.test.mjs`
- Proves: `index.ts` registers exactly `list_apps`, `get_pack`, `call_operation` and neither Gate 2 name; `core.ts` contains no `switch`/equality dispatch on `"list_items"`, `"add_item"`, or `"remove_item"`; no function source logs headers, `authorization`, or token values, and none contains a service-role key value.
- Inputs/fixture: Source text of `poc/mcp-server/supabase/functions/mcp/*.ts`.
- Doubles or boundary isolation: File-system only.
- Edge cases: `.gitkeep` absent once `index.ts` exists (paired with the updated `structure.test.mjs`).

### 6. Updated foundation suites — `effect` contract and scaffold
- Type: Node `node:test` + Docker SQL assertions (existing harnesses)
- Location: `poc/mcp-server/tests/structure.test.mjs`, `poc/mcp-server/tests/fixture.assertions.sql` (extended), `poc/fixtures/expected-fixture.json` (extended)
- Proves: From-empty recreation yields definition v1 containing both `effect` objects; all ticket-1 assertions (pack-only rules, insertion order, empty log table, at-rest CHECK rejections, seed idempotency counts) still hold.
- Inputs/fixture: Throwaway `postgres:16` container per `poc/README.md` §Local fixture setup.
- Doubles or boundary isolation: Local Docker only; never the hosted project.
- Edge cases: Seed re-run stays idempotent with the effect-bearing JSONB (`ON CONFLICT DO NOTHING`).

## Safe Verification Commands
- Focused: `deno test poc/mcp-server/supabase/functions/mcp/core.test.ts`
- Type check: `deno check poc/mcp-server/supabase/functions/mcp/index.ts`
- Related suite: `node --test poc/mcp-server/tests/`
- Persisted fixture: the Docker sequence in `poc/README.md` §Local fixture setup (migration → seed → `fixture.assertions.sql` → seed re-run → assertions), then `docker rm -f loomspan-poc-pg`
- Full safe suite: Focused + type check + related suite + Docker sequence. No broader suite exists in this repo (no CI, no root `package.json`); nothing here contacts a live service.

## Optional Developer Checks
- Local serve smoke (after installing Deno + Supabase CLI): `supabase start` and `supabase functions serve mcp`; unauthenticated POST `initialize` to `http://127.0.0.1:54321/functions/v1/mcp` with `Accept: application/json, text/event-stream` returns HTTP 401 with a `WWW-Authenticate` header; authenticated owner `tools/call list_apps` returns the grocery summary without instructions.
- Hosted acceptance (after the developer completes the `poc/README.md` preflight table, replaces the placeholder membership UUID, creates a non-member user, applies the Phase 1 hosted definition update if the hosted DB was already seeded, and deploys): owner list/add/persist, invalid add mutating nothing, stale rejection after a scratch version bump (then restored), non-member read/write rejections, and `poc_tool_call_log` rows for each with a no-credential inspection. Tokens are held only in shell environment variables and never recorded.
- These checks are nonblocking for the automated gates and are not represented as already performed. Ticket 3 owns the real companion OAuth/consent proof; ticket 4 owns G1.1-G1.7 scoring.

## Exit Criteria
- [ ] The planned red test fails for the intended reason before implementation, when applicable.
- [ ] New and updated tests pass after implementation.
- [ ] The broadest safe relevant repository test suite passes.
- [ ] Acceptance criteria map to executable evidence.
- [ ] Routine automated tests do not perform unintended live or destructive operations.
- [ ] Material risks and edge cases identified above are covered.
- [ ] Any optional check is reported as nonblocking and is not represented as already performed.
