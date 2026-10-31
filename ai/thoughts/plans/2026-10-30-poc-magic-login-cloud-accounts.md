# Magic Login and Cloud Internal Accounts Implementation Plan

## Overview
- Ticket: `ai/thoughts/tickets/2026-10-30-poc-magic-login-cloud-accounts.md`
- Research: `ai/thoughts/research/2026-10-30-poc-magic-login-cloud-accounts.md`
- Outcome: The deployed consent page signs testers in with a 6-digit Supabase email code in the same tab (pending `authorization_id` preserved), the hosted MCP function resolves the verified token email to a permanent internal Cloud account (created exactly once on first sign-in), all three POC tools authorize by that internal account ID, the developer-designated owner mailbox carries the grocery owner membership onto its account, and `poc/README.md` records redacted live evidence. Tool names/inputs/outputs/error taxonomy and the grocery fixture (Oats/2, Apples/4, Milk/1) are unchanged.

## Current State
- Consent sign-in is password-only: email + password form in `poc/web/oauth/consent.html`, submitted via `supabase.auth.signInWithPassword` in `poc/web/assets/consent.js`; success calls `loadDetails()` with no navigation, so the module-level `authorization_id` (parsed by `parseAuthorizationId` in `poc/web/assets/consent-core.mjs`) survives. No `signInWithOtp`/`verifyOtp` exists anywhere in `poc/`. The pinned client is `supabase-js@2.78.0` CDN ESM, previously verified only for the `auth.oauth` namespace.
- MCP identity is the raw Supabase user ID: `poc/mcp-server/supabase/functions/mcp/index.ts` keeps only `data.user.id` from `supabase.auth.getUser()` and passes it to `handleListApps`/`handleGetPack`/`handleCallOperation` in `poc/mcp-server/supabase/functions/mcp/core.ts`. Membership queries in `poc/mcp-server/supabase/functions/mcp/data.ts` match `poc_app_memberships.user_id`; `LogRow.user_id` records the same UUID. The verified user's email is never read.
- Schema (single migration `poc/mcp-server/supabase/migrations/20261027000001_poc_fixture_schema.sql`): six tables, no accounts table, no email column; `poc_app_memberships(app_id, user_id uuid, role)` PK `(app_id, user_id)` with no FK (the Supabase `auth.users` ID was external, so no FK exists today either); `poc_tool_call_log.user_id uuid NULL`. `poc/mcp-server/supabase/seed.sql` seeds one membership for placeholder UUID `00000000-0000-4000-8000-000000000001`; on the hosted project that row was replaced by the synthetic password owner `poc-owner@example.invalid`'s real UUID (one row).
- No tool accepts an email: `validateArguments` in `core.ts` rejects undeclared `call_operation.arguments` keys as `invalid_arguments`, which is the current incidental spoof-resistance property to preserve.
- Baseline verified in research: Node suites 35/35, Deno core suite 8/8. `poc/web/tests/web-structure.test.mjs` currently asserts the password-form IDs (`signin-password` etc.) and therefore encodes the contract this ticket removes. `poc/mcp-server/tests/hosted-acceptance.mjs` acquires tokens via the password grant (`POC_OWNER_PASSWORD`/`POC_NONMEMBER_PASSWORD`) and is password-era tooling.
- Live/external facts: hosted project is Loomspan Testing (`yjrwyfkybszlpufsflan`, linked under `poc/mcp-server/supabase/.temp/`); Auth settings are dashboard-only (`supabase config push` is forbidden); the deployed consent page is served from the separate repo `C:\opendev\code\loomspan-website\public\poc\` (7 files, anon key injected only in the copy); the designated owner mailbox arrives only via the execution environment and must never be written to any repo, evidence, or transcript. Hosted email-OTP enablement/template/lifetime state is unknown and unreadable from this checkout.

## Desired End State
- On `https://loomspan.ai/poc/oauth/consent` with no session, the tester enters an email, receives a 6-digit code (Supabase built-in sending), and enters it on the same page in the same tab. First-time emails are auto-created as Supabase users by the OTP flow; there is no signup form, username, password, clickable-link-only path, or provider button anywhere. Only after successful code verification does the page load and show the requesting client and requested access, with Approve/Deny. Denial yields no token and no authenticated tool call.
- A wrong or expired code signs nobody in, neither approves nor denies the pending request, and leaves the tester able to retry with the correct code or request a new code and still complete the same pending authorization.
- The MCP function derives identity only from the verified Supabase token: it reads the user's email (and confirmed state), normalizes it (trim surrounding whitespace + lowercase, nothing else; plus-tags and dots stay significant), and resolves it to `poc_accounts.id` — creating the account atomically on first resolution — before any tool runs. By the time a first authenticated tool call completes, the account exists. Simultaneous first resolutions for one normalized email produce exactly one account. All membership checks and tool-call log rows use the internal account ID, never the Supabase user ID. No tool gains an email parameter; an email in `call_operation.arguments` or companion text changes nothing.
- The designated owner mailbox's account holds the `grocery-list` owner membership (carried over per Phase 5), so the owner still sees `grocery-list`, the seeded Oats/2, Apples/4, Milk/1, can add an item, and sees it persist. A second controlled mailbox signs in fine but is a different account: empty `list_apps`, `not_member` from grocery `get_pack`/`call_operation`.
- `poc/README.md` describes the email-code flow and test-owner procedure (password instructions retired/superseded) and records redacted live results (dates, outcomes, counts, error codes only). The repository contains no password sign-in code path, no designated mailbox address, no code, token, or key value.

