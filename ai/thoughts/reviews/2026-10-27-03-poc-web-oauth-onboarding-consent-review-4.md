# 2026-10-27-03 POC Web OAuth Onboarding Consent Code Review — Cycle 4

## Scope and Repository State
- Fresh independent review (no prior review documents read). Ticket, research, implementation plan, testing plan, design-lens (no active guardrails), all `poc/web/` source/tests, `poc/README.md` ticket-3 section, and git state inspected.
- Base `e8786d7` on `main`. Ticket-3 work is unstaged/untracked: `poc/web/` pages/assets/tests, ticket checkboxes, `poc/README.md` ticket-3 additions, the scoped `structure.test.mjs` web-layout update, `poc/web/.gitkeep` deletion. Unrelated tickets 1–2 dirty work (`.gitignore` `.temp/` line, tickets 01/02 checkbox edits, untracked `hosted-acceptance.mjs`, README tickets 1–2 sections) is present, pre-existing, and preserved untouched; its diff is limited to its own checkbox/README/`structure` context and was excluded from ticket-3 judgment except to confirm no ticket-3 edit reverted it.

## Findings
No actionable findings.

## Findings Resolved in This Context
None — no implementation artifact was changed in this context.

## Acceptance-Criteria and Plan Conformance
| Criterion/decision | Code evidence | Test evidence | Result |
| --- | --- | --- | --- |
| `/poc/` serves onboarding with Muse + ChatGPT steps and copyable entry prompt via separate repo | [poc/web/index.html](/C:/opendev/code/meta-hackathon/poc/web/index.html:21) (both surfaces, server URL, exact D9 prompt, one-connection note, unverified menu labels stated honestly) | web-structure content guards; live re-fetch HTTP 200 with title, server URL, prompt (this review) | implemented |
| `/poc/oauth/consent` serves consent page, not fallback/redirect, `/poc/` base path | [consent.html](/C:/opendev/code/meta-hackathon/poc/web/oauth/consent.html:7) relative `../assets/...` refs only; extensionless D5 layout | web-structure relative-ref guards; live re-fetch HTTP 200 with consent regions, distinct from main site | implemented |
| Reference flow: discovery, DCR, sign-in, consent approval, token, authenticated `list_apps` | [oauth-reference-flow.mjs](/C:/opendev/code/meta-hackathon/poc/web/tests/oauth-reference-flow.mjs:27) fresh DCR + PKCE S256 + state check + exchange + MCP `list_apps` assertions, redacted prints | Recorded L3 PASS in [poc/README.md](/C:/opendev/code/meta-hackathon/poc/README.md:171) (DCR 201, code/state, token, `list_apps ok=true app_ids=[grocery-list]`); not re-run per instructions (no live OAuth/sign-in) | implemented |
| Consent shows client + requested access before decision; `authorization_id` survives sign-in | [consent-core.mjs](/C:/opendev/code/meta-hackathon/poc/web/assets/consent-core.mjs:24) `describeAuthorization`; [consent.js](/C:/opendev/code/meta-hackathon/poc/web/assets/consent.js:68) inline sign-in, no navigation, buttons disabled until details render (consent.html:38), textContent-only rendering | consent-core stub suites (details/redirect-only/session-missing/approve/deny/unknown-action/missing-`auth.oauth` fail-closed); L3 recorded flow | implemented |
| Denied consent produces no authenticated tool call | `--deny` branch asserts `error=access_denied`, no code, no exchange, unauthenticated `list_apps` 401 | Recorded L4 PASS in README:171 | implemented |
| Deployed output and `poc/web/` source contain no service-role key/credential/token | [config.js](/C:/opendev/code/meta-hackathon/poc/web/assets/config.js:6) placeholder-only; glue fails closed on placeholder (consent.js:23) | secret-scan + web-structure scans pass; live `config.js` re-fetch: placeholder absent, only a public `sb_publishable_` key present (value not recorded), no service-role/private-key material; deployed `consent.js`/`consent-core.mjs` SHA-256 byte-identical to source (this review) | implemented |
| OAuth failure recorded with step, redacted evidence, cause-unconfirmed; workaround + burden in onboarding | README Live failure record (step `consent`, redacted message only, initially cause-unconfirmed, root-caused to the 2.57.4 pin, fix + redeploy + L3/L4 rerun; no user workaround) | Independently corroborated: pinned `@supabase/auth-js@2.78.0` bundle contains `getAuthorizationDetails`/`approveAuthorization`/`denyAuthorization` (3 each); the 2.57.4-era `auth-js@2.71.1` bundle contains none; web-structure asserts the exact 2.78.0 pin | implemented |

Plan conformance: D1 pinned CDN (2.78.0 verified as above), D2 inline sign-in, D3 copy-time injection (global renamed to `LOOMSPAN_ANON_KEY` to satisfy the pre-existing secret-scan, recorded in README — safe deviation), D4 pure core + glue (glue contains no direct `auth.oauth.` call, asserted), D5 `consent.html` (live extensionless route works), D6 deployed scan recorded, D7/D8 fresh-client reference script, D9 honest unverified companion labels.

## Active Project Guardrails
- None recorded in `ai/thoughts/design-lens.md`; ticket frontend constraints checked via CSS guards (no gradients/glass/scale-hover, `prefers-reduced-motion` present).

## Open Questions and Assumptions
- None affecting correctness. README ticket-3 status wording ("Complete", README:15,139) was checked: it asserts implementation + L2/L3/L4 completion, all of which this review independently corroborated, so the wording is accurate at this certification and needs no edit.
- Sensitive-data sweep: regex searches over `poc/web/`, `poc/README.md`, and ticket-3 plan/research/ticket artifacts found no authorize URLs, client ids, codes, states, verifiers, or tokens (only `REDACTED` fixtures), no JWT-shaped strings, and no service-role material.

## Verification Results
- PASS — `node --test poc/web/tests/consent-core.test.mjs poc/web/tests/web-structure.test.mjs poc/mcp-server/tests/structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs poc/mcp-server/tests/mcp-structure.test.mjs` — 30/30 pass, 0 fail.
- PASS — read-only live re-fetch of `https://loomspan.ai/poc/` (200, onboarding markers) and `https://loomspan.ai/poc/oauth/consent` (200, consent markers) via web fetch; sandbox `curl.exe` failed with TLS exit 35, so the fetch tool was used instead. Live OAuth was not run and no sign-in was performed, per instructions.
- PASS — Node fetch of the pinned CDN bundles corroborating the 2.78.0 `auth.oauth` presence / 2.57.4 absence counts above.
- PASS — SHA-256 comparison: deployed site copies of `consent.js` and `consent-core.mjs` byte-identical to `poc/web/` source.

## Residual Risks and Optional Developer Checks
- L3/L4 live evidence rests on the recorded developer-run transcripts in `poc/README.md` (redacted by construction); this review corroborated every locally and read-only checkable part (code, script assertions, live routes, deployed hashes, library pin) but did not re-run live OAuth, per instructions.
- Companion (muse.ai / ChatGPT web) exact menu labels remain developer-unverified, stated honestly on the page and in README; scoring them is ticket 4.

## Disposition
- `clean`
