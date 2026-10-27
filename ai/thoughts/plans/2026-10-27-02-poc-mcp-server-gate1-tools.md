# MCP Server Gate 1 Tools Implementation Plan

## Overview
- Ticket: `ai/thoughts/tickets/2026-10-27-02-poc-mcp-server-gate1-tools.md`
- Research: `ai/thoughts/research/2026-10-27-02-poc-mcp-server-gate1-tools.md`
- Governing plan: `ai/thoughts/plans/proof_of_concept.md`
- Outcome: One self-built MCP Edge Function at `poc/mcp-server/supabase/functions/mcp/` serves exactly `list_apps`, `get_pack`, and `call_operation` over Streamable HTTP. Calls run as the authenticated Supabase user, enforce membership/version/validation server-side, execute operations from the stored Postgres definition, and write credential-free tool-call log rows. A later DB-only definition update adding `remove_item` executes through the unchanged function.

## Current State
- No MCP code exists. `poc/mcp-server/supabase/functions/mcp/` contains only `.gitkeep`; `poc/mcp-server/supabase/config.toml` is only `project_id = "loomspan-testing"`; no Deno/TypeScript file, `deno.json`, or `package.json` exists under `poc/` (research §Current Behavior and Data Flow).
- Persisted fixture verified at commit `826814c`: `poc_apps`, `poc_app_definitions`, `poc_packs`, `poc_app_memberships`, `poc_grocery_items`, `poc_tool_call_log` in [20261027000001_poc_fixture_schema.sql](/C:/opendev/code/meta-hackathon/poc/mcp-server/supabase/migrations/20261027000001_poc_fixture_schema.sql:4). RLS is enabled on all six tables with **no policies** (same file, lines 59-64), so an RLS-scoped client currently reads/writes nothing.
- Stored v1 definition ([seed.sql](/C:/opendev/code/meta-hackathon/poc/mcp-server/supabase/seed.sql:13)) gives each operation only `name`, `kind`, `description`, `arguments[]` (`name`/`type`/`required`/`min_length`/`trim`/`minimum`). It contains no table, action, ordering, or identity mapping. This is research Open Question 1.
- Items are seeded Oats/2, Apples/4, Milk/1 with identity `id` as insertion order ([seed.sql](/C:/opendev/code/meta-hackathon/poc/mcp-server/supabase/seed.sql:55), [expected-fixture.json](/C:/opendev/code/meta-hackathon/poc/fixtures/expected-fixture.json:24)). DB CHECKs are defense-in-depth only; they cannot produce companion-actionable guidance or JSON-type distinctions.
- Hosted preflight is still `NOT VERIFIED — developer dashboard action required` for OAuth 2.1, dynamic client registration, and asymmetric JWT signing ([poc/README.md](/C:/opendev/code/meta-hackathon/poc/README.md:9)); the hosted membership row still holds placeholder UUID `00000000-0000-4000-8000-000000000001`. No authenticated hosted pass may be claimed until the developer completes those actions.
- Local tooling observed: Node `v24.22.1`, Docker `29.8.1` present; `deno`, `supabase` CLI, `psql` not found. Foundation Node tests are 12/12 at the research commit; `structure.test.mjs:27-32` currently requires the function directory to contain only `.gitkeep` and must change in this ticket.
- Supabase's Deploy MCP servers guide (fetched in research and re-fetched in this step) establishes the Edge pattern this plan follows: official MCP TypeScript SDK `createMcpHandler` with a fresh `McpServer` per request, `Deno.serve`, `[functions.mcp] verify_jwt = false`, and an authenticated composition of `withOAuthProtectedResource()` (RFC 9728 metadata, `WWW-Authenticate` on 401) with `withSupabase({ auth: 'user' })` from `@supabase/server`, which verifies user tokens against the project JWKS and rejects legacy HS256. Prerequisites listed: Docker, Deno, Supabase CLI 2.117.0+, Node 20+.

## Desired End State
- `tools/list` exposes exactly `list_apps`, `get_pack`, `call_operation`. No Gate 2 tools, no second app, no Cloudflare MCP code.
- `list_apps` returns lightweight member-app summaries only; `get_pack` returns Build/Run/grocery packs by ID with version and instructions, plus operation/argument definitions for the app pack only; `call_operation` reads and writes grocery items through definitions stored in Postgres.
- Every tool call is authenticated as the signed-in user or rejected; membership, stale-version, environment, and argument rules are enforced before mutation; errors are structured and actionable; every tool call (including pre-handler unauthenticated rejections that carry a parseable `tools/call`) is logged without credentials, tokens, headers, or raw arguments.
- Updating only the Postgres definition (seed-shaped v1 here; the version-2 artifact in ticket 4) to add `remove_item` makes it visible in `get_pack` and executable via `call_operation` with no function code change and no redeploy.