## Scope
### In scope
- New migration `poc/mcp-server/supabase/migrations/20261030000001_poc_accounts.sql`: `poc_accounts` table, rename of membership/log identity columns to `account_id`, RLS enablement consistent with existing tables.
- Account resolution in the MCP function: pure helpers in `core.ts` (`normalizeAccountEmail`, verified-email extraction, `resolveOrCreateAccount` on `FixtureRepo`), Supabase implementation in `data.ts` (atomic upsert), wiring in `index.ts` (email from `getUser()`, fail-closed when absent/unverified, resolution failure surfaces as `internal_error` not `unauthenticated`).
- Consent-page OTP: pure request/verify helpers in `poc/web/assets/consent-core.mjs`, two-stage sign-in markup in `poc/web/oauth/consent.html`, glue in `poc/web/assets/consent.js`; password form and `signInWithPassword` removed. Onboarding wording in `poc/web/index.html` updated to the email-code flow.
- Test updates/additions detailed in the companion testing plan (`ai/thoughts/plans/2026-10-30-poc-magic-login-cloud-accounts-testing.md`): Deno core tests, Node structure/consent tests, SQL fixture assertions, a local-Postgres concurrency race script, and live-flow script modes.
- Retirement of password-era tooling: `poc/mcp-server/tests/hosted-acceptance.mjs` (password grant) is removed and its still-relevant hosted assertions move into the OAuth reference flow's expectations (see D7).
- Hosted execution: dashboard-only Auth changes for email OTP, migration applied to the hosted project without fixture loss, `supabase functions deploy mcp`, consent page deployed through the separate site repo, owner-membership carry-over, redacted live evidence in `poc/README.md`.

### Out of scope
- Any federated provider (Google/Microsoft/GitHub/Apple), account linking/merging, change-my-email, account recovery, invitation creation/discovery/acceptance, or membership management beyond carrying the one existing owner membership over.
- Production SMTP, custom email templates beyond making the built-in template deliver the 6-digit code, and any change to Supabase's default code lifetime/rate limits.
- Gate 1 scoring or re-scoring: ticket 4's human Gate 1 companion runs stay not-run and untouched; this ticket produces login-and-account evidence only.
- Tool contract changes: `list_apps`/`get_pack`/`call_operation` names, inputs, outputs, and the error taxonomy (`unauthenticated`, `not_member`, `stale_version`, `invalid_arguments`, `unknown_app`, `unknown_pack`, `unknown_operation`, `invalid_definition`, `item_not_found`, `internal_error`) are preserved exactly; only the identity they authorize against changes.
- A replacement Supabase project, `supabase config push`, or committing the designated mailbox, any code/token/key, or the real anon key in this repo.

## Active Project Guardrails
None recorded (`ai/thoughts/design-lens.md` states there are currently no active project-specific design guardrails). Proceed from the ticket, research, and `ai/thoughts/phases/013-magic-login-and-cloud-accounts.md` decisions only.

## Resolved Decisions (from research Open Questions)
Each research Open Question is settled here from repository evidence; Step 4 does not re-derive these. Only D8's hosted-state facts must be read at execution time (they are operational facts, not decisions).

### D1 — Internal account ID is a database-generated `uuid` (research Q1, Q8)
`poc_accounts.id uuid PRIMARY KEY DEFAULT gen_random_uuid()`. Rationale: both existing identity columns (`poc_app_memberships.user_id`, `poc_tool_call_log.user_id`) are already `uuid`, the handlers and `FakeRepo` already pass identity as an opaque string, and phases/008+013 require only a permanent Cloud-owned ID — a UUID satisfies this with zero type churn in `core.ts`, the log shape, or test fixtures. Consequences: the migration renames `poc_app_memberships.user_id → account_id` and `poc_tool_call_log.user_id → account_id` (a rename preserves every existing row and the `(app_id, user_id)` primary key becomes `(app_id, account_id)`), and `LogRow.user_id` becomes `LogRow.account_id` recording the internal account ID for authenticated calls and `null` for unauthenticated rejections. Historical hosted log rows keep their values under the renamed column; their values are pre-change Supabase UUIDs and are not rewritten (Gate 1 evidence is historical, not re-scored).

### D2 — Account schema and uniqueness (research Q1, Q7)
New table in the new migration:
```sql
CREATE TABLE poc_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_email text NOT NULL UNIQUE
    CHECK (normalized_email <> '' AND normalized_email = lower(btrim(normalized_email))),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE poc_accounts ENABLE ROW LEVEL SECURITY;
```
The `UNIQUE` constraint on `normalized_email` is the concurrency guarantee; the `CHECK` makes non-canonical storage impossible even if a future writer bypasses the server normalization. No `supabase_user_id` column is stored: resolution is purely by normalized verified email (ticket: a Supabase user is only the sign-in identity that resolves to the account; different email = different account; no linking), so a stored user-ID mapping would add a second, conflicting key. Like the current membership column, `poc_app_memberships.account_id` carries no foreign key to `poc_accounts` — parity with today's design, where `user_id` has no FK to the external `auth.users`; this also lets the seed's placeholder UUID and the hosted synthetic-owner row survive the rename untouched until Phase 5 carry-over. Resolution is an atomic upsert, never select-then-insert (see D4).

### D3 — Resolution happens only in the MCP function, per authenticated request (research Q2)
The consent page does **not** create accounts; it only establishes the Supabase session via OTP. On each authenticated MCP request, `index.ts` resolves the verified email to an account ID before dispatching any tool, creating the account if absent. This is the single resolution point (one owner of the behavior), it satisfies "by the time their first authenticated tool call completes, that account exists" by construction, and it avoids duplicating account logic in browser code that only has the anon key while all fixture tables are RLS-locked with no policies (the service-role data layer in `data.ts` is the only writer). Cost: one extra upsert round-trip per MCP request — acceptable for a POC fixture and idempotent.

