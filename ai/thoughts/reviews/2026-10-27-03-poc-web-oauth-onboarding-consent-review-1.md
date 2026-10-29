# 2026-10-27-03 POC Web OAuth Onboarding and Consent Code Review — Cycle 1

## Scope and Repository State
- Ticket, research, implementation plan, and testing plan read in full; `design-lens.md` has no active guardrails.
- Base `e8786d7` on `main`. Ticket-3 scope: `poc/web/index.html`, `poc/web/oauth/consent.html`, `poc/web/assets/{consent-core.mjs,consent.js,config.js,poc.css,onboarding.js}`, `poc/web/tests/{consent-core.test.mjs,web-structure.test.mjs,serve.mjs,oauth-reference-flow.mjs}`, the `poc/web` guard in `poc/mcp-server/tests/structure.test.mjs`, the ticket-3 section of `poc/README.md`, and deletion of `poc/web/.gitkeep`.
- Pre-existing tickets 1–2 dirty work (`.gitignore`, tickets 01/02, most of `poc/README.md`, untracked `hosted-acceptance.mjs`) was inspected via `git diff` and preserved; the only ticket-3 edits overlapping it are the scoped `structure.test.mjs` web assertion and the README ticket-3 additions. No ticket-3 acceptance checkbox is checked in the ticket, correctly.

## Findings
No open actionable findings in the locally reviewable implementation. One P3 finding was found and fixed in this context (see below). The remaining ticket criteria are blocked only by developer-performed live gates L2–L4, which are not code defects.

### Resolved: [P3] Correct the reference-flow redaction claim
- Location: `poc/web/tests/oauth-reference-flow.mjs:10` (header) vs `:69` (`console.log(authorizeUrl.toString())`)
- Scenario: A developer records terminal output as evidence believing the header's claim that state and client ids are never printed.
- Impact: The printed authorize URL carries `state` and `client_id`; a pasted transcript would contradict the redaction-by-construction claim in the testing plan (no codes/verifiers/tokens are printed — that part held).
- Evidence: Header claimed "never codes, state, verifiers, client ids, or tokens" while step 4 prints the full authorize URL, which the developer must open (plan D7).
- Fix: Header now states the authorize-URL exception explicitly and warns not to copy that URL or a transcript containing it into recorded evidence. Comment-only; suites re-run green.

## Findings Resolved in This Context
- [P3] Reference-flow redaction header corrected as above (`poc/web/tests/oauth-reference-flow.mjs` comment only).

## Acceptance-Criteria and Plan Conformance
| Criterion/decision | Code evidence | Test evidence | Result |
| --- | --- | --- | --- |
| `/poc/` onboarding with Muse + ChatGPT steps and copyable prompt, deployed via separate repo | `poc/web/index.html` (server URL, both surfaces, D9 prompt, honestly-unverified menu labels) | `web-structure.test.mjs` content guards PASS | partial — local page done; deployment NOT RUN (L2) |
| `/poc/oauth/consent` serves consent page, not fallback/redirect, `/poc/` base path | `poc/web/oauth/consent.html` + relative `../assets/...` refs | structure guards PASS; local L1 not re-runnable in this sandbox (listen blocked; README records a prior escalated 200/200/200 run, not re-verified here) | partial — extensionless `.html` mapping (D5) unconfirmed on the real host |
| Reference flow: discovery, DCR, sign-in, approval, token, authenticated `list_apps` | `poc/web/tests/oauth-reference-flow.mjs` (fresh DCR per run, PKCE S256, state check, redacted prints, hoisted `mcpCall` used by both modes) | No automated test by design; L3 NOT RUN | missing (live) |
| Consent shows client + requested access before decision; `authorization_id` survives sign-in | `consent-core.mjs` `describeAuthorization`/`loadAuthorization`; inline sign-in in `consent.js` (no navigation, password cleared, `textContent`-only rendering, buttons disabled until details render) | `consent-core.test.mjs` stub suites PASS (details/redirect-only/session-missing/approve/deny/unknown action) | implemented locally; live observation NOT RUN (L3) |
| Denied consent produces no authenticated tool call | `decideAuthorization` deny dispatch; `--deny` asserts `access_denied`, no code, no exchange, unauthenticated `list_apps` = 401 | Core deny dispatch PASS; L4 NOT RUN | partial |
| No service-role key/credential/token in `poc/web/` source or deployed output | Placeholder-only `config.js` with fail-closed check in `consent.js`; pinned CDN `supabase-js@2.57.4/+esm` (verified the pinned URL resolves, HTTP 200) | `secret-scan.test.mjs` + `web-structure.test.mjs` secret guards PASS over source; deployed-output scan (D6) NOT RUN | partial — source proven, deployed output not |
| OAuth failures recorded with step, redacted evidence, cause-unconfirmed; workaround + burden in onboarding | README failure-record runbook step 7; onboarding "If something fails" note | No live failure has occurred (no live step run) | implemented as procedure; no live record |

