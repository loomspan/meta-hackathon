# Magic Login and Cloud Internal Accounts Testing Plan

## Change Summary
Companion to `ai/thoughts/plans/2026-10-30-poc-magic-login-cloud-accounts.md` (decisions D1–D10 referenced below). The change: (1) consent page replaces password sign-in with a two-stage Supabase email-code (OTP) flow in the same tab; (2) a new `poc_accounts` table (UUID internal account ID, unique canonical `normalized_email`) is added by migration `20261030000001_poc_accounts.sql`, and `poc_app_memberships.user_id` / `poc_tool_call_log.user_id` are renamed to `account_id`; (3) the MCP function resolves the verified token email (trim + lowercase only, confirmed emails only) to an internal account via an atomic upsert and authorizes `list_apps`/`get_pack`/`call_operation` by account ID; (4) password-era hosted tooling (`hosted-acceptance.mjs`) is retired and the OAuth reference flow gains owner/nonmember expectation modes; (5) the stack is deployed live (dashboard OTP settings, `db push`, function deploy, site-repo copy) and the owner membership is carried onto the designated mailbox's account. Tool contracts, error taxonomy, and the grocery fixture (Oats/2, Apples/4, Milk/1) must not change.

## Impacted Areas and Risks
| Category | Risk | Planned evidence |
| --- | --- | --- |
| Authorization | Tools still authorize by Supabase user ID, or an unconfirmed/spoofed email becomes an account key | Deno tests authorizing by resolved account ID (test 3); `verifiedAccountEmail` rejects missing/unconfirmed email (test 2); no `user_id` membership query remains in `data.ts` (structure/grep checks, Phase 2 verification) |
| Account creation | First sign-in creates zero or two accounts; concurrent first resolutions duplicate | Deno create/reuse tests (test 3); SQL unique/canonical probes (test 7); Docker-local 16-way race script (test 8) |
| Email matching | Case/whitespace variants split one mailbox into two accounts, or plus-tag/dots are wrongly collapsed | Deno normalization tests (test 1): trim+lowercase equivalence, plus-tag and dot separation |
| Consent flow | Wrong/expired code signs in, or approves/denies the pending authorization, or loses `authorization_id` | Node OTP core tests with stubbed `auth` (test 5): error stays on code stage, `loadAuthorization`/`decideAuthorization` never called on failure, success calls details load exactly once |
| Preserved fixture | Migration or seed change loses/reorders Oats/2, Apples/4, Milk/1 or the membership row | SQL assertions run from empty and again after re-seed (test 7); hosted pre/post count queries (Phase 5 of the implementation plan) |
| Preserved tool contract | Renaming identity breaks tool names/inputs/outputs or the `unauthenticated`/`not_member`/`stale_version`/`invalid_arguments` taxonomy | Existing Deno suite (8 tests) updated only for `account_id` log fields and re-run green; `mcp-structure.test.mjs` still asserts exactly three tools |
| Spoofing | An email in `call_operation.arguments` or companion text changes who a call authorizes as | Deno test: `email` argument → `invalid_arguments`, non-member unchanged (test 4); live nonmember spoof probe (Optional Developer Checks) |
| Secret/address leakage | Designated mailbox, codes, tokens, or keys enter the repo, deployed copy, logs, or README evidence | Existing secret-scan suite over the final tree; grep gates for password sign-in remnants; reference-flow output redacted by construction |
| External delivery | Built-in email sending/template cannot deliver a usable 6-digit code (hosted state unknown) | Not automatable from this repo: dashboard read/set (D8) + live runs; failure is the ticket's reassessment trigger, reported `needs-developer`, never worked around |

## Existing Coverage and Environment Constraints
- Safe automated suites today (research-verified baseline): `node --test` over six files (`poc/mcp-server/tests/structure.test.mjs`, `secret-scan.test.mjs`, `mcp-structure.test.mjs`, `gate1-artifacts.test.mjs`, `poc/web/tests/consent-core.test.mjs`, `web-structure.test.mjs`) = 35/35; `deno test poc/mcp-server/supabase/functions/mcp/core.test.ts` = 8/8 (Node v24.22.1, Deno 2.9.8). The Deno suite's "tool-call log write failed" console line is an expected failure-injection probe, not a failure.
- Known old-contract assertions that must be *updated to the new contract* (never deleted to go green): `web-structure.test.mjs` requires `signin-password`; `fixture.assertions.sql` requires log column `user_id`; `core.test.ts` `FakeRepo` keys membership/log by Supabase-style UUIDs with `user_id` log fields; `mcp-structure.test.mjs`/`structure.test.mjs` file expectations gain the new migration.
- Environment: no `package.json`/bundler anywhere; tests are Node built-in `node:test` (`.mjs`) and Deno (`core.test.ts`) only. SQL proof uses a throwaway Docker `postgres:16` container `loomspan-poc-pg` on port 54329 with container-only password `poc-local-only` (documented in `poc/README.md`; not a real credential). No automated test contacts the hosted project, a live URL, or a real mailbox; no test needs the Supabase CLI, a local `psql`, or any credential.
- Live-only constraints: hosted Auth OTP state is dashboard-only; the deployed consent page lives in `C:\opendev\code\loomspan-website`; the designated owner mailbox exists only in the execution environment; Codex and real-mailbox runs are human-performed. These are Optional Developer Checks / Phase 5 evidence, never automated gates.