### D4 — Identity extraction and normalization in the pure core (research Q3)
In `core.ts`, add pure, Deno-testable helpers so the security-critical logic is covered without a live Supabase:
- `normalizeAccountEmail(email: unknown): string | null` — returns `null` for non-strings and for strings that are empty after trimming; otherwise `email.trim().toLowerCase()`. No other rewriting (plus-tags, dots preserved). JavaScript `trim()` is the canonical normalization; it runs before every insert, and the D2 `CHECK` uses Postgres `btrim`/`lower` only as a backstop for the stored value the server already normalized.
- `verifiedAccountEmail(user: unknown): string | null` — given the `getUser()` user object, returns `normalizeAccountEmail(user.email)` only when `user.email_confirmed_at` is a non-empty string; otherwise `null`. Failing closed on unconfirmed email prevents an unverified address from ever becoming an account key; OTP verification confirms the email, so the legitimate flow always satisfies this.
- `FixtureRepo.resolveOrCreateAccount(normalizedEmail: string): Promise<string>` — new repo method returning the account ID. In `data.ts` it is one atomic statement via supabase-js: `client.from("poc_accounts").upsert({ normalized_email: normalizedEmail }, { onConflict: "normalized_email" }).select("id").single()` (Postgres `INSERT … ON CONFLICT DO UPDATE … RETURNING`, which serializes concurrent first resolutions onto the D2 unique constraint; `unwrap` turns an error into a throw, as elsewhere).
- Handlers keep their signatures except the identity parameter is renamed `userId → accountId` in `handleListApps`/`handleGetPack`/`handleCallOperation`, `FixtureRepo.listMemberApps(accountId)`, and `FixtureRepo.isMember(appId, accountId)`; `data.ts` queries `.eq("account_id", …)` and `insertLog` writes `account_id`. Tool logic, ordering of checks (membership before version/arguments/effects), and payloads are otherwise untouched.

### D5 — Fail-closed identity outcomes in `index.ts` (research Q3)
In `poc/mcp-server/supabase/functions/mcp/index.ts`, after `supabase.auth.getUser()`:
- No user `id`, or `verifiedAccountEmail(user)` returns `null` → the existing `unauthenticated` payload path (`rejectUnauthenticated` / pre-handler 401 logging unchanged; log rows keep `account_id: null`).
- Verified email present → `accountId = await repo.resolveOrCreateAccount(email)`; the three tool registrations close over `accountId` instead of `userId`.
- Resolution throws (database failure) → the tools return the existing `internal_error` payload shape (`{ ok: false, error_code: "internal_error", guidance: … }`) rather than `unauthenticated`, because the caller *is* authenticated; the failure is logged through `safeInsertLog` with `account_id: null`. Implement by resolving inside a `try` in the authenticated closure and registering handlers against a small discriminated result (`{ kind: "account", accountId } | { kind: "unauthenticated" } | { kind: "resolution_failed" }`), mirroring the existing `userId ? … : rejectUnauthenticated(…)` ternary style. The user's email, like the ID today, is never logged, rendered, or placed in a payload.

