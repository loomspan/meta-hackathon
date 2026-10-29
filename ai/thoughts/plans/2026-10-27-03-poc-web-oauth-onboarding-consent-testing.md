# POC Web OAuth Onboarding and Consent Testing Plan

## Change Summary
Ticket 3 adds plain static pages under `poc/web/` (onboarding at `/poc/`, consent at `/poc/oauth/consent`), consent logic split into a pure `consent-core.mjs` plus browser glue using `supabase-js` (CDN ESM) with the public anon key injected only at cross-repo copy time, a developer-run DCR+PKCE reference-flow script, developer-performed Supabase dashboard changes (Site URL, Authorization Path), and manual deployment to the separate `loomspan.ai` Cloudflare Pages repo. This plan specifies the automated Node tests for everything testable without credentials/browser, the local `/poc/` base-path smoke, and the developer-run live gates for deployment, SPA-fallback non-interception, and approval/denial OAuth proof. Implementation plan: `ai/thoughts/plans/2026-10-27-03-poc-web-oauth-onboarding-consent.md` (decisions D1–D9, Phases 0–6 referenced below).

## Impacted Areas and Risks
| Category | Risk | Planned evidence |
| --- | --- | --- |
| Consent decision correctness | Approve/deny called with wrong/missing `authorization_id`, or buttons enabled before client/scopes are known | `consent-core.test.mjs` stub-client suites (T1–T3); live approval/denial runs (L3–L4) |
| Previously consented shortcut | `getAuthorizationDetails` returns redirect-only; page crashes rendering `client.name` or reports a decision never shown | T1 redirect-only case; D8 fresh-client-per-run in the reference script; L3 repeat-run recording rule |
| Session handling | Consent methods fail session-missing when signed out; `authorization_id` lost through sign-in | T1 session-missing mapping; inline sign-in design (D2); L3/L4 browser observation that sign-in returns to the same consent decision |
| Secret leakage (source) | Legacy anon JWT or any service-role material committed under `poc/web/` fails/leaks | Existing `secret-scan.test.mjs` over all of `poc/` (already walks `poc/web/`); `web-structure.test.mjs` source guards (T4); placeholder-only `config.js` (D3) |
| Secret leakage (deployed/evidence) | Service-role key or tokens/codes reach the deployed output, script output, or `poc/README.md` | D6 deployed-output scan + placeholder-absence fetch (L2); reference script prints redacted by construction (D7); secret-scan re-run after live runs |
| `/poc/` base path | Absolute asset refs 404/mis-resolve under `/poc/`; extensionless consent URL 404s | T4 relative-ref guards; local `/poc/`-prefixed server smoke (L1); live marker checks (L2) |
| SPA-fallback interception | Main site serves its shell/redirect/404 for `/poc/` or `/poc/oauth/consent` | L2 live checks compare POC markers against the main-site response |
| Denial yields a token | Deny path mistakenly exchanges a code or the script calls tools with a token | `--deny` assertions: `error=access_denied`, no code, no exchange, unauthenticated `list_apps` = HTTP 401 (L4) |
| Test-guard regression | `structure.test.mjs` placeholder assertion breaks the pre-existing suite or is weakened beyond the web change | Updated assertion scoped to `poc/web` layout only; full safe suite run (Safe Verification Commands) |
| Live-flow flakiness/misclassification | A discovery/DCR/consent/token failure is blamed on a companion or hidden by a workaround | Failure-record template (Phase 6) with cause-unconfirmed classification; reference flow proven before any companion is scored (ticket `:20`) |
| Frontend taste constraints | Shipped pages use banned patterns (gradients, glow, glass, emoji icons, scale hovers, entrance animation) | T4 static CSS guards for the mechanically checkable subset; developer visual check (Optional Developer Checks) for the rest |