## Failing Test First
- Name: `first resolution creates one account and reuses it for the same normalized email`
- Type: Deno unit test against the pure core + in-memory `FakeRepo` (cheapest boundary that proves the new capability)
- Location: `poc/mcp-server/supabase/functions/mcp/core.test.ts`
- Arrange/Act/Assert: Extend `FakeRepo` per the implementation plan (accounts map, creation counter, `resolveOrCreateAccount`). Act: call the resolution path twice with the same verified email (second time with different letter case/surrounding whitespace). Assert: identical account ID both times, creation counter = 1, and `handleListApps` with that account ID returns the grocery app while a different email's account returns none.
- Expected pre-fix failure: The test does not compile/pass before implementation — `normalizeAccountEmail`, `verifiedAccountEmail`, and `FixtureRepo.resolveOrCreateAccount` do not exist and `FakeRepo` has no accounts concept (Deno type-check error on the missing symbols). That missing-capability failure is the intended red; a harness/environment error (Deno missing, import failure in unrelated code) is not.
- Web counterpart (same red-first discipline, run in the same step): `verifyEmailCode maps a wrong-code error without signing in` in `poc/web/tests/consent-core.test.mjs` fails pre-fix because `verifyEmailCode` is not exported from `poc/web/assets/consent-core.mjs`.

## Tests to Add or Update

### 1. `normalizeAccountEmail trims and lowercases only`
- Type: Deno unit test (pure function)
- Location: `poc/mcp-server/supabase/functions/mcp/core.test.ts`
- Proves: The account matching key is trim + lowercase with no other rewriting (ticket matching rule).
- Inputs/fixture: `'  Owner@Example.COM '` → `'owner@example.com'`; `'a+b@example.com'` stays distinct from `'a@example.com'`; `'a.b@example.com'` stays distinct from `'ab@example.com'`; `''`, `'   '`, `null`, `undefined`, `42` → `null`.
- Doubles or boundary isolation: None (pure function).
- Edge cases: Already-canonical input returned unchanged; internal whitespace preserved (only surrounding whitespace trimmed).

### 2. `verifiedAccountEmail requires a confirmed email`
- Type: Deno unit test (pure function)
- Location: `poc/mcp-server/supabase/functions/mcp/core.test.ts`
- Proves: Identity comes only from verified token evidence; unconfirmed or absent email fails closed (D4).
- Inputs/fixture: `{ email: ' Owner@Example.com ', email_confirmed_at: '2026-10-30T00:00:00Z' }` → `'owner@example.com'`; missing `email`, empty-after-trim email, missing/null `email_confirmed_at`, and `null` user → `null`.
- Doubles or boundary isolation: Plain object literals shaped like the `getUser()` user; no Supabase client.
- Edge cases: Non-string `email` → `null`.