### D6 — Consent-page OTP via `signInWithOtp` + `verifyOtp` on the pinned bundle (research Q4)
Mirror the existing pure-core + glue split:
- `poc/web/assets/consent-core.mjs` gains `requestEmailCode(supabase, email)` → calls `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })` and `verifyEmailCode(supabase, email, code)` → calls `supabase.auth.verifyOtp({ email, token: code, type: "email" })`. Both follow the `loadAuthorization`/`decideAuthorization` conventions: a guarded method lookup (missing method → `{ kind: "error", message: MISSING_OTP_MESSAGE }` fail-closed friendly message, never a raw `TypeError`), thrown exceptions and `{ error }` results mapped to `{ kind: "error", message }` with only the error name/message, success to `{ kind: "ok" }`. `shouldCreateUser: true` is stated explicitly (it is what makes a first-time email able to sign in with no separate signup; it is also the supabase-js default, recorded here so the requirement is not left implicit). The email passed to both calls is the trimmed value the tester submitted (trim only in the browser; lowercasing is the server's account-key job, D4, and Supabase treats the mailbox case-insensitively for delivery).
- `poc/web/oauth/consent.html`: the `consent-signin` section becomes two stages in the same section — stage 1: `signin-email` input + `signin-send-code` submit ("Email me a sign-in code"); stage 2 (hidden until a code is sent): `signin-code` input (`inputmode="numeric"`, `autocomplete="one-time-code"`), `signin-verify` submit, `signin-resend` button, `signin-change-email` button, plus the existing `signin-error` box reused for both stages. `signin-password` and all password copy are removed. No other sections, IDs, or the disabled Approve/Deny initial state change.
- `poc/web/assets/consent.js`: replace the `signInWithPassword` submit handler with: stage-1 submit → `requestEmailCode` → on success reveal stage 2 (email input retained/read-only context, code input focused), on error show a generic message and stay on stage 1; verify submit → `verifyEmailCode` → on success `await loadDetails()` (same no-navigation continuation as today, pending `authorization_id` intact), on error show "That code did not work. Check the code and try again, or request a new code." and stay on stage 2 with the code input cleared — nobody is signed in, nothing is approved or denied, retry and resend remain available; resend → `requestEmailCode` again with the same trimmed email; change-email → back to stage 1. Codes are never rendered (beyond the tester's own entry field), logged, or stored. The code is not length-validated in the browser beyond non-empty: Supabase is the authority on wrong vs expired, and both arrive as the same error path the ticket specifies.
- Phase 0 (below) verifies the pinned `2.78.0` bundle actually exposes `signInWithOtp`/`verifyOtp` before any of this is built on it, exactly as ticket 3 verified `auth.oauth`; if the pinned bundle lacks them, Step 4 stops and returns `needs-developer` (a pin change is a material, recorded decision, not a silent bump).

### D7 — Password sign-in is removed everywhere it functions, not just hidden (ticket AC)
Remove: the password field/handler (D6), the onboarding "test account" wording in `poc/web/index.html` (both companion step lists now say to sign in with the email code sent to their mailbox), and `poc/mcp-server/tests/hosted-acceptance.mjs` (its token acquisition *is* the password grant; keeping it would keep a password sign-in path in the repo). The hosted assertions it performed (owner/non-member tool behavior) are preserved as live evidence through the extended reference flow in Phase 5, which obtains tokens only through the real consent path. Dated historical evidence paragraphs in `poc/README.md` that describe past password-era runs are history, not instructions: Phase 6 rewrites every *current* instruction/runbook (test-owner setup, direct-token acquisition, hosted acceptance) to the email-code flow or marks it superseded, so no usable password procedure remains. The secret-scan suite's own `password`-pattern detectors and the fixture assertions' `%password%` column check are scanners, not sign-in, and stay.

### D8 — Hosted Auth end state, read then set in the dashboard only (research Q5)
Execution-time facts to obtain and then set, all in the dashboard (never `supabase config push`), recorded in `poc/README.md` as setting names/states (no values that are secrets — these are not): Email provider enabled; "Allow new users to sign up" enabled (required for first-time OTP creation); the Magic Link email template delivers the 6-digit code (contains the `{{ .Token }}` placeholder — if the hosted template is link-only, edit the template in the dashboard to include the code; this is a dashboard content change, not local config); OTP/code length 6 and code expiry/rate limits left at Supabase defaults per the ticket. Current hosted values are recorded before change so the change is auditable and reversible. If built-in delivery cannot reach the test mailboxes, the ticket's reassessment trigger fires: stop, record, return `needs-developer` — no fallback to links, providers, or pasted tokens.

### D9 — Owner carry-over is an environment-fed, post-first-sign-in data step (research Q6)
Order matters and is fixed: (1) migration + new function deployed; (2) the designated owner signs in through the live reference flow and completes an authenticated `list_apps` (this creates the owner account via D3, but the account has no membership yet, so this run's `list_apps` may legitimately return empty — that is expected mid-procedure, not a failure); (3) the developer runs the carry-over SQL **in the dashboard SQL editor**, typing the designated mailbox (normalized: trimmed/lowercased) only there — the committed runbook in `poc/README.md` shows the statement with a `<designated-owner-email>` placeholder and no real address ever enters the repo:
```sql
BEGIN;
INSERT INTO poc_app_memberships (app_id, account_id, role)
SELECT 'grocery-list', id, 'owner' FROM poc_accounts
WHERE normalized_email = '<designated-owner-email>'
ON CONFLICT (app_id, account_id) DO NOTHING;
-- Only after verifying the new owner row exists (count check in runbook):
DELETE FROM poc_app_memberships
WHERE app_id = 'grocery-list'
  AND account_id NOT IN (SELECT id FROM poc_accounts);
COMMIT;
```
The `DELETE` removes the legacy synthetic-owner row generically (it is the only membership whose `account_id` resolves to no account) without naming any UUID or address. The runbook's verification is counts-only: exactly 1 `grocery-list` membership row, its `account_id` present in `poc_accounts`, items still Oats/2, Apples/4, Milk/1. (4) Re-run the reference flow signed in as the owner: `list_apps` now returns `grocery-list`. The synthetic password users are not deleted (out of scope) but no longer authorize anything, since no account resolves to their IDs.

### D10 — Site deployment reuses the established copy procedure
The 7 deployable files under `poc/web/` (pages, assets, CSS) are copied to `C:\opendev\code\loomspan-website\public\poc\` exactly as in ticket 3, with `__LOOMSPAN_ANON_KEY__` replaced only in the copied `config.js`, the deployed copy scanned with the secret-scan patterns before commit/push there, and the live URLs (`https://loomspan.ai/poc/`, `https://loomspan.ai/poc/oauth/consent`) verified to serve the new OTP markup (code-stage element IDs present, no `signin-password`). That repo's commit/push follows its own conventions; if it is unavailable or push is not permitted at execution time, Step 4 returns `needs-developer` with local work preserved rather than claiming live criteria.

## Impact and Risk Analysis
- **Authorization boundary (highest):** identity now derives from an email claim. Mitigations: email taken only from the server-verified `getUser()` result (never tool arguments, headers beyond the bearer token, or companion text — no tool gains an email parameter, and `validateArguments` still rejects an `email` key inside `call_operation.arguments` as `invalid_arguments`); unconfirmed email fails closed (D4); resolution failure is `internal_error`, never a silent fall-back to the Supabase user ID (no dual-identity path exists after this change — `data.ts` will contain no `user_id` membership query).
- **Concurrency:** two simultaneous first tool calls for one email race the upsert; the D2 unique constraint + single-statement `ON CONFLICT` upsert guarantee one row and one returned ID. Proven by the local-Postgres race script in the testing plan, not asserted from code reading.
- **Fixture preservation:** the migration only creates `poc_accounts`, enables its RLS, and renames two columns — it inserts, updates, and deletes no fixture rows, so seeded items, packs, definitions, and the membership row survive by construction; the from-empty SQL proof (migration 1 + migration 2 + seed + assertions, run twice) and hosted pre/post count checks prove it. The seed's non-resetting nature (`WHERE NOT EXISTS` items guard) is respected: live-run item adds are cleaned up with the existing reset discipline in `poc/README.md` so the resting state stays Oats/2, Apples/4, Milk/1.
- **Consent-flow context loss:** the two-stage OTP form introduces new ways to lose the pending request (full reload between stages would still leave `authorization_id` in the URL and a persisted Supabase session check on load; a *new-tab* link open is excluded by the code-not-link design). Wrong/expired handling never calls `loadAuthorization`/`decideAuthorization`, so a failed code cannot approve or deny. The redirect-only (previously consented) shortcut still exists; live approval/denial evidence therefore keeps using a fresh DCR client per run, as the existing reference flow already does.
- **Email delivery (external, unverifiable from this repo):** built-in sending, default lifetime/limits, and the template's code placeholder (D8) can only be proven live. This is the ticket's named reassessment trigger; failure stops the pipeline step for a developer decision instead of substituting links/providers/tokens.
- **Secret/address leakage:** three surfaces — committed source (existing secret-scan suite, extended per the testing plan to the new files and to a designated-address-shaped check only insofar as no real address exists to scan for; the structural guard is that the address is never typed into this repo), deployed site copy (pre-push scan, D10), and evidence (`poc/README.md` redaction rule extended explicitly to mailbox addresses and codes; reference-flow output stays redacted by construction).
- **Breaking existing tests knowingly:** `web-structure.test.mjs` password-ID assertions, `fixture.assertions.sql` `user_id` column assertions, `core.test.ts` `FakeRepo` (must implement `resolveOrCreateAccount` and `account_id` log rows), and `mcp-structure.test.mjs`/structure lists (new migration file) encode the old contract. Each is updated to the new contract in the same phases that change the code — updated, never deleted to make a run green (see testing plan).
- **Rollback:** code rollback is redeploying the previous function/pages; schema rollback is a compensating migration renaming `account_id → user_id` and dropping `poc_accounts` (the rename kept all rows, so this is lossless for membership/log data; accounts created in the interim and their membership carry-over would need the D9 procedure re-run after roll-forward). The hosted migration is applied only after the local from-empty proof passes, and dashboard Auth changes (D8) are recorded before/after so they can be reverted in the dashboard.

## Implementation Approach
Keep every existing architectural seam and change only what sits behind it: pure logic in `core.ts`/`consent-core.mjs` (testable in Deno/Node without network), thin glue in `index.ts`/`data.ts`/`consent.js`, schema as an additive second migration, and live changes (dashboard, hosted DB, function deploy, site deploy) as explicitly gated phases after all local proof is green. Ordering is deliberate: verify the external API surface first (Phase 0), then schema (Phase 1), then the authorization rekey with its tests (Phase 2), then the consent OTP with its tests (Phase 3), then the full local gate (Phase 4), and only then touch anything live (Phase 5) and write evidence (Phase 6). The companion testing plan (`ai/thoughts/plans/2026-10-30-poc-magic-login-cloud-accounts-testing.md`) defines the red test, coverage, commands, and exit criteria for these phases.

## Phase 0: Verify the external surfaces this plan builds on
### Changes
- [x] Fetch the pinned `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.78.0/+esm` bundle to a scratch location outside the repo and confirm the strings `signInWithOtp` and `verifyOtp` exist in it (the same bundle-grep verification ticket 3 used for `auth.oauth`). Record only the boolean result and bundle identity in the Step 4 work log/`poc/README.md`, not bundle content.
- [ ] In the Supabase dashboard (Loomspan Testing), read and record the current Email provider state, sign-up allowance, Magic Link template shape (code placeholder present or link-only), OTP length, and expiry/rate-limit values (D8) in `poc/README.md`'s preflight style — setting names and states only.
- [ ] Record hosted pre-change counts via the dashboard SQL editor (results in `poc/README.md`, counts only): `poc_apps`, `poc_app_definitions`, `poc_packs` row counts, `poc_app_memberships` count for `grocery-list`, and grocery items as `name/quantity` in insertion order (expected Oats/2, Apples/4, Milk/1).
- [x] Inspect `C:\opendev\code\loomspan-website\public\poc\` read-only: confirm the 7-file layout matches `poc/web/` sources and note that repo's commit/deploy convention for Phase 5 (D10).

### Automated verification
- [ ] None (read-only verification phase). The bundle check's pass condition is objective: both method names found in the pinned bundle; otherwise stop with `needs-developer` per D6.

### Optional developer checks
- [ ] None.

## Phase 1: Accounts schema migration
### Changes
- [x] `poc/mcp-server/supabase/migrations/20261030000001_poc_accounts.sql` — create `poc_accounts` exactly per D2 (UUID PK with `gen_random_uuid()` default, `normalized_email` unique + canonical-form `CHECK`, `created_at`), enable its RLS, `ALTER TABLE poc_app_memberships RENAME COLUMN user_id TO account_id;`, `ALTER TABLE poc_tool_call_log RENAME COLUMN user_id TO account_id;`. No fixture row is inserted, updated, or deleted.
- [x] `poc/mcp-server/supabase/seed.sql` — the placeholder membership insert targets `account_id` (same placeholder UUID, comment updated to call it a placeholder account ID); nothing else changes.
- [x] `poc/mcp-server/tests/fixture.assertions.sql` — update the log-column assertions from `user_id` to `account_id` (still nullable, still no credential-like columns), and add: `poc_accounts` exists and starts empty after seed; exactly one `grocery-list` membership row whose `account_id` is the seed placeholder; a rolled-back probe that a non-canonical `normalized_email` insert (uppercase or padded) raises a check violation and a duplicate `normalized_email` insert raises a unique violation; existing fixture assertions (apps/definitions/packs/items Oats,Apples,Milk with quantities 2,4,1, empty log) unchanged.

### Automated verification
- [x] Local Docker Postgres proof (commands in the testing plan): both migrations + seed + assertions from empty, then seed + assertions again — all exit 0, proving fixture preservation and idempotency under the new schema.

### Optional developer checks
- [ ] None.

## Phase 2: MCP account resolution and authorization rekey
### Changes
- [x] `poc/mcp-server/supabase/functions/mcp/core.ts` — add `normalizeAccountEmail` and `verifiedAccountEmail` (D4); rename `LogRow.user_id → account_id`, `FixtureRepo.listMemberApps/isMember` identity parameters to `accountId`, and add `FixtureRepo.resolveOrCreateAccount(normalizedEmail)`; rename the `userId` parameter to `accountId` in `handleListApps`/`handleGetPack`/`handleCallOperation` and in every `base` log row. No tool logic, check ordering, payload shape, or error text changes.
- [x] `poc/mcp-server/supabase/functions/mcp/data.ts` — implement `resolveOrCreateAccount` as the D4 atomic upsert on `poc_accounts` returning `id`; `listMemberApps`/`isMember` filter on `account_id`; `insertLog` writes `account_id`. No `user_id` reference remains in the function.
- [x] `poc/mcp-server/supabase/functions/mcp/index.ts` — wire D5: extract `verifiedAccountEmail(data.user)` alongside the existing `id` check; resolve to `accountId` via the service repo before `createMcpHandler`; tool registrations close over the discriminated identity result (account → handlers with `accountId`; unauthenticated → existing rejection/logging; resolution failure → `internal_error` payload). Update the tool description strings that say "signed-in user" only if needed for accuracy (descriptions are not part of the preserved input/output contract; default is to leave them unchanged).
- [x] `poc/mcp-server/supabase/functions/mcp/core.test.ts` — extend `FakeRepo` with an in-memory accounts map implementing `resolveOrCreateAccount` (create-once semantics with a creation counter), switch `OWNER`/`NONMEMBER` fixtures to account IDs, and update log assertions to `account_id` (full test list in the testing plan).

### Automated verification
- [x] `deno test poc/mcp-server/supabase/functions/mcp/core.test.ts` — exit 0, including new normalization/resolution/authorization-by-account tests from the testing plan.
- [x] `node --test poc/mcp-server/tests/mcp-structure.test.mjs` — exit 0 (exactly three tools, no operation-name dispatch, no credential logging still hold).

### Optional developer checks
- [ ] None.

## Phase 3: Consent-page email-code sign-in
### Changes
- [x] `poc/web/assets/consent-core.mjs` — add `requestEmailCode`, `verifyEmailCode`, and `MISSING_OTP_MESSAGE` per D6, following the `oauthMethod` guard and discriminated-result conventions of `loadAuthorization`/`decideAuthorization`.
- [x] `poc/web/oauth/consent.html` — replace the password form with the D6 two-stage email-code form (stage-2 section hidden initially); remove `signin-password`; keep all other region IDs and the disabled-by-default Approve/Deny buttons.
- [x] `poc/web/assets/consent.js` — replace the `signInWithPassword` handler with the D6 stage wiring (send → verify/resend/change-email), generic failure copy that keeps the tester on the current stage, code field cleared on failure, and `loadDetails()` only after a successful verify. No navigation is introduced anywhere in sign-in.
- [x] `poc/web/index.html` — in both companion step lists, replace "sign in on the Loomspan consent page with your test account" with the email-code instruction (enter your email, receive a 6-digit code, enter it on the same page).
- [x] `poc/web/tests/consent-core.test.mjs` — add OTP stub coverage (testing plan); `poc/web/tests/web-structure.test.mjs` — replace the password-ID assertions with the OTP-ID set and assert absence of `signin-password`/`signInWithPassword` in the consent page and glue.
- [x] Delete `poc/mcp-server/tests/hosted-acceptance.mjs` (D7).

### Automated verification
- [x] `node --test poc/web/tests/consent-core.test.mjs poc/web/tests/web-structure.test.mjs` — exit 0.
- [x] Repository grep gate: no `signInWithPassword`, `signin-password`, or `grant_type=password` under `poc/web/` or `poc/mcp-server/supabase/functions/` (exact command in the testing plan).

### Optional developer checks
- [ ] None.

## Phase 4: Full local gate
### Changes
- [x] No production changes; fix only failures the gate exposes, in the phase that owns them.

### Automated verification
- [x] Full Node suite (all six files from the research baseline) and the Deno suite — exit 0 (testing plan lists exact commands).
- [x] Local Docker Postgres proof including the concurrency race script (testing plan) — exit 0: 16 parallel duplicate first resolutions of one synthetic email return one account ID and leave exactly one `poc_accounts` row.
- [x] Secret scan suite passes; the grep gate from Phase 3 passes.

### Optional developer checks
- [ ] None. Nothing live has been touched up to this point.

## Phase 5: Hosted deployment, owner carry-over, and live flows
### Changes
- [ ] Dashboard (D8): enable/confirm email OTP end state (provider on, sign-ups allowed, Magic Link template contains the 6-digit code placeholder, OTP length 6, default expiry/limits unchanged from defaults); record before/after states in `poc/README.md`. Never `supabase config push`.
- [ ] Apply the migration to the hosted project from `poc/mcp-server` with `npx supabase db push` (migration only; the forbidden operation is `config push`). Re-run the Phase 0 hosted count queries: fixture counts and items unchanged, one `grocery-list` membership row present under `account_id`.
- [ ] Deploy the function: `npx supabase functions deploy mcp` from `poc/mcp-server`; confirm the hosted function is ACTIVE at the new version (record version/date, no secrets).
- [ ] Deploy the consent page per D10 through `C:\opendev\code\loomspan-website` (copy 7 files, inject the anon key only in the copy, scan the copy, commit/push there); verify live `https://loomspan.ai/poc/oauth/consent` serves the OTP markup and `https://loomspan.ai/poc/` the updated wording.
- [ ] Owner carry-over per D9: owner reference-flow sign-in (creates the account), dashboard carry-over SQL with the env-supplied mailbox typed only in the dashboard, counts-only verification, then a second owner reference-flow run proving `list_apps` returns `grocery-list`.
- [x] `poc/web/tests/oauth-reference-flow.mjs` — extend with expectation modes used by the live runs: default owner mode (existing assertions), `--expect-nonmember` (authenticated `list_apps` returns `ok` with zero apps), and an owner grocery exercise (`get_pack` for `grocery-list`, `list_items` shows the seeded items, `add_item` a uniquely named synthetic item, `list_items` again shows it persisted; nonmember mode asserts grocery `get_pack` and `call_operation` return `not_member`, and a `call_operation` whose `arguments` contain an `email` key returns `invalid_arguments`). Output remains redacted by construction (statuses, `ok`, `error_code`, app IDs, item names/counts of synthetic data only — never the mailbox, code, or token). The script still registers a fresh DCR client per run so approval/denial are real decisions.
- [ ] Live runs (developer-performed, recorded redacted in `poc/README.md`): (a) reference approval flow as owner → authenticated `list_apps` returns the grocery summary; (b) reference denial flow (`--deny`) → `error=access_denied`, no token, unauthenticated `list_apps` is HTTP 401; (c) fresh Codex connection → email-code sign-in, approve, authenticated `list_apps` returns the grocery-list summary for the owner account (this is the ticket's Codex criterion; Muse/ChatGPT Gate 1 worksheets are not touched); (d) second controlled mailbox via reference flow `--expect-nonmember` → different account behavior as above, including the email-as-argument spoof probe; (e) wrong-code run: request a code, enter an incorrect code, confirm sign-in fails with the pending authorization neither approved nor denied, then enter the correct code and complete approval; (f) expired-code run: request a code, wait past the dashboard-confirmed default expiry, confirm the code fails the same way, then request a new code and complete the flow; (g) case/whitespace run: sign in with the owner mailbox typed in different letter case with surrounding whitespace → same account (grocery visible); plus-tag run: owner mailbox plus a plus-tag → different account (no grocery). After the runs, remove any synthetic items added and restore/verify the resting fixture Oats/2, Apples/4, Milk/1 (existing reset discipline in `poc/README.md`).

### Automated verification
- [ ] `node poc/web/tests/oauth-reference-flow.mjs` (owner approval) and `node poc/web/tests/oauth-reference-flow.mjs --deny` — exit 0 against the deployed stack.
- [ ] Hosted count/item queries (counts only) match the Phase 0 baseline after cleanup.

### Optional developer checks
- [ ] The Codex, second-mailbox, wrong/expired-code, and case/plus-tag observations above are developer-performed live checks; they are required ticket evidence but are not automated gates, and `poc/README.md` records them as dates/outcomes/error codes only.

## Phase 6: Documentation and evidence close-out
### Changes
- [x] `poc/README.md` — rewrite the test-owner setup and sign-in instructions to the email-code flow (owner designation via execution environment only, D9 carry-over runbook with placeholder, second-mailbox procedure), retire or mark superseded every password instruction (including the direct-token/password-grant section and `hosted-acceptance.mjs` references), document the dashboard OTP settings (D8), the migration/function/site deployment steps actually performed, and the redacted live results (dates, outcomes, counts, error codes only — no designated mailbox, code, token, or key). Update the progress/handoff table with this ticket's status.
- [x] Confirm the ticket's acceptance criteria one by one against the recorded evidence; leave any criterion whose live run did not happen unchecked with the reason recorded, rather than claiming it.

### Automated verification
- [x] Full Node + Deno suites and the secret scan pass on the final tree (the README text must not trip the secret scan or introduce a mailbox address/code/token).
- [x] Grep gate: no `signInWithPassword`, `signin-password`, `grant_type=password`, or `POC_OWNER_PASSWORD`/`POC_NONMEMBER_PASSWORD` anywhere under `poc/`.

### Optional developer checks
- [ ] None.

## Test Strategy
Defined in full in `ai/thoughts/plans/2026-10-30-poc-magic-login-cloud-accounts-testing.md`: Deno unit tests for normalization, verified-email extraction, first-resolution creation, same-email reuse, case/whitespace equivalence, plus-tag separation, concurrent-resolution single-creation (fake level), and authorization-by-account regression of the existing 8-test suite; Node tests for the OTP core (success/wrong/expired/retry-resend with the pending authorization untouched) and updated structure assertions (OTP IDs in, password IDs out); SQL assertions for the accounts table, canonical-email constraints, column renames, and fixture preservation; a Docker-local race script proving one account under 16 parallel duplicate resolutions; and the developer-run live reference/Codex flows as non-automated ticket evidence. Existing suites are updated to the new contract, never weakened.

## Acceptance-Criteria Traceability
| Acceptance criterion | Planned code evidence | Planned test evidence |
| --- | --- | --- |
| Live reference flow: email-code sign-in, client+access shown before deciding, approve → authenticated `list_apps`; denial → no token, unauthenticated rejection | Phase 3 OTP consent (D6); Phase 5 deployed page + function | Phase 5 reference approval run and `--deny` run exit 0 (developer-run, redacted in `poc/README.md`) |
| Live Codex flow: fresh connection, email-code sign-in, approve, `list_apps` returns grocery summary for owner | Phase 5 deployed stack + D9 carry-over | Phase 5 developer-performed Codex run recorded redacted in `poc/README.md` |
| First sign-in creates exactly one internal account; concurrency raced and observed | D2 unique constraint + D4 atomic upsert; Phase 1–2 | Deno concurrent-resolution test; Docker-local `account-race.mjs` 16-way race → one ID, one row |
| Designated owner sees `grocery-list`, seeded Oats/2, Apples/4, Milk/1, adds an item, sees it persist | D9 carry-over; Phase 5 function/page live | Reference-flow owner grocery exercise; hosted counts/items queries before/after |
| Second mailbox: different account, no grocery in `list_apps`, `not_member` from grocery `get_pack`/`call_operation` | D3/D4 resolution by email; membership by `account_id` | Deno different-email separation tests; live `--expect-nonmember` reference run |
| Identity cannot be spoofed via tool arguments or companion text | No email parameter added; `validateArguments` unchanged; identity only from verified token (D4/D5) | Deno test: `email` inside `call_operation.arguments` → `invalid_arguments`, non-member stays non-member; live spoof probe in nonmember run; Codex companion-text instruction recorded in `poc/README.md` |
| Same mailbox with different case/whitespace → same account; plus-tag → different account | `normalizeAccountEmail` trim+lowercase only (D4); D2 canonical CHECK | Deno normalization/reuse/separation tests; SQL canonical probes; live case/whitespace and plus-tag sign-ins (Phase 5) |
| Wrong and expired codes fail, pending authorization untouched, retry/new code completes | D6 error path stays on code stage, never calls consent decision | Node OTP core tests (wrong, expired, retry, resend stubs); live wrong-code and expired-code runs (Phase 5) |
| Existing suites pass incl. coverage of creation, reuse, normalization, separation; secret scan passes; no password sign-in in consent page or repository | Phases 1–4 code + test updates; D7 removal | Full Node + Deno suites exit 0; secret-scan suite; grep gate (Phase 3/6) |
| Deployed page offers no provider/linking/merging/change-email flow; README records redacted results with no mailbox/code/token/key | Phase 3 page contains only the OTP form; Phase 6 README | Updated `web-structure.test.mjs` (OTP IDs only); secret-scan suite over the final tree; live page markup check (Phase 5) |

## Risks and Rollback/Recovery
- **Pinned bundle lacks the OTP methods** (Phase 0 gate): stop, return `needs-developer` with the bundle evidence and a recommended pin decision; do not silently bump or hand-roll an Auth REST call.
- **Built-in email delivery or template cannot deliver a usable 6-digit code** (D8): ticket reassessment trigger — stop and return `needs-developer`; no link/provider/token fallback.
- **Hosted migration drift:** apply only via `npx supabase db push` after the local from-empty proof; if the hosted migration history rejects it, apply the identical SQL in the dashboard SQL editor and record that fact (the SQL is idempotent-unsafe by design — renames — so it must be applied exactly once; the pre/post counts detect a partial application).
- **Owner carry-over mistargeted:** the D9 transaction verifies the new owner row (count = 1, `account_id` present in `poc_accounts`) before the legacy-row `DELETE`, and the whole carry-over is one transaction; a wrong normalized email yields zero inserted rows and the runbook says to roll back and re-check the env-supplied address (in the dashboard only).
- **Rollback:** redeploy the prior function version and site copy; schema rollback is a compensating migration (`account_id → user_id` renames, drop `poc_accounts`) that is lossless for pre-existing rows because Phase 1 only renamed columns; any accounts/memberships created post-change are POC test data and are recreated by re-running Phase 5 after roll-forward. Dashboard Auth changes are reverted from the Phase 0 recorded before-state.

## References
- Ticket: `ai/thoughts/tickets/2026-10-30-poc-magic-login-cloud-accounts.md`
- Research: `ai/thoughts/research/2026-10-30-poc-magic-login-cloud-accounts.md`
- Testing plan: `ai/thoughts/plans/2026-10-30-poc-magic-login-cloud-accounts-testing.md`
- Decisions: `ai/thoughts/phases/013-magic-login-and-cloud-accounts.md`, `ai/thoughts/phases/008-federated-login-and-cloud-accounts.md`
- Source: `poc/web/oauth/consent.html`, `poc/web/assets/consent.js`, `poc/web/assets/consent-core.mjs`, `poc/web/index.html`, `poc/mcp-server/supabase/functions/mcp/index.ts`, `poc/mcp-server/supabase/functions/mcp/core.ts`, `poc/mcp-server/supabase/functions/mcp/data.ts`, `poc/mcp-server/supabase/migrations/20261027000001_poc_fixture_schema.sql`, `poc/mcp-server/supabase/seed.sql`, `poc/mcp-server/tests/fixture.assertions.sql`, `poc/web/tests/oauth-reference-flow.mjs`, `poc/README.md`
