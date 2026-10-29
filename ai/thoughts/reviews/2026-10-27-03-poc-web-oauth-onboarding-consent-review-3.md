# POC Web OAuth Onboarding and Consent Code Review — Cycle 3

Fresh independent review. Prior review documents were not read.

## Scope and Repository State

- Ticket 3 scope: `poc/web/` (index.html, oauth/consent.html, assets/{poc.css,config.js,consent-core.mjs,consent.js,onboarding.js}, tests/), the `poc/web` assertion update in `poc/mcp-server/tests/structure.test.mjs`, the `poc/web/.gitkeep` deletion, ticket-3 additions to `poc/README.md`, and the ticket file's acceptance criteria.
- Base: `e8786d7` on `main`. Pre-existing unrelated tickets 1–2 dirty work (`.gitignore`, tickets 01/02, `poc/mcp-server/tests/hosted-acceptance.mjs`, tickets 1–2 README content) inventoried and preserved untouched.
- Live corroboration was read-only web fetch only. No live OAuth flow was run and no sign-in was performed in this cycle.

## Findings

No actionable findings.

Security/correctness notes verified (not findings):
- `poc/web/assets/config.js:5-6` commits only the public Supabase URL and the `__LOOMSPAN_ANON_KEY__` placeholder; `consent.js:23-27` fails closed on the placeholder (no client constructed), and `consent.js:30` builds the client only from those two public globals. No service-role key, credential, code, verifier, or token appears in `poc/web/` source (safe suite secret-scan + targeted scan; only `REDACTED` test fixtures and scanner patterns themselves match).
- Rendering is `textContent`-only: `consent.js:13,46-65` assigns client name/meta, user email, and each scope via `textContent`/`createElement`; no `innerHTML` assignment anywhere in the glue (guarded by `web-structure.test.mjs:69`).
- Correct against the real pinned API: `consent.js:5` pins `supabase-js@2.78.0` exactly; `consent-core.mjs:51-82` calls `auth.oauth.getAuthorizationDetails/approveAuthorization/denyAuthorization(authorizationId)` with exactly one argument (browser auto-redirect stays enabled; the glue's follow-up `location.assign` of the same URL is harmless), handles the redirect-only (previously consented) response, maps session-missing and other errors, and the missing-`auth.oauth` guard (`consent-core.mjs:39-43,53,70`) fails closed with a friendly message — the regression test for the recorded live failure passes.
- `authorization_id` survives sign-in by construction: it is parsed once into a module constant (`consent.js:16`), sign-in is inline (`consent.js:68-84`, password field cleared, no navigation), and details load with the same constant.
- Approve/Deny buttons are `disabled` in markup and enabled only after client/scopes render (`consent.html:38-39`, `consent.js:63-65`), so the L3 approval necessarily followed a rendered decision.
- All first-party asset references are relative (`assets/…`, `../assets/…`); the CDN import is the only external script (guarded exactly).
- Redaction audit: no authorize URL, client id, state, code, verifier, or token value appears in `poc/README.md` or any ticket-3 artifact (targeted scan). README line 171 records only that such values existed in the supplied transcripts and are not recorded. The live `config.js` fetch shows only the public publishable key (value not recorded here).

## Findings Resolved in This Context

Close-out documentation edits only (no code/test changes):
- Ticket: all seven acceptance criteria checked (mapping below).
- `poc/README.md`: ticket-3 progress row and section status updated to complete; the stale "L2–L4, NOT RUN" runbook heading, the stale pre-redeploy workaround paragraph, and the stale scope-boundary line corrected to match the recorded L2/L3/L4 passes.

## Acceptance-Criteria and Plan Conformance

| Criterion/decision | Code evidence | Test evidence | Result |
| --- | --- | --- | --- |
| `/poc/` serves onboarding with Muse + ChatGPT steps and copyable prompt, deployed via separate repo | `poc/web/index.html:21-44` | `web-structure.test.mjs` content guards; this cycle's live fetch of `https://loomspan.ai/poc/` (200, onboarding markers, distinct from main site at `https://loomspan.ai/`) | implemented |
| `/poc/oauth/consent` serves consent page, not fallback/redirect, `/poc/` base path | `poc/web/oauth/consent.html` with relative `../assets/…` refs | structure guards; this cycle's live fetch (200, extensionless, consent markers) confirms plan D5 | implemented |
| Reference flow: discovery, DCR, sign-in, consent approval, token, authenticated `list_apps` | `poc/web/tests/oauth-reference-flow.mjs` (fresh DCR per run, PKCE S256, state check, redacted prints) | README-recorded L3 PASS on 2026-10-27 (DCR 201, state matched, token `expires_in=3600`, `list_apps` `app_ids=[grocery-list]`); NOT re-run in this cycle per instructions | implemented |
| Consent page shows client + requested access before decision; `authorization_id` survives sign-in | `consent-core.mjs` `describeAuthorization`/`loadAuthorization`; inline sign-in (D2) | `consent-core.test.mjs` stub suites; buttons disabled until details render + L3 approval | implemented |
| Denied consent produces no authenticated tool call | `decideAuthorization` deny path; script `--deny` assertions | README-recorded L4 PASS on 2026-10-27 (`error=access_denied`, no code, no token exchange, unauthenticated `list_apps` 401); NOT re-run in this cycle | implemented |
| Deployed output and `poc/web/` source contain no service-role key/credential/token | placeholder-only `config.js` (D3); fail-closed glue | secret-scan 30/30; deployed-output scan recorded in README; this cycle's live `config.js`/`consent.js` fetch shows only the public publishable key and the 2.78.0 pin | implemented |
| OAuth failure recorded with step, redacted evidence, cause-unconfirmed; workaround + burden in onboarding steps | README "Live failure record (Ticket 3)" | failure at consent step, redacted evidence, initial cause-unconfirmed classification, root cause, pin fix, "no user workaround" burden statement; secret-scan re-run passes | implemented |

Plan deviations noted, both safe: config global named `LOOMSPAN_ANON_KEY` instead of the plan draft `LOOMSPAN_SUPABASE_ANON_KEY` (documented in README; placeholder design unchanged), and companion click-paths shipped with honestly-marked unverified menu labels per D9 (recorded in README; scoring is ticket 4).

## Active Project Guardrails

- None recorded (`ai/thoughts/design-lens.md` is a placeholder). Ticket-supplied frontend taste constraints were checked via the CSS guards in `web-structure.test.mjs` and the solid-color, left-aligned stylesheet.

## Open Questions and Assumptions

- L3/L4 rest on the developer-run transcripts recorded in `poc/README.md`; this cycle deliberately did not re-run live OAuth or sign in. The L2 surface and the deployed pin were independently corroborated by read-only fetch.

## Verification Results

- PASS — `node --test poc/web/tests/consent-core.test.mjs poc/web/tests/web-structure.test.mjs poc/mcp-server/tests/structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs poc/mcp-server/tests/mcp-structure.test.mjs` — 30/30 pass, 0 fail (run twice: before and after the close-out documentation edits, same result).
- PASS — read-only live fetch: `https://loomspan.ai/poc/` 200 onboarding; `https://loomspan.ai/poc/oauth/consent` 200 consent page (extensionless); `https://loomspan.ai/` 200 distinct main site; live `assets/config.js` placeholder absent with only the public publishable key; live `assets/consent.js` carries the 2.78.0 pin.
- NOT RUN — `node poc/web/tests/oauth-reference-flow.mjs` and `--deny`: live OAuth flows are prohibited in this cycle; L3/L4 evidence is the README-recorded 2026-10-27 passes.

## Residual Risks and Optional Developer Checks

- A fresh review cycle (cycle 4) must certify this cycle's ticket/README close-out edits.
- Optional: developer re-opens `https://loomspan.ai/poc/` and follows one companion's steps as a final human read-through (scoring remains ticket 4).

## Disposition

- `fixes-applied` (documentation/close-out edits only; no code or test changes)