## Existing Coverage and Environment Constraints
- Existing suites (all `node --test`, Node ≥ 20; observed Node v24.22.1): `poc/mcp-server/tests/structure.test.mjs` (includes the `poc/web` = `['.gitkeep']` placeholder assertion ticket 3 must update), `secret-scan.test.mjs` (walks all of `poc/`; JWT/private-key/`service[_-]?role ... eyJ`/non-empty `SUPABASE_*_KEY=` patterns), `mcp-structure.test.mjs` (exactly three MCP tools). Baseline at research time: 17/17 pass. `core.test.ts` (Deno, 7/7 per README) is ticket-2 coverage, untouched by ticket 3 except that the full local run must stay green.
- No test, fixture, or harness exists for any web page, consent behavior, base path, or deployed URL (research §Existing Tests and Fixtures). No `package.json`, bundler, browser-test runner, or jsdom exists in the repo — this plan therefore uses Node's built-in test runner with stub clients and string/structure assertions, and does **not** introduce a browser automation framework for a two-page static POC.
- Automated tests must never contact the hosted Supabase project, `loomspan.ai`, or a CDN, and must never need credentials. Everything live is a developer-run gate (L1–L4) with credentials only in environment variables or the browser, never recorded (only step names, HTTP statuses, `ok`/`error_code`, app IDs).
- The reference-flow script (`poc/web/tests/oauth-reference-flow.mjs`) is a developer tool, deliberately excluded from `node --test` gates; its assertions are its exit code. Test-user credentials (owner/non-member) already exist as developer-held records from tickets 1–2; no credential value is created or stored by any test in this plan.
- Local smoke needs only Node (the `serve.mjs` dev server) and `curl.exe` (present on Windows). Live gates need: Supabase dashboard access, the `loomspan.ai` repo locally with push access, and a browser for sign-in/consent. Missing any of these makes the corresponding gate NOT RUN with that reason (see Exit Criteria), never a pass.

## Failing Test First
- Name: `loadAuthorization returns details with client and scopes for a fresh authorization` (first test in `poc/web/tests/consent-core.test.mjs`), together with the `web-structure.test.mjs` layout test.
- Type: Node `node:test` unit/structure tests (new behavior — the first acceptance-criteria test demonstrating the missing capability; there is no bug to reproduce).
- Location: `poc/web/tests/consent-core.test.mjs` and `poc/web/tests/web-structure.test.mjs` (both new files, written in Step 4 before/with the implementation per the implementation plan Phases 1–3).
- Arrange/Act/Assert: Arrange a stub `supabase` object whose `auth.oauth.getAuthorizationDetails` resolves `{ data: { authorization_id: "auth-1", redirect_uri: "http://127.0.0.1:8765/callback", client: { id: "c1", name: "loomspan-poc-reference", uri: "", logo_uri: "" }, user: { id: "u1", email: "poc-owner@example.invalid" }, scope: "openid email profile" }, error: null }`; Act `loadAuthorization(stub, "auth-1")`; Assert the result is `{ kind: "details", details }` and `describeAuthorization(details)` returns `clientName "loomspan-poc-reference"` and `scopes ["openid","email","profile"]`. The structure test asserts `poc/web/index.html` and the settled consent file exist with the required region IDs.
- Expected pre-fix failure: both files fail because `poc/web/assets/consent-core.mjs`, `poc/web/index.html`, and the consent page do not exist yet (module-not-found / missing-file assertion). The pre-existing `structure.test.mjs` placeholder test still passes at that point, proving the red state is the new capability, not collateral breakage.

## Tests to Add or Update

### 1. `loadAuthorization` — details, redirect-only, and error mapping
- Type: Node unit test (stub client, no network/DOM)
- Location: `poc/web/tests/consent-core.test.mjs`
- Proves: a fresh authorization returns renderable details; a previously consented authorization returns `{ kind: "redirect", redirectUrl }` (never a details render); Supabase `{ data: null, error }` results (including the session-missing shape) and thrown exceptions map to `{ kind: "error", message }` containing no id/token material.
- Inputs/fixture: inline stub objects per Failing Test First; redirect-only fixture `{ data: { redirect_url: "http://127.0.0.1:8765/callback?code=REDACTED&state=REDACTED" }, error: null }` (assert only `kind` and that `redirectUrl` is passed through, never logged); error fixture `{ data: null, error: { name: "AuthSessionMissingError", message: "Auth session missing!" } }`.
- Doubles or boundary isolation: hand-rolled stub `supabase.auth.oauth` recording its arguments; assert `getAuthorizationDetails` was called exactly once with the exact `authorizationId` string passed in.
- Edge cases: `data` with `redirect_url` **and** no `authorization_id` is redirect-only even if other fields exist; `null` data with `null` error maps to `error` kind (defensive, message non-empty).

