# Extend the POC test to magic login and Cloud internal accounts Code Review — Cycle 1

## Scope and Repository State
- Base: `main` at `dd64163`. Ticket-scoped diff: 17 modified/deleted files plus untracked migration `poc/mcp-server/supabase/migrations/20261030000001_poc_accounts.sql` and `poc/mcp-server/tests/account-race.mjs`. Untracked ticket/research/plan artifacts excluded from implementation review. No prior review read.
- Reviewed fully: MCP `core.ts`/`data.ts`/`index.ts` and tests, consent `consent-core.mjs`/`consent.js`/`consent.html`, migration, seed, SQL assertions, race script, reference flow, structure/secret tests, `poc/README.md`.

## Findings

### [P2] Keep the shared sign-in error visible on the code stage
- Location: `poc/web/oauth/consent.html:22` (pre-fix)
- Scenario: Tester requests a code (email form hidden, code form shown), then enters a wrong/expired code or resend fails. `consent.js` calls `showSigninError()`, which unhides `signin-error` — but that element was inside the now-hidden `signin-form`, so no message is ever visible on the code stage.
- Impact: Wrong/expired-code feedback required by plan D6 is invisible; tester sees only a cleared code field with no explanation.
- Evidence: `signin-error` was a child of `<form id="signin-form">`; `showCodeStage()` in `consent.js` sets `signin-form.hidden = true`; ancestor `hidden` hides descendants regardless of their own `hidden` flag.
- Fix: Applied in this context — moved `signin-error` outside both forms (still inside `consent-signin`) and added a structure assertion that it follows `signin-code-form`.

### [P3] Restore README punctuation corrupted by double encoding
- Location: `poc/README.md` (whole file, pre-fix)
- Scenario: Any reader of the README sees `â€”`-style mojibake in place of every em dash/en dash/ellipsis, including pre-existing evidence sections.
- Impact: Documentation degraded; 48 corrupted sequences, zero intact em dashes (verified by codepoint counts vs `HEAD`: 35 em dashes, 8 en dashes, 1 ellipsis).
- Evidence: Current file contained U+00E2/U+20AC/U+201D sequences (UTF-8 bytes of `—` mis-decoded as Windows-1252 and re-encoded); `HEAD` contains the intact characters.
- Fix: Applied in this context — reversed the Windows-1252 double encoding; counts now 39 em dashes (35 original + 4 new), 8 en dashes, 1 ellipsis.

## Findings Resolved in This Context
- [P2] `poc/web/oauth/consent.html`: moved `signin-error` outside both sign-in forms; `poc/web/tests/web-structure.test.mjs`: added placement assertion guarding the regression.
- [P3] `poc/README.md`: repaired double-encoded punctuation throughout.
- Internal re-review after fixes: full diff re-read; Node 40/40 and Deno 12/12 re-run green. No further actionable findings.

## Acceptance-Criteria and Plan Conformance
| Criterion/decision | Code evidence | Test evidence | Result |
| --- | --- | --- | --- |
| Live reference flow (approve/deny) | OTP consent (D6), deployed stack required | NOT RUN — no deployed stack/mailbox in this environment | partial (local only) |
| Live Codex flow | Same deployed stack + D9 carry-over | NOT RUN | partial (local only) |
| First sign-in creates exactly one account; concurrency raced | D2 unique constraint + D4 atomic upsert in `data.ts` | Deno concurrent-resolution test; Docker `account-race.mjs` 16-way run twice in this review: one ID, one row | implemented (locally proven) |
| Owner sees grocery-list, seeded items, add persists | D9 carry-over runbook in README (placeholder only) | Reference-flow owner exercise coded; live run NOT RUN | partial (local only) |
| Second mailbox: different account, `not_member` | Resolution by verified email; membership by `account_id` | Deno separation tests; `--expect-nonmember` mode coded; live NOT RUN | partial (locally proven logic) |
| No spoofing via tool args/companion text | No email tool parameter; `validateArguments` unchanged; identity only from `verifiedAccountEmail(getUser())` | Deno email-argument test (`not_member` preserved, member `invalid_arguments`, zero queries/mutations) | implemented (locally proven) |
| Case/whitespace same account; plus-tag different | `normalizeAccountEmail` trim+lowercase only; canonical CHECK | Deno normalization tests; SQL canonical/unique probes | implemented (locally proven) |
| Wrong/expired code: no sign-in, pending auth untouched, retry completes | D6 error path stays on code stage, never calls consent decision | Node OTP tests (wrong, expired, thrown, retry, resend, missing-method fail-closed) | implemented (locally proven) |
| Existing suites pass; secret scan; no password sign-in | D7 removal incl. `hosted-acceptance.mjs` deleted | Node 40/40, Deno 12/12 in this review; grep for `signInWithPassword\|signin-password\|grant_type=password\|POC_OWNER_PASSWORD\|POC_NONMEMBER_PASSWORD` = 0 hits | implemented |
| Deployed page has no provider/linking/merging/change-email; README redacted, no mailbox/code/token/key | Page contains only OTP form; README records NOT RUN live steps, no addresses | `web-structure.test.mjs`; secret-scan suite over final tree | implemented locally; deployed page NOT RUN |

## Active Project Guardrails
- None recorded (`ai/thoughts/design-lens.md` states no active project-specific guardrails).

## Open Questions and Assumptions
- Live criteria remain NOT RUN for the already-escalated reason (no designated mailbox, dashboard access, or hosted credentials). Not re-escalated; no new evidence changes that.

## Verification Results
- PASS — `node --test poc/mcp-server/tests/structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs poc/mcp-server/tests/mcp-structure.test.mjs poc/mcp-server/tests/gate1-artifacts.test.mjs poc/web/tests/consent-core.test.mjs poc/web/tests/web-structure.test.mjs` — 40/40 (run before and after fixes)
- PASS — `deno test poc/mcp-server/supabase/functions/mcp/core.test.ts` — 12/12 (before and after fixes; `tool-call log write failed` line is the expected failure-injection probe)
- PASS — `deno check poc/mcp-server/supabase/functions/mcp/index.ts poc/mcp-server/supabase/functions/mcp/core.ts poc/mcp-server/supabase/functions/mcp/data.ts` — exit 0
- PASS — Docker Postgres proof (escalated shell): both migrations + seed + assertions, then seed + assertions again — all exit 0; `node poc/mcp-server/tests/account-race.mjs` twice — `16 parallel resolutions, unique_ids=1 rows=1`; container removed
- PASS — password-removal grep over `poc/` — 0 hits
- NOT RUN — all live hosted/dashboard/site/mailbox flows (reference approval/denial, Codex, second mailbox, wrong/expired code, case/whitespace, plus-tag, owner carry-over): no designated mailbox, dashboard access, or hosted credentials in this environment

## Residual Risks and Optional Developer Checks
- All live acceptance criteria are unverified; the OTP bundle/dashboard/template behaviour, hosted migration, function and site deployment, and owner carry-over must be performed and recorded redacted per the README runbook before any live criterion is claimed.
- `verifiedAccountEmail` trusts `email_confirmed_at` from the server-verified `getUser()` result only; no email is read from tool arguments, headers, or companion text, and resolution failure returns `internal_error`, never a fallback to the Supabase user ID (verified by code trace; no `user_id` remains in `data.ts`/`core.ts`).

## Disposition
- `fixes-applied`