### 3. `first resolution creates one account; reuse, separation, and authorization by account ID`
- Type: Deno unit tests over extended `FakeRepo`
- Location: `poc/mcp-server/supabase/functions/mcp/core.test.ts`
- Proves: First resolution creates exactly one account; the same normalized email reuses it across fresh resolutions; a different email gets a different account; `handleListApps`/`handleGetPack`/`handleCallOperation` authorize by the resolved account ID (owner account sees and mutates grocery, non-member account gets empty `list_apps` and `not_member`), and a request carrying the old Supabase-style ID that resolves to no membership authorizes as non-member.
- Inputs/fixture: `FakeRepo` accounts map with creation counter; membership set keyed by the *account* ID returned from resolving the owner email; existing Oats/Apples/Milk items and v1 definition unchanged.
- Doubles or boundary isolation: `FakeRepo.resolveOrCreateAccount` implements create-once semantics in memory (map keyed by normalized email); no DB, network, or token.
- Edge cases: Concurrent variant — `Promise.all` of 8 simultaneous first resolutions for one new email (with an artificial `await` delay inside the fake's create path) returns one ID with creation counter = 1. This proves the handler-level contract; the database-level guarantee is proven by tests 7–8.

### 4. `an email supplied as a tool argument is never identity evidence`
- Type: Deno unit test
- Location: `poc/mcp-server/supabase/functions/mcp/core.test.ts`
- Proves: Spoof resistance under the new identity model (ticket criterion).
- Inputs/fixture: Non-member account calls `call_operation` for `list_items` with `arguments: { email: '<owner email>' }` → `invalid_arguments` (undeclared argument, per the stored definition), zero mutations; owner's identical call without the email key still succeeds as owner; `list_apps`/`get_pack` with stray email-shaped input change nothing.
- Doubles or boundary isolation: Same `FakeRepo` as test 3.
- Edge cases: Email key nested only where `validateArguments` already rejects unknown keys — assert the rejection happens before any item query/mutation (`itemQueries`/`mutations` counters stay 0).

### 5. OTP core: `requestEmailCode` / `verifyEmailCode` success, wrong code, expired code, retry and resend
- Type: Node unit tests (`node:test`) with a stubbed `supabase.auth`
- Location: `poc/web/tests/consent-core.test.mjs` (new `stubOtp` helper beside the existing `stubOAuth`)
- Proves: The consent page's code stage behaves per ticket: request sends with `{ email, options: { shouldCreateUser: true } }`; verify calls `verifyOtp({ email, token, type: 'email' })`; a wrong-code `{ error }` and an expired-code `{ error }` each map to `kind: 'error'` with a non-sensitive message (no code, email, or `authorization_id` in the message), no session is implied, and neither `getAuthorizationDetails`/`approveAuthorization`/`denyAuthorization` is invoked on the failure path; after a failure, a retry with the correct code returns `kind: 'ok'`; resend issues a second `signInWithOtp` with the same trimmed email.
- Inputs/fixture: Stub auth objects recording calls, returning canned `{ data, error }` results (including a thrown-exception case); synthetic emails like `tester@example.invalid`; codes are dummy strings (`'000000'` wrong, `'123456'` correct) — never real codes.
- Doubles or boundary isolation: Stubbed `auth` namespace only; the missing-method case (`{}`, `{ auth: {} }`, missing `signInWithOtp`/`verifyOtp`) fails closed with the friendly `MISSING_OTP_MESSAGE` and no raw `TypeError` leak, mirroring the existing `auth.oauth` regression test.
- Edge cases: Verify with the trimmed email captured at request time even if the tester typed surrounding whitespace; error messages never contain the submitted code.

### 6. Structure: OTP markup in, password sign-in out
- Type: Node structure tests (existing suite, updated contract)
- Location: `poc/web/tests/web-structure.test.mjs`; supporting assertions in `poc/mcp-server/tests/structure.test.mjs` and `poc/mcp-server/tests/mcp-structure.test.mjs`
- Proves: The consent page carries the two-stage OTP IDs (`signin-email`, `signin-send-code`, `signin-code`, `signin-verify`, `signin-resend`, `signin-change-email`, `signin-error`) and none of `signin-password`; `consent.js` contains `requestEmailCode`/`verifyEmailCode` delegation and no `signInWithPassword`; the pinned CDN import is unchanged; the new migration file exists; exactly three MCP tools remain registered; onboarding page copy describes the email-code sign-in and no longer says "test account".
- Inputs/fixture: File contents of `poc/web/` and the function directory (existing `read` helpers).
- Doubles or boundary isolation: None (static assertions, the repo's established pattern).
- Edge cases: Assert absence, not just presence — a page that offers both password and OTP must fail this test.

### 7. SQL assertions: `poc_accounts`, canonical emails, renamed columns, fixture preservation
- Type: SQL assertions on throwaway local Postgres (`psql -v ON_ERROR_STOP=1`; any failure raises and exits non-zero)
- Location: `poc/mcp-server/tests/fixture.assertions.sql` (extended `DO $$ … $$` blocks, existing style)
- Proves: After migration 1 + migration 2 + seed from empty: `poc_accounts` exists, has a unique constraint on `normalized_email`, and is empty; `poc_app_memberships.account_id` and `poc_tool_call_log.account_id` exist (log column still nullable, still no credential-like column names) and `user_id` no longer exists on either table; the one `grocery-list` membership row carries the seed placeholder account ID; grocery items are still Oats/Apples/Milk with quantities 2/4/1 in insertion order and all pre-existing fixture assertions still pass; the same assertions pass again after a second seed run (idempotency).
- Inputs/fixture: The repo migration + seed files only; synthetic placeholder data.
- Doubles or boundary isolation: Throwaway Docker `postgres:16` container only (see Safe Verification Commands); never the hosted project.
- Edge cases: Rolled-back probes — inserting a non-canonical `normalized_email` (uppercase or padded) raises a check violation; inserting a duplicate `normalized_email` raises a unique violation; row counts are unchanged after the probes.

### 8. `account-race.mjs`: concurrent first resolutions produce one account
- Type: Developer-run scripted check against the local Docker Postgres (not part of the `node --test` gates, because it needs the container from test 7 running)
- Location: `poc/mcp-server/tests/account-race.mjs` (new)
- Proves: The database-level concurrency criterion (ticket: "races duplicate first resolutions and observes one account — not left as an unexercised claim"). The script issues 16 parallel copies of the exact resolution statement used by `data.ts` (`INSERT INTO poc_accounts (normalized_email) VALUES ('race@example.invalid') ON CONFLICT (normalized_email) DO UPDATE SET normalized_email = EXCLUDED.normalized_email RETURNING id`) via `docker exec -i loomspan-poc-pg psql …`, collects the returned IDs, and asserts: all 16 IDs identical, exactly one `poc_accounts` row for that email; it then deletes the synthetic row. Prints only pass/fail and counts — no connection string or credential (the container password is the documented local-only `poc-local-only`).
- Inputs/fixture: Synthetic email `race@example.invalid` inside the throwaway container only.
- Doubles or boundary isolation: Local container only; the script refuses to run if the container is absent and never accepts a hosted URL or connection string.
- Edge cases: Run after test 7's sequence in the same container; a second invocation re-races cleanly because the first run cleaned up.

### 9. Regression: existing suites updated, not weakened
- Type: Existing Node + Deno suites
- Location: All six Node test files and `poc/mcp-server/supabase/functions/mcp/core.test.ts`
- Proves: The preserved contract still holds under the new identity: tool payload shapes, error taxonomy and precedence (`unknown_app` → `not_member` → `stale_version` → `unknown_operation` → `invalid_arguments`), stale-then-retry exactly-one-write, DB-added `remove_item` execution, log shaping (now asserting `account_id` fields and still no token/argument-shaped keys), secret scan over the whole final tree (including the new migration, race script, and README), and the gate1-artifacts checks.
- Inputs/fixture: Existing fixtures; `OWNER`/`NONMEMBER` become resolved account IDs.
- Doubles or boundary isolation: As existing.
- Edge cases: The expected count grows beyond the 35/8 baseline by the tests above; exit 0 with zero skipped/removed assertions is the criterion — Step 4 reports the new totals rather than forcing the old counts.

### 10. Developer-run live reference flow modes (script update, not an automated gate)
- Type: Developer-run Node script against the deployed stack
- Location: `poc/web/tests/oauth-reference-flow.mjs` (extended per implementation Phase 5)
- Proves: Against the live consent page and function: owner approval → authenticated `list_apps` returns the grocery summary and the owner grocery exercise (seeded items visible, add persists on re-list); `--expect-nonmember` → authenticated `list_apps` empty, grocery `get_pack`/`call_operation` return `not_member`, and an `email`-keyed `call_operation` returns `invalid_arguments`; `--deny` → `access_denied`, no token exchange, unauthenticated `list_apps` HTTP 401.
- Inputs/fixture: Fresh DCR client per run (forces a real consent decision); the human signs in with a real controlled mailbox and types the received code; no mailbox, code, or token is printed or recorded (statuses, `ok`, `error_code`, app IDs, synthetic item name/count only).
- Doubles or boundary isolation: None — this is the live path, which is why it is developer-run and excluded from automated gates.
- Edge cases: A redirect-only (previously consented) response is reported as such, not counted as an approval-decision pass.

## Safe Verification Commands
- Focused (during development):
  - `deno test poc/mcp-server/supabase/functions/mcp/core.test.ts`
  - `node --test poc/web/tests/consent-core.test.mjs poc/web/tests/web-structure.test.mjs`
  - `node --test poc/mcp-server/tests/mcp-structure.test.mjs poc/mcp-server/tests/structure.test.mjs`
- Related suite (all safe Node suites, the research baseline set):
  - `node --test poc/mcp-server/tests/structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs poc/mcp-server/tests/mcp-structure.test.mjs poc/mcp-server/tests/gate1-artifacts.test.mjs poc/web/tests/consent-core.test.mjs poc/web/tests/web-structure.test.mjs`
- SQL fixture proof (PowerShell, throwaway local Docker only; from `poc/README.md`'s established sequence extended with the second migration):
  - `docker run --name loomspan-poc-pg -e POSTGRES_PASSWORD=poc-local-only -p 54329:5432 -d postgres:16`
  - Wait for readiness: `do { docker exec loomspan-poc-pg pg_isready -U postgres; $ready = ($LASTEXITCODE -eq 0); if (-not $ready) { Start-Sleep -Seconds 1 } } while (-not $ready)`
  - `Get-Content poc/mcp-server/supabase/migrations/20261027000001_poc_fixture_schema.sql | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1`
  - `Get-Content poc/mcp-server/supabase/migrations/20261030000001_poc_accounts.sql | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1`
  - `Get-Content poc/mcp-server/supabase/seed.sql | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1`
  - `Get-Content poc/mcp-server/tests/fixture.assertions.sql | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1`
  - Re-run `seed.sql` then `fixture.assertions.sql` once more (idempotency), then `node poc/mcp-server/tests/account-race.mjs`, then `docker rm -f loomspan-poc-pg`
- Password-removal grep gates (must return no matches):
  - `Select-String -Path poc/web/oauth/consent.html,poc/web/assets/consent.js -Pattern 'signInWithPassword|signin-password'`
  - `Select-String -Path (Get-ChildItem -Recurse poc -File).FullName -Pattern 'grant_type=password|POC_OWNER_PASSWORD|POC_NONMEMBER_PASSWORD'` (scanner/test files that merely name the `password` pattern, e.g. `secret-scan.test.mjs` and the `%password%` column check in `fixture.assertions.sql`, are detectors, not sign-in, and are excluded by these specific patterns)
- Full safe suite: the related Node suite + the Deno suite + the SQL fixture proof above, in that order. This is the broadest safe suite; the repo has no build, lint, or CI gate to add. No command contacts a live service, uses a real credential, or writes outside the throwaway container.

## Optional Developer Checks
These are required ticket evidence but human/live by nature; they are nonblocking for the automated gates and must be reported as performed/not-performed with redacted results (dates, outcomes, counts, error codes only) in `poc/README.md` — never represented as automated passes:
- Dashboard: confirm the D8 end state (email provider on, sign-ups allowed, Magic Link template delivers the 6-digit code, OTP length 6, default expiry/limits) and record before/after states.
- Live reference approval and denial runs (test 10) against `https://loomspan.ai/poc/oauth/consent`, including the visual check that the requesting client and requested access are shown before Approve/Deny are enabled.
- Live Codex flow: fresh Codex connection, email-code sign-in, approve, authenticated `list_apps` returns the grocery-list summary for the owner account; plus the companion-text spoof instruction (ask Codex to act using the owner's email mentioned in chat while signed in as the non-member — authorization must remain the non-member's).
- Owner grocery exercise on the deployed stack: seeded Oats/2, Apples/4, Milk/1 visible, add an item, item persists on a later list; afterwards clean synthetic items back to the resting fixture.
- Second controlled mailbox: different account (empty `list_apps`, `not_member` from grocery `get_pack`/`call_operation`).
- Wrong-code run (incorrect code fails, pending authorization neither approved nor denied, correct code then completes) and expired-code run (code requested, allowed to pass the dashboard-confirmed default expiry, fails the same way, new code completes).
- Case/whitespace sign-in (same mailbox, different case + surrounding whitespace → same account, grocery visible) and plus-tag sign-in (→ different account, no grocery).
- Owner carry-over verification: after the D9 dashboard SQL, exactly one `grocery-list` membership row, its `account_id` present in `poc_accounts`, items unchanged.

## Exit Criteria
- [x] The planned red test (`first resolution creates one account…`, test 3's core) fails for the intended missing-capability reason before implementation, when applicable.
- [x] New and updated tests pass after implementation.
- [x] The broadest safe relevant repository test suite passes (full Node set + Deno suite + local SQL proof incl. the race script, all exit 0).
- [x] Acceptance criteria map to executable evidence (traceability table in the implementation plan).
- [x] Routine automated tests do not perform unintended live or destructive operations (no hosted URL, mailbox, or credential in any automated gate; SQL runs only in the throwaway local container).
- [x] Material risks and edge cases identified above are covered (authorization by account ID, concurrency, normalization boundaries, OTP failure paths, spoof resistance, fixture preservation).
- [x] Any optional check is reported as nonblocking and is not represented as already performed.