Plan conformance notes: D1 (pinned CDN, version verified to exist), D2 (inline sign-in), D3 (placeholder injection; variable renamed to `LOOMSPAN_ANON_KEY` to satisfy the existing secret-scan rule — recorded in README, safe deviation), D4 (core/glue split; glue never calls `auth.oauth` directly, asserted by test), D7/D8 (fresh DCR client per run), D9 (unverified companion menu labels stated honestly on the page) all conform. Taste constraints conform: solid white background, system fonts, left-aligned column, no gradients/glow/glass/emoji/`scale(1.05)`, `prefers-reduced-motion` block present (mechanically guarded in `web-structure.test.mjs`, rest confirmed by reading `poc.css`).

## Active Project Guardrails
- None recorded in `ai/thoughts/design-lens.md`. Ticket-supplied taste constraints checked as above.

## Open Questions and Assumptions
- Whether the candidate `loomspan-website` repo is the `loomspan.ai` deployment target and whether its host strips `.html` for `/poc/oauth/consent` (D5) — developer must confirm at deploy time; README already carries the `consent/index.html` fallback instruction.
- Any OAuth failure in L2–L4 must be classified as authentication/integration failure, cause unconfirmed, per the ticket; none has been observed.

## Verification Results
- PASS — `node --test poc/web/tests/consent-core.test.mjs poc/web/tests/web-structure.test.mjs poc/mcp-server/tests/structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs poc/mcp-server/tests/mcp-structure.test.mjs` — 29/29 pass (run twice: before and after the P3 fix).
- PASS — read-only fetch of the pinned CDN module `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm` returned HTTP 200 (version pin exists; this is not a live OAuth run).
- NOT RUN — L1 local smoke in this context: the sandbox refused the listener (all probes `000`); README records a prior escalated run at 200/200/200, not re-verified here.
- NOT RUN — L2 deployed route/non-interception/deployed-secret proof, L3 approval, L4 denial: require the developer's Supabase dashboard change (Site URL `https://loomspan.ai`, Authorization Path `/poc/oauth/consent`), the separate `loomspan.ai` repo push, and test-user credentials. Not faked and not run as routine verification.

## Residual Risks and Optional Developer Checks
- Extensionless consent route may 404 on the real host until D5 is confirmed (fallback documented).
- Live consent behaviour (session-missing wording, already-consented redirect-only path, approve/deny auto-redirect) is unproven against the real Supabase project; first live failure, if any, is cause-unconfirmed until investigated.
- Developer checks: eyeball both deployed pages; confirm consent shows client `loomspan-poc-reference` and scopes `openid email profile` before Approve (L3) and the error landing after Deny (L4).

## Disposition
- `needs-developer` — local review is clean after the P3 fix, but acceptance criteria depending on L2–L4 lack any live evidence, so a `clean` verdict is not supportable. Because this context changed an implementation artifact (comment in the reference-flow script), a fresh Step 5 cycle should also re-review after the live gates, per the review loop.
