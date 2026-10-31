# Extend the POC test to magic login and Cloud internal accounts Code Review — Cycle 2

## Scope and Repository State
- Fresh independent review (no prior review documents read) of the uncommitted ticket diff on `main` (base `dd64163`): 17 files changed (461 insertions, 231 deletions) plus untracked migration `20261030000001_poc_accounts.sql`, `account-race.mjs`, and this ticket's artifacts. Hosted/dashboard/site/live-mailbox state is out of local reach and treated as NOT RUN, never as passed.
- Reviewed in full: `core.ts`, `index.ts`, `data.ts`, migration, `consent-core.mjs`, `consent.js`, `consent.html`, `core.test.ts`, `consent-core.test.mjs`, `fixture.assertions.sql`, `account-race.mjs`, `oauth-reference-flow.mjs`, `seed.sql`, `poc/web/index.html`, README diff, and structure-test diffs. Traced identity consent → `verifyOtp` → session → `getUser()` → `verifiedAccountEmail` → atomic upsert → `account_id` membership/log, plus failure paths (unconfirmed email, resolution failure, wrong/expired code, denial).

## Findings
No actionable findings.

Checked and cleared, with evidence:
- Fail-closed confirmed email: `verifiedAccountEmail` ([core.ts](/C:/opendev/code/meta-hackathon/poc/mcp-server/supabase/functions/mcp/core.ts:49)) returns null unless `email_confirmed_at` is a non-empty string and the email normalizes; `index.ts` maps that to `unauthenticated`, a resolution throw to `internal_error` with an `account_id: null` log row, never to a Supabase-ID fallback. No `user_id` query remains in `data.ts`/`core.ts` (structure test asserts this).
- Normalization is trim + lowercase only ([core.ts](/C:/opendev/code/meta-hackathon/poc/mcp-server/supabase/functions/mcp/core.ts:43)); plus-tag and dot separation, non-string/empty → null are unit-tested; the SQL `CHECK` (`lower(btrim(...))`) plus `UNIQUE(normalized_email)` backstop canonical storage and are probe-tested in `fixture.assertions.sql`.
- Atomic concurrency: `data.ts` resolves via one `upsert(..., { onConflict: "normalized_email" })` statement; the Docker race script issues the identical SQL shape 16-way in parallel and observed one ID / one row (run twice).
- Spoof resistance: identity comes only from the verified token; no tool gained an email parameter; an `email` key inside `call_operation.arguments` is rejected for a member (`invalid_arguments`, zero queries/mutations) and never upgrades a non-member (`not_member`, preserved membership-first ordering) — Deno-tested.
- Consent: two-stage email-code form in the same tab with no navigation; wrong/expired code stays on the code stage, clears the code, shows a generic error via `showSigninError` (unhides `signin-error`), and never calls approve/deny; codes are never rendered/logged/stored. No password form/handler, provider buttons, linking/merging, or account change-email flow (the "Change email" button only returns to the pre-sign-in email entry, per plan D6).
- Fixture/tool contracts: migration only creates `poc_accounts`, enables RLS, and renames two columns (no fixture rows touched); seed placeholder re-pointed to `account_id`; Oats/2, Apples/4, Milk/1 and error taxonomy (`unauthenticated`/`not_member`/`stale_version`/`invalid_arguments`) asserted by the SQL proof and the updated Deno suite.
- Secrets: secret-scan suite passes over the final tree; no mailbox address, code, token, or key in the diff (only `@example.invalid` synthetics); README is valid UTF-8 (no BOM, 144 non-ASCII bytes decode cleanly) and records live steps as NOT RUN with the reason.
- Test quality: tests were updated to the new contract, not weakened — password-ID assertions became OTP-ID + absence assertions, log assertions moved to `account_id`, `FakeRepo` models create-once resolution with a creation counter and an 8-way concurrent-resolution check, OTP stubs cover wrong/expired/thrown/retry/resend and missing-method fail-closed.

## Findings Resolved in This Context
None — this context changed no implementation artifact; only this review document was written.