### Acceptance-criteria mapping
| Ticket criterion | Desired-state evidence |
| --- | --- |
| Authenticated owner `list_apps` returns grocery summary without instructions; unauthenticated rejected | Phase 3 tool + Phase 5 hosted/local checks |
| `get_pack` returns Build, Run, grocery packs by ID with version, instructions, and app-pack operation/argument definitions | Phase 3 `get_pack` handler |
| Owner lists items in insertion order, adds an item, item persists in a later list | Phase 2 executor over `poc_grocery_items ORDER BY id ASC` |
| Empty name / invalid quantity mutates nothing, returns actionable guidance | Phase 2 declarative argument validation |
| Previous `app_version` after a bump mutates nothing, returns `stale_version` with current version and reload guidance | Phase 2 stale check before executor dispatch |
| DB-only definition update adds an operation; `get_pack` shows it and `call_operation` executes it, no code change/redeploy | Phase 1 `effect` contract + Phase 2 generic interpreter (no operation-name switch) |
| Signed-in non-member cannot list or mutate grocery items; each rejected call recorded | Phase 2/3 membership gate + log writer |
| Tool-call log contains entries for the above with no credentials/tokens | Phase 2 log shaping + Phase 4 log assertions |

## Scope
### In scope
- The `effect` extension to the stored definition format (Phase 1), applied to the v1 seed, `expected-fixture.json`, and SQL assertions.
- One Edge Function under `poc/mcp-server/supabase/functions/mcp/` with exactly the three Gate 1 tools, Streamable HTTP transport, Supabase Auth verification, explicit membership checks, DB-driven execution, structured errors, and tool-call logging.
- `[functions.mcp] verify_jwt = false` in `poc/mcp-server/supabase/config.toml`.
- Updates to the ticket-1 test guards that this ticket necessarily changes (`structure.test.mjs` placeholder rule), new Deno tests for the function logic, and README runbook additions for local serve, hosted deployment, token acquisition, and the already-seeded-hosted-DB definition update.
- Developer-performed hosted steps documented as gates (preflight completion, owner/non-member identity creation, membership UUID replacement, deploy), never automated or faked.

### Out of scope
- Gate 2 tools (`save_sandbox_definition`, `publish_test_revision`), a second app, participant role, a DataSkill interpreter, billing, migrations tooling, and any MCP code on Cloudflare (ticket `:22`).
- The OAuth consent/onboarding pages and Site URL/Authorization Path configuration (ticket 3). This ticket's verification may use tokens obtained through Supabase Auth directly (ticket `:37`).
- The version-2 `remove_item` update artifact and G1.1-G1.7 scoring (ticket 4). This ticket only makes that DB-only update possible and defines the format it must follow.
- Persistent native skill installation in any companion (ticket `:14` explicitly excludes claiming it).
- Creating a replacement Supabase project.

## Active Project Guardrails
None recorded ([design-lens.md](/C:/opendev/code/meta-hackathon/ai/thoughts/design-lens.md:5): "There are currently no active project-specific design guardrails recorded here."). Proceed from the ticket, governing plan, and research only.

## Resolved Research Open Questions
Each research Open Question (§Open Questions 1-10) is settled here from ticket, governing-plan, schema, and fetched-guide evidence. Material choices are recorded so later steps do not re-derive them.

### Q1 — Executable definition format (ticket reassessment trigger: NOT triggered)
**Decision: add a declarative `effect` descriptor to each stored operation; the executor is a generic interpreter over a bounded primitive vocabulary, never a switch on operation names.**

Each operation in `poc_app_definitions.definition.operations[]` gains:
```json
"effect": {
  "action": "list | insert | delete",
  "resource": "grocery_items",
  "order":  [{"field": "id", "direction": "asc"}],   // list only
  "fields": ["name", "quantity"],                     // insert only: validated argument names to store
  "match":  ["name"]                                  // delete only: validated argument names matched exactly
}
```
- v1 seed becomes: `list_items` → `{action:"list", resource:"grocery_items", order:[{field:"id",direction:"asc"}]}`; `add_item` → `{action:"insert", resource:"grocery_items", fields:["name","quantity"]}`.
- Ticket 4's `remove_item` then needs only: `{"name":"remove_item","kind":"write","description":"...","arguments":[{"name":"name","type":"string","required":true,"min_length":1,"trim":true}],"effect":{"action":"delete","resource":"grocery_items","match":["name"]}}` in a version-2 definition row. No code change, no redeploy — criterion `ticket:31` is satisfiable by construction and proven by a fake-repository test (testing plan §3).
- Executor allowlists, validated before any query: `resource` must be exactly `grocery_items` (mapped in code to `poc_grocery_items`); `action` in `list|insert|delete`; `order.field` in `id`; `fields`/`match` entries must be declared argument names and members of the column allowlist `name|quantity` (plus `id` for `match` only). Any violation → `invalid_definition` error, no query issued. Definitions never carry SQL, table names outside the allowlist, or raw expressions, so a definition row cannot become arbitrary SQL under the privileged client.
- Delete semantics: exact match on all `match` arguments, scoped to the app; returns the removed rows. Zero matched rows → `ok:false, error_code:"item_not_found"` with guidance to call `list_items` first; nothing else mutates. Duplicate names all match and are all removed (deterministic; the fixture has unique names).
- Why this does not trigger the ticket reassessment (`ticket:44`): Edge Functions/Deno impose no constraint against this design — the fetched guide runs arbitrary TypeScript with Supabase clients per request, and the executor needs only parameterized `supabase-js` queries (`select`/`insert`/`delete` with `eq` filters and `order`), never dynamic SQL. The executor is DB-driven in the sense the ticket defines: operation set, arguments, and per-operation behavior come from the stored definition; only the bounded primitive vocabulary is code. Rejected alternatives: (a) dispatch/`switch` on operation name or verb-prefix parsing — hardcodes or guesses the v1 set and blocks or mis-executes a DB-added operation, failing `ticket:17,31`; (b) storing SQL text in the definition — arbitrary SQL execution under a privileged key, unbounded writes, violates `ticket:22`; (c) a relational operations table — replaces the JSONB contract ticket 1 deliberately chose and ticket 4's SQL artifact is specified against.