### 2. `decideAuthorization` — approve and deny dispatch
- Type: Node unit test (stub client)
- Location: `poc/web/tests/consent-core.test.mjs`
- Proves: `"approve"` calls `approveAuthorization(authorizationId)` and `"deny"` calls `denyAuthorization(authorizationId)`, each with exactly one argument (no options object, so browser auto-redirect stays enabled per D4); a returned `{ data: { redirect_url }, error: null }` maps to `{ kind: "redirect", redirectUrl }`; an `{ error }` result maps to `{ kind: "error", message }`.
- Inputs/fixture: stub recording which method was called and with what arguments; redirect fixtures with throwaway `code=`/`error=access_denied` query text (asserted only as pass-through values in-process, never printed).
- Doubles or boundary isolation: stub client only; the browser's actual navigation is covered live (L3/L4), not here.
- Edge cases: an unknown action string (e.g. `"maybe"`) returns `{ kind: "error" }` without calling either Supabase method; approve is never called for a deny input and vice versa.

### 3. `parseAuthorizationId`, `formatScopes`, `isRedirectOnly`, `describeAuthorization` — pure helpers
- Type: Node unit test
- Location: `poc/web/tests/consent-core.test.mjs`
- Proves: `authorization_id` survives parsing exactly (the value the live flow carries through sign-in); scope display matches what Supabase returns; fallback labels are safe when fields are absent.
- Inputs/fixture: query strings `?authorization_id=abc-123&other=1`, `?other=1`, `""`, `?authorization_id=` (empty → `null`), `?authorization_id=%20%20` (whitespace-only → `null`); scopes `"openid email profile"`, `"email"`, `""`, `undefined`; details objects missing `client.name`/`client.uri`/`user.email`.
- Doubles or boundary isolation: none — pure functions.
- Edge cases: duplicate `authorization_id` params (first wins, matching `URLSearchParams.get`); `describeAuthorization` returns `clientName "Unknown client"`, `scopes []`, `userEmail ""` for an empty details object rather than throwing.

### 4. Static page structure, base path, content, and CSS guards
- Type: Node structure/content test (file reads, `node:assert`)
- Location: `poc/web/tests/web-structure.test.mjs`
- Proves: the two pages exist at the D5-settled paths; the consent page contains the state-region IDs the glue requires (`consent-loading`, `consent-signin`, `consent-details`, `consent-error`, `consent-deciding`, `client-name`, `scope-list`, `approve-button`, `deny-button` — or the exact settled equivalents, asserted as one list so markup and test cannot drift silently); the onboarding page contains the MCP server URL `https://yjrwyfkybszlpufsflan.supabase.co/functions/v1/mcp`, both surface headings (Muse / ChatGPT), the exact entry-prompt sentence from D9, and a copyable block marker; every first-party `src`/`href` in both pages is relative (no `"/assets/`, `"/poc/`-absolute, or `src="/` references); `config.js` contains the `__LOOMSPAN_ANON_KEY__` placeholder and no JWT-shaped string; no file under `poc/web/` (excluding `tests/`) contains `service_role`, `SUPABASE_SERVICE_ROLE_KEY`, a private-key header, or an `eyJ...`-shaped token; `poc.css` contains none of the mechanically checkable banned patterns: `linear-gradient`, `radial-gradient`, `backdrop-filter`, `scale(1.05`/`hover:scale`, `@keyframes` fade/up entrance names — and contains `prefers-reduced-motion`.
- Inputs/fixture: the real committed files under `poc/web/` (this is a guard over shipped source, not fixtures).
- Doubles or boundary isolation: none; reads only.
- Edge cases: the CDN `https://cdn.jsdelivr.net/...` import in `consent.js` is the one allowed absolute URL — assert it is the only `https://` script reference besides the documented MCP/consent links in page text; assert `consent.js` references `getAuthorizationDetails`-flow symbols only via `consent-core.mjs` exports (`loadAuthorization`/`decideAuthorization` imported, glue contains no direct `auth.oauth.` call) so the tested core is the shipped path.