## Acceptance-Criteria and Plan Conformance
| Criterion/decision | Code evidence | Test evidence | Result |
| --- | --- | --- | --- |
| Live reference flow (approve/deny on deployed page) | OTP consent + reference-flow script modes present | Local consent-core/structure suites | partial — live run NOT RUN (no deployed stack/mailbox) |
| Live Codex flow | Same deployed surface | None locally possible | missing (live) — NOT RUN, escalated previously |
| First sign-in creates exactly one account; concurrency raced | `poc_accounts` UNIQUE + atomic upsert in `data.ts` | Deno create/reuse/concurrent tests; Docker `account-race.mjs` 16-way → 1 ID, 1 row (×2) | implemented (locally verified) |
| Designated owner sees grocery-list, Oats/2, Apples/4, Milk/1, add persists | D9 carry-over runbook in README; owner grocery exercise in reference flow | SQL fixture assertions; Deno owner list/add/persist | partial — hosted carry-over/live NOT RUN |
| Second mailbox: different account, empty `list_apps`, `not_member` | Resolution by normalized email; membership by `account_id` | Deno separation tests; live `--expect-nonmember` script present | implemented locally; live NOT RUN |
| Identity cannot be spoofed via tool args/companion text | No email parameter; `validateArguments` rejects undeclared keys; identity only from token | Deno spoof test (member → `invalid_arguments`, non-member stays `not_member`, zero mutations) | implemented (locally verified); companion-text live probe NOT RUN |
| Case/whitespace → same account; plus-tag → different account | `normalizeAccountEmail` trim+lowercase only; canonical CHECK | Deno normalization tests; SQL canonical probes | implemented (locally verified); live sign-in variants NOT RUN |
| Wrong and expired codes fail, pending auth untouched, retry completes | `verifyEmailCode` error mapping; glue stays on code stage, generic copy | Node OTP tests (wrong, expired, thrown, retry, resend; no OAuth decision calls on failure) | implemented (locally verified); live NOT RUN |
| Existing suites pass incl. new coverage; secret scan passes; no password sign-in | Password form/handler and `hosted-acceptance.mjs` removed; suites updated | Node 40/40, Deno 12/12, secret scan in Node set, grep gates no matches | implemented (locally verified) |
| Deployed page has no provider/linking/merging/change-email; README redacted live results | Page contains only the OTP form; README records NOT RUN live steps | `web-structure.test.mjs` OTP-ID/absence assertions; secret scan | partial — deployed-page check NOT RUN; README records NOT RUN honestly |

## Active Project Guardrails
- None recorded (`ai/thoughts/design-lens.md` states no active project-specific guardrails).

## Open Questions and Assumptions
- Hosted Supabase Auth OTP end state (provider on, sign-ups allowed, Magic Link template contains the 6-digit token placeholder, OTP length 6, default expiry/limits) is dashboard-only and unreadable from this repo; if the hosted template is link-only, the live code flow cannot complete — this remains the ticket's reassessment trigger, not a local defect.
- Supabase OTP-created users are assumed to carry a non-empty `email_confirmed_at` after `verifyOtp` (the documented OTP semantics); only the live flow can confirm this against the hosted project.

## Verification Results
- PASS — `node --test poc/mcp-server/tests/structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs poc/mcp-server/tests/mcp-structure.test.mjs poc/mcp-server/tests/gate1-artifacts.test.mjs poc/web/tests/consent-core.test.mjs poc/web/tests/web-structure.test.mjs` — 40/40 pass, 0 fail/skipped
- PASS — `deno test poc/mcp-server/supabase/functions/mcp/core.test.ts` — 12 passed, 0 failed (the "tool-call log write failed" line is the expected failure-injection probe)
- PASS — `deno check poc/mcp-server/supabase/functions/mcp/index.ts poc/mcp-server/supabase/functions/mcp/core.ts poc/mcp-server/supabase/functions/mcp/data.ts` — exit 0
- PASS — Docker Postgres proof (escalated run): `docker run --name loomspan-poc-pg -e POSTGRES_PASSWORD=poc-local-only -p 54329:5432 -d postgres:16`, both migrations, seed, `fixture.assertions.sql` — all exit 0; re-seed + assertions again exit 0 (fixture Oats/2, Apples/4, Milk/1 preserved, `poc_accounts` empty, canonical/unique probes pass); container removed after
- PASS — `node poc/mcp-server/tests/account-race.mjs` — "16 parallel resolutions, unique_ids=1 rows=1", run twice consecutively, both exit 0
- PASS — grep gates: no `signInWithPassword`/`signin-password` in consent page/glue; no `grant_type=password`/`POC_OWNER_PASSWORD`/`POC_NONMEMBER_PASSWORD` anywhere under `poc/` (detector patterns in scanner/assertion files excluded per plan)
- NOT RUN — all live criteria (dashboard OTP settings, hosted `db push`, function deploy, site-repo consent deployment, owner carry-over, reference approval/denial, Codex, second mailbox, wrong/expired code, case/whitespace and plus-tag live sign-ins): no designated mailbox, dashboard access, or hosted credentials in this environment

## Residual Risks and Optional Developer Checks
- Live acceptance is entirely unproven: email deliverability/template shape, hosted `email_confirmed_at` behavior, deployed-page markup, and owner carry-over could still fail; the README already records these as NOT RUN with the developer procedure. Never represent them as passed.
- The built-in Magic Link email may also contain a clickable link alongside the code depending on the hosted template; the page itself offers code-only sign-in, but the dashboard template check (plan D8) should confirm the intended end state during the live run.

## Disposition
- `clean` for the locally-verifiable scope only. Live hosted/dashboard/site/mailbox criteria remain NOT RUN and are residual risk; this review does not claim live acceptance passed.