### Q2 — Data-access and enforcement mechanism
**Decision: guide auth pipeline for identity + privileged client with explicit membership checks for data. No new RLS policies in this ticket.**
- `withOAuthProtectedResource()` + `withSupabase({ auth: 'user' })` verify the bearer token against the project JWKS (rejecting HS256) and establish the authenticated user. The handler obtains the user ID from that verified context (`supabase.auth.getUser()` on the scoped client); a client-supplied user ID is never trusted.
- All fixture reads/writes (apps, definitions, packs, memberships, items, log) use a separate service-role client created from `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` Edge secrets. This is required because RLS is enabled with zero policies: the scoped client could not even read the membership table that authorizes it. Ticket `:16` expressly permits "RLS and/or explicit membership checks"; explicit checks are the smallest mechanism that fits membership-rows-over-shared-app-data (the guide's per-user-row-ownership RLS example does not match this fixture). The service-role key stays in function secrets only — never in `poc/web/`, committed files, responses, or logs; the existing secret-scan suite remains the committed guard.
- Membership scope per tool: `list_apps` returns only apps the caller has a membership row for (non-member → `ok:true, apps:[]`; no app data leaks). `get_pack`: Build/Run packs are available to any authenticated user; the grocery app pack requires membership (`not_member` otherwise), because it carries operation definitions. `call_operation` requires membership for the target app before any other check beyond app existence. Any role row counts as membership in Gate 1 (only `owner` exists; participant is Gate 2).

### Q3 — Tool wire shapes
**Decision: fixed JSON Schemas; results carry the same payload as `structuredContent` and as JSON text content.**
- `list_apps`: input `{}` (no properties). Success: `{"ok":true,"apps":[{"app_id","name","version","summary","environments"}]}` where `version` is `poc_apps.current_version`. No instructions, no operations.
- `get_pack`: input `{"pack_id": string (required)}` — the pack IDs `build`, `run`, `grocery-list` (app-pack ID equals app ID in the seed). Success: `{"ok":true,"pack":{"pack_id","kind","app_id": string|null,"version","title","instructions"}}`, plus `"operations":[{name,kind,description,arguments}]` (the stored argument definitions, `effect` stripped) only when `kind = "app"`. For the app pack, `version` is `poc_apps.current_version` and operations come from the definition row at that version (Q5); Build/Run `version` is `poc_packs.version`.
- `call_operation`: input `{"app_id": string (required), "environment": string (optional, default "production"), "app_version": integer (required), "operation": string (required), "arguments": object (optional, default {})}`. The MCP `inputSchema` is necessarily static; per-operation argument validation happens in the executor against the stored definition. Success shapes: list → `{"ok":true,"app_id","app_version","environment","operation","items":[{"id","name","quantity"}]}`; insert → same envelope with `"item":{"id","name","quantity"}`; delete → same envelope with `"removed":[{"id","name","quantity"}]}`.
- Every business rejection returns `{"ok":false,"error_code","guidance", ...}` as both `structuredContent` and JSON text, with MCP `isError: true` so companions notice it; the stale payload additionally carries `current_version` exactly as the governing plan specifies ([proof_of_concept.md](/C:/opendev/code/meta-hackathon/ai/thoughts/plans/proof_of_concept.md:112)). Unauthenticated calls never reach the tool layer: the auth pipeline answers HTTP 401 with `WWW-Authenticate` (guide behavior). No payload ever contains a stack trace, SQL text, token, or header value.

### Q4 — Error taxonomy and precedence
**Decision:** `error_code` values: `unauthenticated`, `not_member`, `unknown_app`, `unknown_pack`, `unknown_operation`, `invalid_arguments`, `stale_version`, `item_not_found`, `invalid_definition`, `internal_error`. Only `stale_version` is ticket-mandated; the rest follow the ticket's named cases (`ticket:20`).
- Precedence for `call_operation` (first match wins, each checked before mutation): unauthenticated (HTTP layer) → `unknown_app` → `not_member` → malformed `app_version` (missing/non-integer → `invalid_arguments`) → `stale_version` → `unknown_operation` → `invalid_arguments` (environment not in the app's `environments`, unknown/missing/extra arguments, type/constraint failures) → `invalid_definition` (missing definition row or disallowed `effect`) → execution outcomes (`item_not_found`, `internal_error`).
- Guidance contract: `invalid_arguments` guidance names the offending argument and the fix, and for grocery writes repeats the ticket rule — correct the request or ask the user, never invent values (`ticket:19`). `stale_version` guidance is the governing plan's sentence. `unknown_operation` guidance directs the companion to `get_pack` for the current operation list. `not_member` guidance states the user lacks access to the app and must ask the app owner; it does not reveal item data.
- Log mapping: success → `outcome:"ok", error_code:null`; every business rejection above except `invalid_definition`/`internal_error` → `outcome:"rejected"` with that `error_code`; `invalid_definition`, DB failures, and unexpected exceptions → `outcome:"error"`. Unauthenticated → `outcome:"rejected", error_code:"unauthenticated"`.

### Q5 — Version source and semantics
**Decision:** `poc_apps.current_version` is the single source: `list_apps`/`get_pack` report it, and `call_operation` compares `app_version` against a fresh per-call read of it (ticket-1 plan designates exactly this). The stale check applies to **every** `call_operation`, reads included (the ticket states the contract for `call_operation` generally; G1.7 exercises a write). The definition row is loaded at `(app_id, current_version)`; a missing row is `invalid_definition`, not a fallback to an older version. `poc_packs.version` for the grocery pack is expected to mirror the app version, but it is never the comparison source; ticket 4's update artifact owns keeping pack row, definition row, and `poc_apps.current_version` in step.

### Q6 — Logging completeness
**Decision:** `operation` records the tool name for `list_apps`/`get_pack` and the operation name for `call_operation`. For `get_pack`, `app_id`/`app_version` record the pack's app and reported version (both `null` for Build/Run). For `list_apps`, `app_id`, `app_version`, and `environment` are `null`. For `call_operation`, the requested `app_id`, integer `app_version` (null when malformed), and effective `environment` are recorded.
- An outermost wrapper in `index.ts` handles pre-handler rejections: it clones the request, and only for a parseable JSON-RPC `tools/call` extracts the tool name and (for `call_operation`) `app_id`/`operation`/`app_version`/`environment` — never `arguments`, headers, or the token. If the pipeline then answers 401, the wrapper inserts the `unauthenticated` log row with `user_id: null`. Non-`tools/call` requests (initialize, `tools/list`, OAuth metadata) are not tool calls and are not logged.
- Log-write failure never changes the tool response (a success is not converted into a retry-provoking failure after mutation); the failure is reported via `console.error` with no token/argument content. Acceptance evidence therefore inspects actual log rows (testing plan), not just responses.

### Q7 — Environment handling
**Decision:** `environment` defaults to `production`; it must be a member of the app's `poc_apps.environments`, else `invalid_arguments` listing the supported environments, before mutation. There is no environment partitioning of `poc_grocery_items` in Gate 1 (single fixture table, no environment column); the effective environment is echoed in the response and recorded in the log.

### Q8 — Gateway, SDK, and tooling
**Decision:** `config.toml` gains `[functions.mcp] verify_jwt = false` (the function verifies tokens itself; the gateway would otherwise reject the unauthenticated discovery request before `withOAuthProtectedResource` can answer — fetched guide). The function uses the guide's pinned imports: `npm:@modelcontextprotocol/server@^2.0.0` (`createMcpHandler`, `McpServer`), `npm:@supabase/middleware@1` (`pipeline`), `npm:@supabase/server@1` (`withOAuthProtectedResource`, `withSupabase`; pipeline form, current 1.x), `npm:zod@^4.3.6` for tool input schemas, and `npm:@supabase/supabase-js@2` for the privileged client. Imports use `npm:` specifiers inline per the guide, so no `package.json` is introduced. A `deno.json` in the function directory carries only lint/fmt config if needed — no dependency map duplicating the inline specifiers.
- Tooling prerequisite for Step 4: install Deno and Supabase CLI ≥ 2.117.0 (neither exists on this machine). If installation is impossible in the implementation environment, Step 4 implements and unit-tests the pure core but must report local serve/deploy verification as NOT RUN with that reason — it must not claim hosted acceptance.

### Q9 — Hosted-verification path
**Decision:** documented in `poc/README.md` as developer steps (Phase 5): complete the preflight table or record the blocker; apply migration+seed (including the Phase 1 effect update if the hosted DB was already seeded); create the owner user and replace the placeholder membership UUID (existing README procedure); create a second non-member user with no membership row; obtain access tokens via the Supabase Auth token endpoint (`POST /auth/v1/token?grant_type=password` with the anon key) held only in shell environment variables, never committed or logged; deploy with `supabase link` / `supabase config push` / `supabase functions deploy mcp`. If any preflight item cannot be enabled, the README blocker rule fires (`BLOCKER — authentication/integration blocker, cause unconfirmed`) and hosted acceptance stops for a developer decision.

### Q10 — Test-guard updates
**Decision:** `structure.test.mjs` placeholder test is split: `poc/web` must still contain only `.gitkeep`; `poc/mcp-server/supabase/functions/mcp` must contain `index.ts` (and may contain the planned sibling modules/tests), and `.gitkeep` is removed once real files exist. `fixture.assertions.sql` gains `effect` assertions for v1 and keeps all ticket-1 assertions, including the empty-log start state — which remains true at seed time because assertions run before any tool call. MCP-level tests live with the function as Deno tests (testing plan). The secret-scan suite is unchanged and must keep passing.

## Impact and Risk Analysis
- **Persisted-contract risk (highest):** the `effect` vocabulary binds ticket 4's version-2 SQL artifact. Mitigated by keeping it declarative, minimal (three actions, one resource), and documented in the seed, `expected-fixture.json`, assertions, and this plan; ticket 4 authors plain JSON against it.
- **Privileged-client risk:** the service-role client bypasses RLS, so the explicit membership check is the only authorization barrier. Mitigated by checking membership before definition load/execution in `call_operation` and before app-pack delivery, by the resource/column allowlists, and by tests proving a non-member can neither read nor mutate (testing plan). The key exists only as an Edge secret.
- **Preflight/hosted risk:** all three preflight items are NOT VERIFIED and the guide's auth helper hard-rejects HS256. Local implementation and fake-repository tests proceed regardless; hosted acceptance is gated on the developer's dashboard completion or the blocker branch fires. This is a recorded gate, not a silent assumption.
- **Already-seeded hosted DB risk:** seed uses `ON CONFLICT DO NOTHING`, so re-running the updated seed will not add `effect` to an existing hosted v1 definition row. Mitigated in Phase 1 with an idempotent hosted update statement in the README; locally, from-empty runs use the updated seed directly.
- **Duplicate-write risk:** a stale or invalid retry must never double-apply. All rejections occur before mutation; insert is a single statement; log failure after success does not alter the response (Q6).
- **Protocol risk:** MCP SDK/Zod versions are pinned to the fetched guide's (`@modelcontextprotocol/server@^2.0.0`, `zod@^4.3.6`). Fresh server per request matches the stateless Edge runtime.
- **Scope-creep risk:** exactly three tools are registered; `tools/list` output is asserted in tests so a Gate 2 tool cannot slip in unnoticed.

## Implementation Approach
Three layers inside `poc/mcp-server/supabase/functions/mcp/`, chosen so the risky logic is testable without Deno-hosted services:
- `core.ts` — pure, import-free TypeScript: error taxonomy and payload builders, definition parsing, argument validation against stored argument definitions (string/integer types, `required`, `trim` then `min_length`, `minimum`; JSON floats, numeric strings, booleans, null, and missing values are invalid for `integer`), `effect` validation against the allowlists, stale/environment checks, and the generic executor. The executor depends only on a small `FixtureRepo` interface (load app, load definition, load pack, membership exists, list/insert/delete items, insert log row) — it contains **no operation-name dispatch anywhere**; behavior comes from `effect`.
- `data.ts` — the Supabase implementation of `FixtureRepo` over the service-role client (parameterized `supabase-js` calls only), plus log-row shaping per Q6.
- `index.ts` — wiring only: the guide's `pipeline([withOAuthProtectedResource(), withSupabase({ auth: 'user' })], handler)`, a fresh `McpServer` per request via `createMcpHandler`, the three `registerTool` calls with Zod input schemas delegating to `core.ts`, the pre-handler 401 logging wrapper (Q6), and `Deno.serve`.
Rejected alternatives are recorded under Q1 (name dispatch, stored SQL, relational operations) and Q2 (new RLS policies for all six tables — larger surface, and policies would still need the membership join the explicit check already performs).

## Phase 1: Executable Definition Contract (`effect`) in the Fixture

### Changes
- [x] `poc/mcp-server/supabase/seed.sql` — extend the v1 `poc_app_definitions` JSONB: `list_items` gains `"effect":{"action":"list","resource":"grocery_items","order":[{"field":"id","direction":"asc"}]}`; `add_item` gains `"effect":{"action":"insert","resource":"grocery_items","fields":["name","quantity"]}`. Names, kinds, descriptions, and argument definitions are unchanged; the definition still contains no alphabetical/ask-for-quantity pack rules.
- [x] `poc/fixtures/expected-fixture.json` — mirror both `effect` objects under `definition.operations[]` so file-level tests pin the contract ticket 4 will extend.
- [x] `poc/mcp-server/tests/fixture.assertions.sql` — add assertions that definition v1 contains both `effect` objects (JSONB containment), keeping every existing assertion including the pack-only-rule and empty-log checks.
- [x] `poc/README.md` — add a "Definition effect update for an already-seeded hosted database" subsection with one idempotent statement the developer runs only if the hosted project was seeded before this ticket: an `UPDATE poc_app_definitions SET definition = '<complete v1 definition JSONB including effects>' WHERE app_id = 'grocery-list' AND version = 1;` followed by a verification `SELECT definition FROM poc_app_definitions WHERE app_id='grocery-list' AND version=1;`. State that fresh seeds need no update and that raw arguments/tokens are never part of it.

### Automated verification
- [ ] Docker from-empty run per `poc/README.md` §Local fixture setup (migration → seed → `fixture.assertions.sql` → seed re-run → assertions) — exit 0, proving the effect-bearing definition recreates from empty and seed stays idempotent.
- [ ] `node --test poc/mcp-server/tests/structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs` — PASS, including the new expected-fixture expectations if asserted there.

### Optional developer checks
- [ ] None.

## Phase 2: Pure Core — Errors, Validation, Stale Check, Generic Executor, Log Shaping

### Changes
- [x] `poc/mcp-server/supabase/functions/mcp/core.ts` — add: payload/error builders for the Q4 taxonomy (no stack traces; stale payload exactly `{ok:false,error_code:"stale_version",current_version:<int>,guidance:"Call get_pack for this app, then retry once with the current app_version."}` per governing plan); `validateArguments(operation, args)` implementing the stored-definition rules generically (unknown argument rejected; required enforced; `string` must be a JSON string, trimmed when `trim:true`, then `min_length`; `integer` must satisfy `Number.isInteger` — floats, numeric strings, booleans, null invalid — then `minimum`; trimmed `name` is the stored value); `validateEffect(operation)` enforcing the Q1 allowlists; `executeOperation(repo, ctx, operation, args)` interpreting `list` (`order by id asc` via repo), `insert` (only `fields`, from validated args, plus `app_id`), and `delete` (exact `eq` match on `match` args, returning removed rows, zero rows → `item_not_found`); and `shapeLogRow(...)` implementing Q6 field rules. No string `switch` on operation names exists in this file.
- [x] `poc/mcp-server/supabase/functions/mcp/core.ts` — `handleCallOperation(repo, userId, input)`: resolve app (`unknown_app`) → membership (`not_member`) → `app_version` integer check (`invalid_arguments`) → fresh `current_version` compare (`stale_version`, before mutation) → definition load at current version (`invalid_definition` if absent) → operation lookup (`unknown_operation`) → environment membership in `app.environments` and argument validation (`invalid_arguments`) → `validateEffect` (`invalid_definition`) → execute → success payload per Q3. Also `handleListApps` (member apps only) and `handleGetPack` (`unknown_pack`; app pack requires membership, strips `effect` from returned operations).
- [x] `poc/mcp-server/supabase/functions/mcp/data.ts` — `createSupabaseRepo(client)` implementing `FixtureRepo` with parameterized `supabase-js` queries against `poc_apps`, `poc_app_definitions`, `poc_packs`, `poc_app_memberships`, `poc_grocery_items`, `poc_tool_call_log`; item reads always order by `id` ascending; no raw SQL strings are constructed from definition content.

### Automated verification
- [ ] `deno test poc/mcp-server/supabase/functions/mcp/core.test.ts` — the fake-repository suites specified in the testing plan (including the DB-added `remove_item` proof) PASS.
- [ ] `deno check poc/mcp-server/supabase/functions/mcp/index.ts` — type-checks with zero errors (run after Phase 3 wiring exists; Phase 2 alone: `deno check .../core.ts .../data.ts`).

### Optional developer checks
- [ ] None.

## Phase 3: MCP Function Wiring, Auth Pipeline, and Config

### Changes
- [x] `poc/mcp-server/supabase/functions/mcp/index.ts` — guide composition: import `createMcpHandler`/`McpServer` from `npm:@modelcontextprotocol/server@^2.0.0`, `pipeline` from `npm:@supabase/middleware@1`, `withOAuthProtectedResource`/`withSupabase` from `npm:@supabase/server@1`, `z` from `npm:zod@^4.3.6`, `createClient` from `npm:@supabase/supabase-js@2`. Build the service-role repo once per request from `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` env; per request, create a fresh `McpServer` (`name: "loomspan-poc"`) and register exactly `list_apps` (empty Zod object), `get_pack` (`pack_id: z.string().min(1)`), and `call_operation` (`app_id: z.string().min(1)`, `environment: z.string().optional()`, `app_version: z.number().int()` — note: a non-integer/missing `app_version` must still produce the Q4 `invalid_arguments` payload, so the Zod schema accepts `z.unknown()` for `app_version` and `arguments` and lets `core.ts` judge them; Zod-level rejection must not replace the structured payload). Each handler: get the verified user ID from the `withSupabase` context client, delegate to `core.ts`, write the log row via the repo (Q6), and return `{content:[{type:"text",text:JSON.stringify(payload)}], structuredContent: payload, ...(payload.ok ? {} : {isError:true})}`. Wrap the pipeline with the Q6 401-logging wrapper (clone request, extract only tool/app/operation/version/environment from a parseable `tools/call`, insert the `unauthenticated` row after a 401 response). End with `Deno.serve((req) => handler(req))` per the guide. Delete `poc/mcp-server/supabase/functions/mcp/.gitkeep`.
- [x] `poc/mcp-server/supabase/config.toml` — append `[functions.mcp]` with `verify_jwt = false`. Do not add `[auth.oauth_server]` claims (dashboard state stays in the README preflight table, per ticket 1).
- [x] `poc/mcp-server/tests/structure.test.mjs` — replace the placeholder rule: `poc/web` still contains only `.gitkeep`; the function directory must contain `index.ts`, `core.ts`, `data.ts` and must not require `.gitkeep`; add `index.ts` to the required-paths list. Keep all other ticket-1 assertions.

### Automated verification
- [ ] `deno check poc/mcp-server/supabase/functions/mcp/index.ts` — zero type errors.
- [ ] `node --test poc/mcp-server/tests/structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs` — PASS (secret scan confirms no key/token value entered the new TypeScript).

### Optional developer checks
- [ ] None.

## Phase 4: Test Suite Completion (per testing plan)

### Changes
- [x] `poc/mcp-server/supabase/functions/mcp/core.test.ts` — Deno tests with an in-memory `FixtureRepo` fake covering every behavior in the testing plan: list/add happy paths and insertion order, all invalid-argument variants mutating nothing, stale (read and write) mutating nothing, precedence cases, non-member and unknown app/operation/pack, DB-added `remove_item` executing with no name-specific code, disallowed `effect` → `invalid_definition`, log-row shaping for all three tools and outcomes.
- [x] `poc/mcp-server/tests/mcp-structure.test.mjs` (Node) — static guards: `index.ts` registers exactly the three tool names and no Gate 2 names; `core.ts` contains no operation-name dispatch (`switch`/equality on `"list_items"|"add_item"|"remove_item"`); no file under `poc/mcp-server/supabase/functions/` contains a token/header logging call or the service-role key value.

### Automated verification
- [ ] `deno test poc/mcp-server/supabase/functions/mcp/core.test.ts` — PASS.
- [ ] `node --test poc/mcp-server/tests/` — all Node suites PASS.
- [ ] Docker from-empty SQL run from Phase 1 re-run — exit 0.

### Optional developer checks
- [ ] None.

## Phase 5: Local Serve, Deployment, and Hosted Verification Runbook

### Changes
- [x] `poc/README.md` — add a ticket-2 section covering: prerequisites (Deno, Supabase CLI ≥ 2.117.0, Docker); local run (`supabase start`, `supabase functions serve mcp`, endpoint `http://127.0.0.1:54321/functions/v1/mcp`); the exact unauthenticated probe (POST `initialize` with `Accept: application/json, text/event-stream` → expect HTTP 401 with `WWW-Authenticate`); hosted deploy (`supabase link --project-ref yjrwyfkybszlpufsflan`, `supabase config push`, `supabase functions deploy mcp`); direct-token acquisition for owner and non-member via the Auth token endpoint with tokens held only in shell env vars; the hosted acceptance sequence mirroring the ticket criteria (owner list/add/persist, invalid add, stale after a scratch version bump that is then restored, non-member rejection, log inspection with a no-credential check); and the Phase 1 hosted definition update prerequisite. State explicitly that companion OAuth/consent proof is ticket 3 and Gate 1 scoring is ticket 4.

### Automated verification
- [ ] `deno check poc/mcp-server/supabase/functions/mcp/index.ts` and both test suites above — PASS locally.
- [ ] Local serve smoke (requires the Q8 tooling): unauthenticated `initialize` returns 401 + `WWW-Authenticate`; an authenticated owner `tools/call list_apps` against the local stack returns the grocery summary. Record actual output; if tooling could not be installed, record NOT RUN with the reason instead.

### Optional developer checks
- [ ] Developer completes the preflight table, owner/non-member setup, hosted deploy, and the hosted acceptance sequence, recording redacted results (dates, status codes, error_codes, log row counts) in `poc/README.md`. No token, key, or password value is recorded. These observations are the hosted acceptance evidence; they are not represented as automated proof.

## Test Strategy
Deno tests against an in-memory `FixtureRepo` fake for all executor/authz/validation/stale/logging logic (cheapest boundary that proves behavior, including the DB-added operation); Node `node:test` for repository structure, secret hygiene, and no-dispatch guards; the Docker Postgres from-empty run for the persisted definition contract. Hosted MCP calls with real tokens are developer-performed optional checks, never automated gates, because they need dashboard-created identities. Full detail: [2026-10-27-02-poc-mcp-server-gate1-tools-testing.md](/C:/opendev/code/meta-hackathon/ai/thoughts/plans/2026-10-27-02-poc-mcp-server-gate1-tools-testing.md).

## Acceptance-Criteria Traceability
| Acceptance criterion | Planned code evidence | Planned test evidence |
| --- | --- | --- |
| Owner `list_apps` summary without instructions; unauthenticated rejected | `index.ts` auth pipeline + `core.ts handleListApps` (member-only) | Deno: member/non-member/empty list; local/hosted 401 probe (Phase 5) |
| `get_pack` returns Build/Run/grocery by ID with version, instructions, app operations/arguments | `core.ts handleGetPack` over `poc_packs` + definition at `current_version`, `effect` stripped | Deno: three pack IDs, app-only operations, unknown pack, non-member app pack |
| Owner lists in insertion order, adds, persists | Executor `list`/`insert` over `poc_grocery_items ORDER BY id ASC` | Deno fake-repo sequence list→add→list; Docker SQL order assertions retained |
| Empty name / invalid quantity mutates nothing, actionable guidance | `validateArguments` (trim+min_length, strict integer, minimum) | Deno table-driven invalid variants asserting zero repo mutations |
| Stale `app_version` after bump mutates nothing, returns `stale_version` + current + reload guidance | Stale check in `handleCallOperation` before dispatch | Deno: stale read and stale write, repo mutation count 0, exact payload fields |
| DB-only update adds operation; shown by `get_pack`, executed by `call_operation`, no redeploy | `effect` interpreter (Phase 1/2); no name dispatch | Deno: fake definition gains `remove_item` at runtime → executes; Node no-dispatch guard |
| Non-member cannot list/mutate; each rejection recorded | Membership gate in `handleCallOperation`/`handleGetPack` + log writer | Deno: non-member read/write rejected, log rows shaped `rejected/not_member` |
| Log entries for all calls, no credentials/tokens | `shapeLogRow` + `data.ts` insert; 401 wrapper in `index.ts` | Deno log-shaping cases; Node scan for token/header logging; hosted log inspection (optional check) |

## Risks and Rollback/Recovery
- Preflight blocker fires during Phase 5 → record `BLOCKER — authentication/integration blocker, cause unconfirmed` in `poc/README.md`, stop hosted acceptance, and return `needs-developer`; local code and tests remain valid and undeployed changes are inert.
- Executor misinterprets a future definition → the allowlist fails closed with `invalid_definition` and no query; recovery is correcting the definition row, never hot-patching operation names into code.
- Bad deploy → redeploy the previous function version via Supabase CLI; fixture data is recoverable by re-running migration/seed plus the README membership replacement and Phase 1 hosted definition update. No destructive hosted operation is planned.
- All changes are contained in `poc/` (plus plan artifacts); rollback is reverting the ticket's commits.

## References
- Ticket: `ai/thoughts/tickets/2026-10-27-02-poc-mcp-server-gate1-tools.md`
- Research: `ai/thoughts/research/2026-10-27-02-poc-mcp-server-gate1-tools.md`
- Governing plan: `ai/thoughts/plans/proof_of_concept.md` (`:101-127` tool contract, stale payload, fixture-update mechanism)
- Foundation: `ai/thoughts/tickets/2026-10-27-01-poc-foundation-supabase-fixture.md`, `ai/thoughts/plans/2026-10-27-01-poc-foundation-supabase-fixture.md` (`:58-67` schema decisions), [20261027000001_poc_fixture_schema.sql](/C:/opendev/code/meta-hackathon/poc/mcp-server/supabase/migrations/20261027000001_poc_fixture_schema.sql:1), [seed.sql](/C:/opendev/code/meta-hackathon/poc/mcp-server/supabase/seed.sql:1)
- Downstream: `ai/thoughts/tickets/2026-10-27-03-poc-web-oauth-onboarding-consent.md`, `ai/thoughts/tickets/2026-10-27-04-poc-gate1-run-and-evidence.md`
- External: [Supabase Deploy MCP servers guide](https://supabase.com/docs/guides/ai-tools/byo-mcp) (fetched in research and re-fetched in this step)
- Testing plan: `ai/thoughts/plans/2026-10-27-02-poc-mcp-server-gate1-tools-testing.md`