### 5. Updated scaffold guard for the new `poc/web` layout
- Type: Node structure test (update of existing suite)
- Location: `poc/mcp-server/tests/structure.test.mjs` (replace only the `placeholder directories contain only placeholders` test's `poc/web` assertion)
- Proves: the pre-existing suite stays green with real web files present, without weakening any ticket 1–2 assertion.
- Inputs/fixture: the real tree after Phase 2.
- Doubles or boundary isolation: none.
- Edge cases: `.gitkeep` must be absent from `poc/web` once real files exist (mirror of the existing function-directory rule in `mcp-structure.test.mjs`); `poc/web/tests/` is permitted and does not count as deployable content.

### 6. Unchanged regression suites
- Type: Node regression (existing, unmodified)
- Location: `poc/mcp-server/tests/secret-scan.test.mjs`, `poc/mcp-server/tests/mcp-structure.test.mjs`; Deno `poc/mcp-server/supabase/functions/mcp/core.test.ts` run only if Deno is available (it was not found in the research environment — if still unavailable, record NOT RUN with that reason; ticket 3 does not change ticket-2 code, so this is a regression courtesy, not a gate).
- Proves: no secret material entered `poc/` with the new web files; the MCP tool contract (`list_apps`/`get_pack`/`call_operation`) the reference flow depends on is unchanged.
- Edge cases: secret-scan's fabricated-JWT self-check must still pass, proving the scanner itself was not weakened to accommodate the web files.

## Developer-Run Live Gates (not automated tests)

### L1. Local `/poc/` base-path smoke
- Command: `node poc/web/tests/serve.mjs` (separate terminal), then `curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:4173/poc/` and the same for `http://127.0.0.1:4173/poc/oauth/consent`; `curl.exe -s http://127.0.0.1:4173/poc/oauth/consent` must contain the consent marker and its relative `../assets/config.js` reference must fetch with HTTP 200 at `http://127.0.0.1:4173/poc/assets/config.js`.
- Proves: directory-index and extensionless mapping work under the `/poc/` prefix and relative assets resolve before deployment. Failure here blocks Phase 4.

### L2. Deployed route, non-interception, and deployed-secret proof
- Commands (after the Phase 4 push and Pages deploy success): `curl.exe -s -i https://loomspan.ai/poc/`; `curl.exe -s -i https://loomspan.ai/poc/oauth/consent`; `curl.exe -s https://loomspan.ai/` (main-site comparison); `curl.exe -s https://loomspan.ai/poc/assets/config.js`.
- Proves: both POC URLs return HTTP 200 with their marker content (onboarding title + MCP server URL; consent region IDs), no `Location` redirect, and bodies that are not the main-site shell (markers present, main-site title/root absent); deployed `config.js` has the placeholder absent and no service-role/private-key pattern (D6). Record statuses and marker names only.

### L3. Live reference flow — approval
- Command: `node poc/web/tests/oauth-reference-flow.mjs` (developer-run; sign-in and Approve happen in the browser on the deployed consent page as the test owner).
- Proves (script exit 0): discovery fields present → fresh DCR client registered → callback receives a `code` with matching `state` (values never printed) → token exchange returns a token (value never printed) → MCP `initialize` + `list_apps` returns `ok:true` with exactly the `grocery-list` summary and no `instructions`/`operations`. Before clicking Approve, the developer confirms the consent page displayed the client name (`loomspan-poc-reference`) and scopes (`openid email profile`) — this human observation is the "shows requesting client and requested access" evidence and is recorded as such.
- Repeat rule: a second identical run must either show a fresh decision (fresh DCR client) or be recorded as previously-consented auto-approval (D8); it is not counted as a second decision pass.

### L4. Live reference flow — denial
- Command: `node poc/web/tests/oauth-reference-flow.mjs --deny` (fresh DCR client; developer clicks Deny).
- Proves (script exit 0): callback receives `error=access_denied` with matching `state` and no `code`; the script performs no token exchange; a subsequent unauthenticated `tools/call list_apps` returns HTTP 401. Together these evidence "denied consent produces no authenticated tool call" — no token exists to attempt an authenticated call with.

## Safe Verification Commands
- Focused: `node --test poc/web/tests/consent-core.test.mjs`
- Focused: `node --test poc/web/tests/web-structure.test.mjs`
- Related suite: `node --test poc/web/tests/consent-core.test.mjs poc/web/tests/web-structure.test.mjs poc/mcp-server/tests/structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs poc/mcp-server/tests/mcp-structure.test.mjs`
- Full safe suite: `node --test (Get-ChildItem poc/mcp-server/tests/*.test.mjs, poc/web/tests/*.test.mjs).FullName` in PowerShell (equivalently, list the five files explicitly). This is the broadest suite that is safe to run unattended: it performs no network access, needs no credentials, and mutates nothing outside the test processes.
- Not automated (developer-run only, never in the commands above): `node poc/web/tests/serve.mjs` + L1 `curl` checks; L2 live `curl` checks; `node poc/web/tests/oauth-reference-flow.mjs` and `--deny` (L3/L4). `hosted-acceptance.mjs` is ticket-2 password-grant coverage and is not a substitute for L3/L4.
- No Deno command is a ticket-3 gate (see Tests to Add #6); if Deno is present, `deno test poc/mcp-server/supabase/functions/mcp/core.test.ts` may be run as regression courtesy and its result recorded separately.

## Optional Developer Checks
- Open both deployed pages in a browser and read them: onboarding steps are followable for Muse and ChatGPT web (click-paths verified against the live products per D9, or recorded as unverified), the entry prompt copies in one click, and the consent page's client/scope display is understandable before deciding. Visual taste items not mechanically guarded in T4 (no cream whole-page background, no centered eyebrow-pill hero with two CTAs, no identical three-card grid, no emoji icons, no glow) are confirmed by this read, not by automation.
- During L3, note whether sign-in was required and that the same consent decision was presented afterward (the `authorization_id`-survival observation); during L4, note the browser lands on the client's error handling after Deny.
- Confirm in the Supabase dashboard that Site URL and Authorization Path show the new values after Phase 4 (the dashboard itself is the evidence; `poc/README.md` records location + date + values, which the redaction rule permits).
- These checks are nonblocking observations except where a Phase 4/5 gate explicitly makes the live result a criterion (L2–L4 exit codes and statuses are gates; the human readability read is not).

## Exit Criteria
- [ ] The planned red tests fail for the intended reason before implementation (missing `consent-core.mjs`/pages), and the pre-existing suites still pass at that point.
- [ ] New and updated tests (T1–T5) pass after implementation; unchanged suites (T6) pass unmodified, including the secret-scan self-check.
- [ ] The broadest safe relevant repository test suite (Full safe suite above) passes on the final tree.
- [ ] Acceptance criteria map to executable evidence: each ticket criterion has a T/L item in the implementation plan's traceability table, and every L gate that ran has its exit code/statuses recorded in `poc/README.md`.
- [ ] Routine automated tests perform no live or destructive operations: no test under `poc/web/tests/*.test.mjs` or `poc/mcp-server/tests/*.test.mjs` makes a network call or reads credentials; the only networked scripts are the developer-run `serve.mjs` (localhost) and `oauth-reference-flow.mjs` (live, manual).
- [ ] Material risks and edge cases above are covered: redirect-only details, session-missing mapping, missing/empty/whitespace `authorization_id`, unknown decide action, double-method dispatch, base-path refs, deployed placeholder absence, denial-without-token.
- [ ] Approval **and** denial are both evidenced live (L3, L4), or the blocked gate is reported NOT RUN with its reason (missing dashboard/`loomspan.ai` access or test-user credentials) and the ticket criterion stays unchecked — a NOT RUN gate is never represented as passed.
- [ ] Any OAuth failure encountered is recorded with step, redacted evidence, and cause-unconfirmed classification, with any workaround and its user burden written into the onboarding steps (Phase 6); no failure is represented as a companion limitation.
- [ ] No credential, token, code, verifier, or key value (other than the intended public key's presence in the deployed copy, recorded without its value) appears in the repo, script output, or `poc/README.md`; the final secret-scan run passes.
- [ ] Any optional check is reported as nonblocking and is not represented as already performed.
