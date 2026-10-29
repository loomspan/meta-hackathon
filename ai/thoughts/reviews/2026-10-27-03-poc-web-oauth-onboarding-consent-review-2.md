# POC Web OAuth Onboarding and Consent Code Review — Cycle 2

## Scope and Repository State

- Ticket: `ai/thoughts/tickets/2026-10-27-03-poc-web-oauth-onboarding-consent.md`; research, implementation plan (D1–D9), and testing plan read in full. Prior review documents were not read.
- Reviewed independently from the working tree: `poc/web/index.html`, `poc/web/oauth/consent.html`, `poc/web/assets/{consent.js,consent-core.mjs,config.js,onboarding.js,poc.css}`, `poc/web/tests/{consent-core.test.mjs,web-structure.test.mjs,serve.mjs,oauth-reference-flow.mjs}`, the `poc/mcp-server/tests/structure.test.mjs` web-layout change, and `poc/README.md` ticket-3 sections.
- Pre-existing unrelated dirty work (tickets 1–2: `.gitignore`, tickets 01/02, `poc/mcp-server/tests/hosted-acceptance.mjs`) was preserved untouched.
- Verified live-failure evidence myself by fetching pinned CDN bundles: `supabase-js@2.57.4/+esm` delegates to `auth-js@2.71.1`, whose fetched bundle contains 0 occurrences of `getAuthorizationDetails`/`approveAuthorization`/`denyAuthorization`; `supabase-js@2.78.0/+esm` delegates to `auth-js@2.78.0`, whose fetched bundle contains 3 occurrences of each (plus `/oauth/authorizations`). Direct PowerShell/curl HTTPS failed in this sandbox (TLS close / curl exit 35), so fetching used the web-fetch tool and raw string counts on the saved output.

## Findings

### [P1] Upgrade the pinned supabase-js version — pinned bundle lacks the OAuth consent APIs
- Location: `poc/web/assets/consent.js:5`
- Scenario: A signed-in user reaches the deployed consent page with an authorization request; `loadAuthorization` calls `supabase.auth.oauth.getAuthorizationDetails`, which does not exist in the pinned 2.57.4 bundle.
- Impact: The live consent flow fails after sign-in with `Cannot read properties of undefined (reading 'getAuthorizationDetails')`; approval/denial and L3/L4 cannot pass. Primary acceptance criteria blocked.
- Evidence: Developer-observed live error (error message only recorded; no identifier recorded); my bundle fetches above (2.57.4/auth-js 2.71.1: 0 occurrences of each method; 2.78.0/auth-js 2.78.0: 3 each).
- Fix: Applied — pin upgraded to exact `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.78.0/+esm`; every active record/assertion of the old pin updated (`poc/web/tests/web-structure.test.mjs` now asserts the exact 2.78.0 URL, `poc/README.md` D1 line, implementation-plan D1 example). Remaining `2.57.4` mentions are historical root-cause records only.

### [P2] Fail closed without leaking the raw TypeError when `auth.oauth` is missing
- Location: `poc/web/assets/consent-core.mjs:46` (pre-fix)
- Scenario: Any client whose `auth.oauth` namespace or method is missing (as in P1) throws a `TypeError`; the pre-fix `catch` returned `err.message` verbatim and the glue rendered it to the page.
- Impact: Users see a raw engine error; the page does not fail closed with an actionable message.
- Evidence: Pre-fix `errorMessage` returned `error.message` unchanged; the live page displayed exactly that raw text.
- Fix: Applied — `loadAuthorization`/`decideAuthorization` now resolve the method via a guarded lookup and return `{ kind: 'error', message: MISSING_OAUTH_MESSAGE }` (friendly, non-raw) when the namespace/method is absent, for `null`/partial clients alike. Regression test added in `poc/web/tests/consent-core.test.mjs` asserting no `Cannot read properties` / method-name text leaks for load, approve, and deny.

No other actionable findings. Security review: only the public placeholder key in source with a fail-closed glue check; authorization-derived values rendered via `textContent` only (no `innerHTML` assignment in glue); no `authorization_id`, code, or token is rendered or logged; denial path yields an OAuth error redirect and the reference script asserts no code/no exchange plus HTTP 401 unauthenticated `list_apps`. Base-path review: all first-party references are relative; the CDN import is the sole external script.

## Findings Resolved in This Context

- [P1] `poc/web/assets/consent.js` pin `2.57.4` → `2.78.0` (exact, verified to contain all three consent methods); `poc/web/tests/web-structure.test.mjs` asserts the exact pinned URL with rationale; `poc/README.md` D1 line and the implementation-plan D1 example updated.
- [P2] `poc/web/assets/consent-core.mjs` guards a missing `auth.oauth` namespace/method in both `loadAuthorization` and `decideAuthorization`, returning a friendly non-raw error; new maintained regression test in `poc/web/tests/consent-core.test.mjs`.
- `poc/README.md` ticket-3 section now records the live failure (step `consent`, redacted error-message-only evidence, initial cause-unconfirmed classification, precise root cause, and the redeploy + L3/L4 rerun burden) and the corrected 30/30 suite count.

## Acceptance-Criteria and Plan Conformance

| Criterion/decision | Code evidence | Test evidence | Result |
| --- | --- | --- | --- |
| `/poc/` serves onboarding with Muse + ChatGPT steps and copyable prompt, deployed via the separate repo | `poc/web/index.html` (both surfaces, server URL, D9 entry prompt) | `web-structure.test.mjs` content guards PASS; L2 live proof previously PASSED (developer/orchestrator-attested, not re-run here) | implemented (live L2 attested) |
| `/poc/oauth/consent` serves the consent page, not fallback/redirect, `/poc/` base path | `poc/web/oauth/consent.html` + relative `../assets/...` refs | `web-structure.test.mjs` relative-ref guards PASS; L2 previously PASSED | implemented (live L2 attested) |
| Reference flow completes discovery, DCR, sign-in, consent approval, token, authenticated `list_apps` | `poc/web/tests/oauth-reference-flow.mjs` (D7/D8 fresh client + PKCE) | L3 NOT RUN — blocked by the P1 live failure; requires redeploy of the fixed assets, then a developer browser run | missing (live gate not run) |
| Consent page shows client + requested access before decision; `authorization_id` survives sign-in | `consent-core.mjs` `describeAuthorization`/`loadAuthorization`; inline sign-in glue (D2) with no navigation | `consent-core.test.mjs` stub suites PASS; live observation pending L3 | partial (local proven, live not run) |
| Denied consent produces no authenticated tool call | `decideAuthorization` deny path; script `--deny` assertions | L4 NOT RUN — requires redeploy + developer browser run | missing (live gate not run) |
| Deployed output and `poc/web/` source contain no service-role key/credential/token | Placeholder-only `config.js`; no server imports in `poc/web/` | `secret-scan.test.mjs` + `web-structure.test.mjs` secret guards PASS over source; deployed copy must be re-scanned after the fix is copied | partial (source proven; redeployed output not yet scanned) |
| Any OAuth failure recorded with step, redacted evidence, cause-unconfirmed classification; workaround + burden stated | `poc/README.md` "Live failure record (Ticket 3)" | Record states step `consent`, error message only, initial classification, precise root cause, and redeploy burden | implemented |

## Active Project Guardrails

- None recorded in `ai/thoughts/design-lens.md`; conformance assessed against the ticket, governing plan, and plan D1–D9 only.

## Open Questions and Assumptions

- None affecting the local fixes. The single open item is the developer redeploy + L3/L4 rerun (see Disposition).

## Verification Results

- PASS — `node --test poc/web/tests/consent-core.test.mjs poc/web/tests/web-structure.test.mjs poc/mcp-server/tests/structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs poc/mcp-server/tests/mcp-structure.test.mjs` — 30/30 pass (run twice after fixes; 17 pre-existing as updated + 13 web tests, including the new missing-`auth.oauth` regression test).
- PASS — pinned-bundle verification via web-fetch: `supabase-js@2.78.0/+esm` → `auth-js@2.78.0` bundle contains `getAuthorizationDetails`/`approveAuthorization`/`denyAuthorization` (3 occurrences each); `supabase-js@2.57.4/+esm` → `auth-js@2.71.1` bundle contains 0 of each.
- NOT RUN — L3 approval and L4 denial live reference flows: require redeploying the fixed `consent.js`/`consent-core.mjs` to the `loomspan.ai` site and developer browser sign-in/approve/deny runs. Residual risk: the consent decision, token exchange, and authenticated `list_apps` remain unproven live.
- NOT RUN — deployed-output scan (D6) of the redeployed copy: to be run by the developer/orchestrator when the fixed files are copied.

## Residual Risks and Optional Developer Checks

- After redeploy, re-run L2 spot checks (`/poc/` and `/poc/oauth/consent` still 200 with POC markers; deployed `config.js` placeholder still absent) before L3/L4.
- During L3, confirm the consent page displays client `loomspan-poc-reference` and scopes `openid email profile` before approving; during L4, confirm the browser lands on the client's error handling after Deny.

## Disposition

- `needs-developer` — local fixes are complete and verified, but live L3/L4 still require a redeploy and developer browser runs, so a clean verdict is not supportable.
