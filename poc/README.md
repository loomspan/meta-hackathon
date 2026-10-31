# Loomspan POC — Foundation Fixture (Ticket 1)

Purpose: self-contained foundation for the Loomspan companion feasibility POC (Gate 1). This ticket provides the repository scaffold and the Postgres grocery-list fixture only. Status: scaffold and fixture files are present in this repository; Supabase dashboard preflight was developer-verified on 2026-10-27 (see table below), and the from-empty local Postgres fixture proof passed the same day (migration, seed, assertions, plus a second seed/assertions run for idempotency, all exit 0).

Existing Supabase project (do not replace): Loomspan Testing at `https://yjrwyfkybszlpufsflan.supabase.co`.

## Progress and handoff (2026-10-27)

Read this section first when resuming. Everything below it is the supporting evidence and recreation detail.

| Ticket | Status | Evidence |
| --- | --- | --- |
| 1 — Foundation, Supabase preflight, grocery fixture (`ai/thoughts/tickets/2026-10-27-01-*.md`) | Done. All acceptance criteria checked in the ticket. | Preflight table below; from-empty local Postgres proof (migration, seed, assertions, re-seed, assertions — all exit 0); hosted migration/seed/assertions applied with no errors; test owner and non-member created, placeholder membership replaced (1 row). |
| 2 — MCP server Gate 1 tools (`ai/thoughts/tickets/2026-10-27-02-*.md`) | Verified locally and hosted, except two formal hosted proofs carried into ticket 4 (see below). | Node suites 17/17; Deno core tests 7/7; function `mcp` deployed ACTIVE v1; unauthenticated probe HTTP 401 with `WWW-Authenticate`; `hosted-acceptance.mjs` full run passed (results paragraph under "Hosted acceptance sequence"); 18-row tool-call log inspected; hosted grocery items cleaned back to Oats/2, Apples/4, Milk/1. |
| 3 — Web OAuth onboarding + consent (`ai/thoughts/tickets/2026-10-27-03-*.md`) | Complete. All acceptance criteria checked in the ticket. | Pages and consent logic under `poc/web/`; 30/30 safe Node tests pass (2026-10-27, after the `supabase-js` pin fix); local `/poc/` smoke (L1) 200/200/200; live gates L2, L3 (approval), and L4 (denial) PASSED on 2026-10-27 (see "Web OAuth onboarding and consent (Ticket 3)" below). |
| 4 — Gate 1 run + evidence (`ai/thoughts/tickets/2026-10-27-04-*.md`) | Run materials prepared 2026-10-28; both surfaces **not-run**, Gate 1 decision **pending / not-run**. No Gate 1 verdict exists yet. | Version-2 artifact in `poc/fixtures/grocery-list-v2-update.sql`; runbook below ("Gate 1 runbook (Ticket 4)"); blank worksheets in `poc/fixtures/gate1-worksheet-muse.md` and `poc/fixtures/gate1-worksheet-chatgpt-web.md`. Human runs of G1.1–G1.7 on Muse and ChatGPT web are still required. |
| 5 — Magic login + Cloud internal accounts (`ai/thoughts/tickets/2026-10-30-poc-magic-login-cloud-accounts.md`) | Local implementation complete 2026-10-30; live deployment and live flows **NOT RUN** (no designated mailbox or dashboard access in the execution environment). | Email-code consent sign-in, `poc_accounts` migration, account-ID authorization; local Node/Deno/SQL/race evidence below ("Magic login and Cloud accounts (this ticket)"). Hosted steps remain developer-performed. |

Carried into ticket 4 (deliberately not claimed here): (a) the hosted DB-only definition update adding `remove_item`, proven locally by the Deno core test with a fake repository but not yet against hosted Postgres (ticket 4, G1.6); (b) the formal previous-`app_version`-after-a-real-version-bump probe, covered locally and by a hosted wrong-version probe but not by an actual hosted bump (ticket 4, G1.7). These two criteria stay unchecked in ticket 2 until then.

Environment state for resuming: the developer is logged in to the Supabase CLI (`npx supabase`, v2.122.0) and the project is linked from `poc/mcp-server` (CLI state under `supabase/.temp/`, git-ignored — re-run `npx supabase link --project-ref yjrwyfkybszlpufsflan` if missing). Docker Desktop's service was started for the local Postgres proof and left running; the throwaway `loomspan-poc-pg` container was removed. Never run `supabase config push` (see "Hosted deploy"). No credential, token, password, or key value is recorded anywhere in this repository; hosted re-verification uses the email-code consent flow (see "Test owner setup"); the designated owner mailbox is supplied only through the execution environment and never recorded here.

## Supabase preflight evidence

All three items were verified in the dashboard on 2026-10-27, so acceptance criterion 1 passes. The JWT item was also corroborated against the project's public JWKS endpoint (`/auth/v1/.well-known/jwks.json`), which publishes the same ES256 public key, and the OAuth discovery document (`/.well-known/oauth-authorization-server/auth/v1`) advertises authorization, token, and dynamic client registration endpoints. Current configuration notes for later tickets: Authorization Path is `/oauth/consent` and Site URL is `http://localhost:3000`; ticket 3 changes these to the `loomspan.ai` origin and `/poc/oauth/consent` when the consent page exists. If any item later becomes unavailable, record it as `BLOCKER — authentication/integration blocker, cause unconfirmed`, stop, and escalate for a developer decision; do not design around it and do not create a replacement project.

| Item | Dashboard location | Observed state | Verified by | Date |
| --- | --- | --- | --- | --- |
| OAuth 2.1 authorization server can be enabled | Authentication > OAuth Server | Enabled. Authorization Path: `/oauth/consent`. Site URL (Authentication > URL Configuration): `http://localhost:3000` | Developer in dashboard | 2026-10-27 |
| Dynamic client registration can be turned on | Authentication > OAuth Server | Enabled (open registration: any MCP client may register) | Developer in dashboard | 2026-10-27 |
| JWT signing is asymmetric (ES256 or RS256), not HS256 | Settings > JWT Signing Keys | ECC (P-256), i.e. ES256, key id fingerprint `46ba…318f`; corroborated via the public JWKS endpoint | Developer in dashboard + JWKS fetch | 2026-10-27 |

Redaction rule: record toggle state, Authorization Path, Site URL, signing algorithm, and key id fingerprint only. Never record access or refresh tokens, client secrets, the JWT secret, anon or service-role key values, or the test owner credentials.

## Repository layout

- `poc/mcp-server/` — Supabase config, migrations, seed, tests, and the ticket-2 MCP Edge Function in `supabase/functions/mcp/` (`index.ts`, `core.ts`, `data.ts`, `core.test.ts`), plus `tests/account-race.mjs` for the local concurrency race check. The former password-grant hosted script was removed in this ticket; hosted re-verification uses `poc/web/tests/oauth-reference-flow.mjs`.
- `poc/web/` — ticket-3 static pages: `index.html` (onboarding), `oauth/consent.html` (consent), `assets/` (`poc.css`, `config.js` placeholder-only, `consent-core.mjs`, `consent.js`, `onboarding.js`), and dev-only `tests/` (not deployed). No build step.
- `poc/fixtures/expected-fixture.json` — machine-readable expectations used by the automated tests.
- `poc/README.md` — this file.

Nothing POC-related is added at the project root. The sole root addition is `.gitignore` (repository hygiene protecting against accidental secret commits).

## Local fixture setup

Automated verification uses a throwaway local Docker Postgres only. It never contacts the hosted project.

```powershell
docker run --name loomspan-poc-pg -e POSTGRES_PASSWORD=poc-local-only -p 54329:5432 -d postgres:16
# Wait until Postgres accepts connections; the first psql below fails if run before the server is ready (notably when the image is already cached).
do { docker exec loomspan-poc-pg pg_isready -U postgres; $ready = ($LASTEXITCODE -eq 0); if (-not $ready) { Start-Sleep -Seconds 1 } } while (-not $ready)
Get-Content poc/mcp-server/supabase/migrations/20261027000001_poc_fixture_schema.sql | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1
Get-Content poc/mcp-server/supabase/migrations/20261030000001_poc_accounts.sql | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1
Get-Content poc/mcp-server/supabase/seed.sql | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1
Get-Content poc/mcp-server/tests/fixture.assertions.sql | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1
# Re-run the seed once to prove idempotency, then re-run the assertions.
Get-Content poc/mcp-server/supabase/seed.sql | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1
Get-Content poc/mcp-server/tests/fixture.assertions.sql | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1
# Concurrency race: 16 parallel duplicate first resolutions, one account.
node poc/mcp-server/tests/account-race.mjs
docker rm -f loomspan-poc-pg
node --test poc/mcp-server/tests/structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs
```

`poc-local-only` is a throwaway container-only password for the local Docker container; it is not a real credential. Applying the migration and seed to the hosted Loomspan Testing project is a developer-run step (Supabase CLI or dashboard SQL editor) with no connection string or key printed here.

## Test owner setup (dashboard)

Superseded for sign-in by this ticket (2026-10-30): the owner is no longer a synthetic user created in the dashboard. The developer designates one real, code-receiving mailbox as the POC owner; its address is supplied only through the execution environment and is never written into this repository, its evidence, or any transcript stored here. The placeholder membership UUID `00000000-0000-4000-8000-000000000001` in `seed.sql` is a placeholder account ID, not an identity.

Procedure (developer-performed, live steps NOT RUN on 2026-10-30 — no designated mailbox or dashboard access was present in the execution environment):

1. Dashboard only (never `supabase config push`): confirm the email provider is enabled, new-user sign-up is allowed, the Magic Link template delivers the 6-digit code (it contains the token placeholder), OTP length is 6, and expiry/rate limits stay at Supabase defaults. Record before/after setting names and states only.
2. Apply the migrations to the hosted project from `poc/mcp-server` with `npx supabase db push`, deploy the function with `npx supabase functions deploy mcp`, and deploy the consent page through the separate site repository (see the Ticket 3 deployment runbook).
3. The designated owner signs in through the live reference flow (`node poc/web/tests/oauth-reference-flow.mjs`) and completes an authenticated `list_apps`. This creates the owner account; an empty result at this point is expected.
4. In the dashboard SQL editor only, type the designated mailbox (trimmed and lowercased) into this carry-over statement — never into this repository:

```sql
BEGIN;
INSERT INTO poc_app_memberships (app_id, account_id, role)
SELECT 'grocery-list', id, 'owner' FROM poc_accounts
WHERE normalized_email = '<designated-owner-email>'
ON CONFLICT (app_id, account_id) DO NOTHING;
-- Verify exactly one grocery-list membership row exists and its
-- account_id is present in poc_accounts before the delete below.
DELETE FROM poc_app_memberships
WHERE app_id = 'grocery-list'
  AND account_id NOT IN (SELECT id FROM poc_accounts);
COMMIT;
```

5. Verify counts only: exactly 1 `grocery-list` membership row, its `account_id` present in `poc_accounts`, grocery items still Oats/2, Apples/4, Milk/1. Re-run the owner reference flow; `list_apps` must now return `grocery-list`. A second controlled mailbox is exercised with `node poc/web/tests/oauth-reference-flow.mjs --expect-nonmember`.

## Definition effect update for an already-seeded hosted database

Fresh seeds need no update: `seed.sql` already carries the v1 `effect` descriptors. Run the statement below only if the hosted project was seeded before ticket 2 (the seed is `ON CONFLICT DO NOTHING`, so re-running it will not add `effect` to an existing row). Raw arguments and tokens are never part of this statement.

```sql
UPDATE poc_app_definitions SET definition = '{"operations":[{"name":"list_items","kind":"read","description":"Returns items in insertion order (ascending id).","arguments":[],"effect":{"action":"list","resource":"grocery_items","order":[{"field":"id","direction":"asc"}]}},{"name":"add_item","kind":"write","description":"Adds one item after validation.","arguments":[{"name":"name","type":"string","required":true,"min_length":1,"trim":true},{"name":"quantity","type":"integer","required":true,"minimum":1}],"effect":{"action":"insert","resource":"grocery_items","fields":["name","quantity"]}}]}'::jsonb WHERE app_id = 'grocery-list' AND version = 1;
SELECT definition FROM poc_app_definitions WHERE app_id = 'grocery-list' AND version = 1;
```

## MCP server (Ticket 2): local serve, deploy, and hosted verification

One self-built MCP Edge Function in `poc/mcp-server/supabase/functions/mcp/` serves exactly `list_apps`, `get_pack`, and `call_operation` over Streamable HTTP. Hosted endpoint: `https://yjrwyfkybszlpufsflan.supabase.co/functions/v1/mcp`. Operation execution is driven by the stored definition's `effect` descriptors, so a database-only definition update (for example adding a delete operation in ticket 4) needs no function code change and no redeploy.

Prerequisites: Deno, Supabase CLI 2.117.0 or later, Docker, Node 20 or later. None of the hosted steps below is automated; tokens are held only in shell environment variables and are never committed, logged, or recorded here.

### Local run

```powershell
cd poc/mcp-server
supabase start
supabase functions serve mcp
# Endpoint: http://127.0.0.1:54321/functions/v1/mcp
```

Unauthenticated probe (expect HTTP 401 with a `WWW-Authenticate` header):

```powershell
curl.exe -i -X POST 'http://127.0.0.1:54321/functions/v1/mcp' -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}'
```

### Hosted deploy (developer-performed)

First complete the preflight table above (or record the blocker and stop), apply the migration and seed to the hosted project, run the definition effect update above if the hosted database was already seeded, and follow "Test owner setup" for the designated-owner carry-over and the second-mailbox non-member checks. (Superseded note: the earlier synthetic-user creation procedure no longer applies.)

```powershell
cd poc/mcp-server
supabase link --project-ref yjrwyfkybszlpufsflan
supabase functions deploy mcp
```

Do not run `supabase config push` for this POC: the local `config.toml` is intentionally minimal (project id and the `mcp` function's `verify_jwt = false`, which the deploy applies), and pushing it would overwrite the dashboard-managed Auth settings (OAuth server, Site URL) verified in the preflight. Deployment on 2026-10-27 used this sequence: `mcp` function ACTIVE, version 1, and an unauthenticated probe returned HTTP 401 with a `WWW-Authenticate` protected-resource header.

### Direct-token acquisition (developer-performed) — superseded

Superseded by this ticket (2026-10-30): the password-grant hosted script has been removed and tokens are obtained only through the real consent path. Use `node poc/web/tests/oauth-reference-flow.mjs` (owner approval plus grocery exercise), `node poc/web/tests/oauth-reference-flow.mjs --deny` (denial), and `node poc/web/tests/oauth-reference-flow.mjs --expect-nonmember` (second mailbox). Never paste a token or code value into this repository, a log, or a chat transcript. The dated Ticket 2 hosted results below are historical evidence from the earlier flow and are not re-scored.

### Hosted acceptance sequence (developer-performed, record redacted results)

1. Owner `list_apps` returns the grocery summary without instructions; an unauthenticated call returns 401.
2. `get_pack` returns the Build, Run, and grocery packs by ID; only the grocery pack carries operation/argument definitions.
3. Owner lists items in insertion order, adds an item, and sees it persist in a later list.
4. An add with an empty name or invalid quantity mutates nothing and returns actionable guidance.
5. After a scratch version bump, a call carrying the previous `app_version` mutates nothing and returns `stale_version` with the current version and reload guidance; restore the version afterwards.
6. A signed-in non-member cannot list or mutate grocery items.
7. Inspect `poc_tool_call_log` for entries covering the calls above and confirm no credential or token value is stored.

Record only dates, status codes, `error_code` values, and log row counts. Companion OAuth/consent proof is ticket 3; Gate 1 scoring (G1.1-G1.7) is ticket 4.

Results recorded 2026-10-27 (`hosted-acceptance.mjs`, one full run; every assertion passed): unauthenticated `tools/call` rejected with HTTP 401; owner `list_apps` returned only the grocery summary; `get_pack` returned Build, Run, and grocery packs with operations only on the grocery pack; owner listed items in insertion order, added an item, and saw it persist; three invalid adds (empty name, quantity 0, quantity 1.5) returned `invalid_arguments` and mutated nothing; a wrong-version write returned `stale_version` with the current version and mutated nothing (the formal previous-version-after-a-bump probe is ticket 4, G1.7); the non-member got an empty `list_apps`, `not_member` from the grocery `get_pack`, and `not_member` from both `call_operation` attempts. The tool-call log held 18 rows for the run — `add_item` ok 1 / `invalid_arguments` 3 / `not_member` 1 / `stale_version` 1, `get_pack` ok 3 / `not_member` 1, `list_apps` ok 2 / `unauthenticated` 1, `list_items` ok 4 / `not_member` 1 — and the log table has no credential or token columns (schema-checked). A DB-only definition update adding `remove_item` on the hosted project was not run here; it is covered locally by the Deno core tests and formally in ticket 4 (G1.6).

## Web OAuth onboarding and consent (Ticket 3)

Status on 2026-10-27: complete. Local implementation, L2 live-route proof, L3 live approval proof, and L4 live denial proof all PASSED (see below); all ticket-3 acceptance criteria are checked. One live OAuth failure was encountered, root-caused, fixed, and redeployed (see "Live failure record" below). Recorded live-gate state:

- Supabase Auth values: pre-change (for reversibility, from the preflight table above) Site URL `http://localhost:3000`, Authorization Path `/oauth/consent`. Developer confirmed on 2026-10-27 that they are now set to Site URL = `https://loomspan.ai` (Authentication > URL Configuration) and Authorization Path = `/poc/oauth/consent` (Authentication > OAuth Server), dashboard only, never `supabase config push`. (Developer attestation; the consent flow itself is proven only by L3/L4.)
- L2 live-route proof PASSED on 2026-10-27 (independent fetch): `https://loomspan.ai/poc/` HTTP 200 with the onboarding page (Muse + ChatGPT steps, server URL, entry prompt); `https://loomspan.ai/poc/oauth/consent` HTTP 200 with the consent page (not a main-site fallback or redirect); `https://loomspan.ai/` returns the distinct main site; `https://loomspan.ai/poc/assets/config.js` HTTP 200 with the `__LOOMSPAN_ANON_KEY__` placeholder absent and only the public publishable key present (value not recorded here). Extensionless `/poc/oauth/consent` serving confirms plan D5 on this host, so no `consent/index.html` fallback is needed.
- `supabase-js` delivery (plan D1): pinned CDN ES module `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.78.0/+esm`, imported in `poc/web/assets/consent.js`. Version 2.78.0 was verified by fetching its bundled `auth-js` module, which contains `getAuthorizationDetails`, `approveAuthorization`, and `denyAuthorization` (3 occurrences each); the previously pinned 2.57.4 bundle (via `auth-js` 2.71.1) contains none of them — see the live-failure record below. If that import fails in the browser, the consent page shows a load error (8-second module watchdog in `oauth/consent.html`).
- Anon key handling (plan D3, adapted): `poc/web/assets/config.js` is committed with placeholder `__LOOMSPAN_ANON_KEY__` only. The committed global is named `LOOMSPAN_ANON_KEY` (not the plan's draft `LOOMSPAN_SUPABASE_ANON_KEY`) because the existing secret-scan suite rejects any non-empty assignment to that variable name; the placeholder design is unchanged. The real public anon/publishable key value is never committed here.
- Companion click-paths (plan D9): the exact muse.ai and ChatGPT web menu labels remain developer-unverified; the onboarding page states this honestly and gives the verified-generic instruction (add a custom/remote MCP connection with the server URL, sign in, approve). No workaround is currently recorded.
- Site repository confirmed by the developer on 2026-10-27: `C:\opendev\code\loomspan-website` (`loomspan/loomspan-website`, plain static site, `public/` asset directory, no build step, no `_redirects`/SPA fallback, hosted per its README on Cloudflare Workers static assets; `public/_headers` carries no rewrite/fallback rule). On 2026-10-27 the deployable files were copied into `public/poc/` (`index.html`, `oauth/consent.html`, `assets/{config.js,consent-core.mjs,consent.js,onboarding.js,poc.css}` — 7 files, SHA-256 verified byte-identical to `poc/web/`; `poc/web/tests/` was not copied). Deployed-output scan of the copied tree found no `service_role`, private-key, or JWT-shaped material. Update 2026-10-27: the developer reports the copy is deployed live with the public key injected (independently corroborated by the L2 proof above: placeholder absent at the live `config.js` URL, extensionless consent route serves the page, so plan D5 holds and no `consent/index.html` fallback is needed). Whether the site-repo copy was committed/pushed or deployed another way was not inspected from this repository.

### Local verification (run 2026-10-27)

- Failing-test-first: `node --test poc/web/tests/consent-core.test.mjs poc/web/tests/web-structure.test.mjs` failed before implementation with missing `poc/web/assets/*`/page files, while the pre-existing suites were green at that tree (17/17 per research).
- Focused/full safe suite: `node --test poc/mcp-server/tests/mcp-structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs poc/mcp-server/tests/structure.test.mjs poc/web/tests/consent-core.test.mjs poc/web/tests/web-structure.test.mjs` — 30/30 pass (17 pre-existing as updated + 13 new, including the missing-`auth.oauth` regression test). No test contacts a live service or reads credentials.
- L1 local base-path smoke: start `node poc/web/tests/serve.mjs`, then `curl.exe --noproxy "*" -s -o NUL -w "%{http_code}" http://127.0.0.1:4173/poc/`, `http://127.0.0.1:4173/poc/oauth/consent`, and `http://127.0.0.1:4173/poc/assets/config.js` — all HTTP 200; the consent body contains `id="consent-details"`; an unknown `/poc/` path returns 404. (In the sandbox, listening required an escalated shell — `listen EACCES` under the managed sandbox — and `--noproxy "*"` because a proxy env var otherwise intercepts localhost. HTTP success proves reachability only, not browser-rendered behaviour.)

### Developer runbook: dashboard, deployment, and live proof (L2–L4, completed 2026-10-27)

1. Supabase dashboard (Loomspan Testing): set Site URL to `https://loomspan.ai` (Authentication > URL Configuration) and Authorization Path to `/poc/oauth/consent` (Authentication > OAuth Server). Never run `supabase config push`. Record the date above.
2. Confirm the `loomspan.ai` site repository (candidate above). Copy only `poc/web/index.html`, `poc/web/oauth/`, and `poc/web/assets/` (never `poc/web/tests/`) into its `/poc/` location (`public/poc/` in the candidate repo). In the **copied** `assets/config.js` only, replace `__LOOMSPAN_ANON_KEY__` with the public anon/publishable key from the dashboard (Authentication > API Keys); never commit that value in this repository, and never copy any service-role material.
3. Deployed-output scan (plan D6) before pushing: scan the copied tree for JWT-shaped strings other than the intended public key in `config.js`, `service_role`, private-key headers, and `SUPABASE_SERVICE_ROLE_KEY`; assert the placeholder is absent. Record pass/fail and file names only, never key material. Commit and push in the site repository and wait for its deploy to succeed.
4. L2 live route proof: `curl.exe -s -i https://loomspan.ai/poc/` (expect 200, title "Connect Loomspan (POC)", MCP server URL), `curl.exe -s -i https://loomspan.ai/poc/oauth/consent` (expect 200, no `Location` redirect, `id="consent-details"`), `curl.exe -s https://loomspan.ai/` (main-site comparison — POC bodies must differ), and `curl.exe -s https://loomspan.ai/poc/assets/config.js` (placeholder absent, no service-role pattern).
5. L3 approval: `node poc/web/tests/oauth-reference-flow.mjs` — open the printed authorize URL, sign in on the deployed consent page with the email code sent to your mailbox if prompted, confirm the page shows client `loomspan-poc-reference` and scopes `openid email profile` **before** approving, then Approve. Success is script exit 0 (`list_apps` ok with only `grocery-list`). A second run that shows no decision is recorded as "previously consented — auto-approved", not as a second decision pass.
6. L4 denial: `node poc/web/tests/oauth-reference-flow.mjs --deny` — click Deny. Success is script exit 0: `error=access_denied`, no code, no token exchange, unauthenticated `list_apps` HTTP 401.
7. On any failure at discovery, registration, sign-in, consent, or token exchange: record the step, HTTP status and `error`/`error_code` values only, and the classification "authentication/integration failure — cause unconfirmed", plus any workaround and its added user burden (with the matching onboarding step updated in the same change).

### Live failure record (Ticket 3)

- Step: `consent` (load authorization details after sign-in, on the deployed consent page opened with an authorization request).
- Redacted evidence: the page displayed only the error message `Cannot read properties of undefined (reading 'getAuthorizationDetails')`. No authorization identifier, credential, code, or token is recorded.
- Classification: initially an authentication/integration failure with cause unconfirmed; now root-caused — the previously pinned `supabase-js` 2.57.4 CDN bundle does not contain the `auth.oauth` consent APIs (`getAuthorizationDetails`/`approveAuthorization`/`denyAuthorization` are absent from its bundled `auth-js` 2.71.1 and present from `supabase-js` 2.78.0, verified by fetching both pinned bundles). The consent core also surfaced the raw `TypeError` message to the page; it now fails closed with a friendly, non-raw message when the OAuth namespace is missing.
- Fix: `poc/web/assets/consent.js` now pins `supabase-js@2.78.0`, and `poc/web/assets/consent-core.mjs` guards a missing `auth.oauth` namespace. Orchestrator copied both fixed files to `C:\opendev\code\loomspan-website\public\poc\assets\` on 2026-10-27 (SHA-256 byte-identical to source; the deployed copy of `assets/config.js` with the injected public key was not touched).
- Workaround / user burden: there is no user workaround. The developer redeployed the site with the fixed `consent.js`/`consent-core.mjs`, then reran L3 (approval) and L4 (denial); both PASSED (see Resolution evidence below).
- Resolution evidence (2026-10-27): after redeploy, L3 approval PASSED — `node poc/web/tests/oauth-reference-flow.mjs` printed PASS for discovery (authorization/token/registration endpoints present), dynamic client registration (HTTP 201), callback (code received, state matched), token exchange (bearer token received, `expires_in=3600`), and authenticated `list_apps` (`ok=true`, `app_ids=[grocery-list]`, summary only), ending `DONE: approval reference flow passed.` The transcript the developer supplied also contained the authorize URL; its client identifier and state values are not recorded here (state was consumed by the completed run). L4 denial PASSED on 2026-10-27 as well — `node poc/web/tests/oauth-reference-flow.mjs --deny` printed PASS for discovery, dynamic client registration (HTTP 201), denial (`error=access_denied`, no code, no token exchange attempted), and unauthenticated `list_apps` returning HTTP 401, ending `DONE: denial reference flow passed.` As with L3, the supplied transcript's authorize URL values are not recorded here.

## Magic login and Cloud accounts (this ticket, 2026-10-30)

Local implementation is complete; every live step is **NOT RUN** because no developer-designated mailbox, dashboard session, or hosted credential was present in the execution environment. No mailbox address, code, token, or key value is recorded here.

- Sign-in: the consent page offers only the email-code flow (enter email, receive a 6-digit code, enter it on the same page in the same tab). There is no password sign-in, no provider button, and no clickable-link-only flow. A wrong or expired code signs nobody in and neither approves nor denies the pending request; retry and resend stay available.
- Accounts: the MCP function reads only the verified token email, normalizes it by trimming surrounding whitespace and lowercasing (plus-tags and dots stay significant), and resolves it to a permanent internal account ID in `poc_accounts`, creating the account atomically on first resolution. All three tools authorize by that account ID. No tool accepts an email parameter, and an email inside tool arguments is never identity evidence. Unconfirmed or missing email fails closed as unauthenticated; an account-resolution failure returns `internal_error`.
- Phase 0 bundle check (2026-10-30): the pinned `supabase-js@2.78.0` bundle's auth module contains both the code-request and code-verify methods (boolean result only; bundle content not recorded). Hosted Auth settings were NOT read or changed (dashboard only).
- Local verification (2026-10-30): full Node suite and Deno suite pass (counts in the Step Report for this ticket); the local Docker Postgres proof (both migrations, seed, assertions, re-seed, assertions) passes with the grocery fixture unchanged (Oats/2, Apples/4, Milk/1); the 16-way concurrent first-resolution race returns one account ID and leaves one row. The separate site repository layout was inspected read-only (7 deployed files); no site deployment was performed.
- Live steps NOT RUN, with reason: dashboard OTP end-state read/set, hosted pre/post counts, `npx supabase db push`, `npx supabase functions deploy mcp`, consent-page deployment through the site repository, owner carry-over, and all live reference/Codex/second-mailbox/wrong-code/expired-code/case-whitespace/plus-tag runs. Each requires dashboard access, the deployed stack, or a developer-designated mailbox that was not available here. They remain developer-performed using "Test owner setup" and the reference-flow modes above, recording dates, outcomes, counts, and error codes only.

## Scope boundaries (unchanged)

- Ticket 1 created the scaffold, schema, seed, packs, and log table; the MCP server, operation executor, and tool-call log writer are ticket 2 (see "MCP server (Ticket 2)" above).
- Web onboarding/consent pages are ticket 3 (complete above; live deployment and approval/denial OAuth proof PASSED on 2026-10-27).
- No Gate 2 tools or apps, participant identity, billing, invitations, or production schema design (Gate 2). The Gate 1 run materials (version-2 update, runbook, worksheets) are ticket 4, below; the human Gate 1 runs themselves have not happened yet.
- Only synthetic grocery data is used.

## Gate 1 runbook (Ticket 4)

Status on 2026-10-28: run materials are prepared; **neither surface has been run by a human tester**. Muse and ChatGPT web are both recorded as `not-run` in their worksheets, and the Gate 1 exit decision is **pending / not-run** (see "Gate 1 exit decision" below). A surface no human has actually run is never recorded as passed.

Materials:

- Version-2 fixture update artifact: `poc/fixtures/grocery-list-v2-update.sql` — a DB-definition-only update that adds `remove_item` to the grocery app and bumps it from version 1 to version 2. Applying it changes no Edge Function code and requires no Edge Function redeploy, no companion reconnect, and no tool change (`call_operation` reads definitions from `poc_app_definitions`).
- Blank results worksheets (complete one per surface per run): `poc/fixtures/gate1-worksheet-muse.md` and `poc/fixtures/gate1-worksheet-chatgpt-web.md`. They carry every Results-worksheet field from `ai/thoughts/plans/proof_of_concept.md`, the G1.1–G1.7 scores, the pack-delivery scoring, and the blocker classification.

### Before either surface runs

1. Hosted fixture is at version 1: confirm `SELECT current_version FROM poc_apps WHERE id = 'grocery-list';` returns `1` and the grocery items are the seeded Oats/2, Apples/4, Milk/1 (restore that state first if a previous run changed it; record any reset in the worksheet).
2. The tester starts from a clean state on the surface: remove any prior Loomspan setup/connection, start a fresh conversation, and disable memory/project guidance where possible. Record any context that cannot be cleared in the worksheet's "Setup prerequisites and initial state" field.
3. The tester supplies only the onboarding URL (`https://loomspan.ai/poc/`) for cold setup. Do not pre-connect the companion, pre-paste pack text, or hand the tester the MCP server URL separately — the onboarding page carries it.
4. Start a timer at the first tester action. Record product/model version, account plan, workspace policy, and available tools in the worksheet.

### Evidence capture (per surface, per run)

Capture all three kinds of evidence, redacted, and record their locations in the worksheet. Never store credentials, tokens, authorization codes, passwords, or key values anywhere in the repository or the evidence.

- **Transcript:** export or copy the full companion conversation for each conversation used (G1.1–G1.4, the fresh G1.5 conversation, G1.6/G1.7). Before storing, remove any token, code, password, or key value; if the companion displays one, replace it with `[REDACTED]` and note the redaction.
- **Tool-call traces:** record each MCP tool call as seen by the companion (tool name, app ID, operation, `app_version`, environment, and the `ok`/`error_code` result), plus the matching server-side log rows from `poc_tool_call_log` (query below). Raw arguments that could contain secrets are not stored; grocery item names/quantities in this synthetic fixture are not secrets.
- **Server-side state:** before G1.1, after G1.3, after G1.5, and after G1.7, record the grocery state with the read-only queries below (item names/quantities, app version, and tool-call log row counts by operation/outcome/`error_code` only).

```sql
SELECT id, name, quantity FROM poc_grocery_items WHERE app_id = 'grocery-list' ORDER BY id;
SELECT current_version FROM poc_apps WHERE id = 'grocery-list';
SELECT operation, app_version, outcome, error_code, count(*) FROM poc_tool_call_log GROUP BY operation, app_version, outcome, error_code ORDER BY operation, app_version;
```

### Per-surface sequence (run identically on Muse, then ChatGPT web)

Run the surfaces one at a time, each from the clean state above, filling in that surface's worksheet as you go. Exact prompts the tester types are quoted; type them verbatim. Steps that only the operator performs (the version-2 update) are marked OPERATOR.

**G1.1 Cold setup.** Give the tester only the onboarding URL and type:

> Please connect to Loomspan using the instructions at https://loomspan.ai/poc/ and then confirm you can make an authenticated Loomspan tool call.

Record every click, consent, URL copy, configuration edit, restart, and troubleshooting step, with the elapsed duration. Confirm an authenticated tool call succeeded (a successful `list_apps` or equivalent, corroborated by an `ok` row in `poc_tool_call_log`). Thresholds: target 10 minutes total, with no user-authored code, no hand-edited JSON/TOML, and no secrets pasted into chat; normal account login, consent, and connector URL entry are acceptable steps to measure. If setup fails, make one documented attempt and one targeted correction, then stop and record the unresolved blocker (dual-classified, see below) instead of spending further.

**G1.2 Pack delivery.** Type:

> Get the Loomspan Run pack and the Loomspan Build pack. Then open my grocery-list app and load its app pack. For each pack, tell me whether it is natively installed, loaded only for this conversation, or needed a manual workaround.

Score each pack (Build, Run, grocery-list app) separately as exactly one of: persistent native installation, instructions loaded for the current conversation (session load), repeatable loading in a fresh conversation, or manual workaround (record the added burden; never count it as automatic delivery). Record who installed/loaded it and which host capability did so. Retrieving the Build pack alone is not Build workflow support.

**G1.3 Select and use.** Type:

> Use Loomspan. List my apps, show the grocery-list summary, load the grocery-list pack, use the production environment, show my grocery list, and add Bread with quantity 2.

Required: explicit Loomspan selection, the grocery summary from `list_apps`, the app pack loaded via `get_pack`, production as the default environment, one read (`list_items`) and one write (`add_item`) through `call_operation`. Record latency, manual interventions, and any wrong-app/wrong-environment call.

**G1.4 Prove pack use.** Type, in order:

> Show my grocery list.

> Add Cheese to my grocery list.

Pass requires behavior that depends only on pack rules: the list is presented alphabetically with a count header (the server returns insertion order, so this ordering comes from the pack), and for Cheese — where no quantity was given — the companion asks for a quantity instead of inventing one. Merely returning pack text is not a pass. If the companion invents a quantity, record the write it attempted and correct the fixture state afterwards, noting the correction.

**G1.5 Fresh conversation.** Close the chat, start a new conversation on the same surface, and type:

> Use Loomspan. Open my grocery-list app, show my grocery list, and add Eggs with quantity 6.

Required: prior data persists (Bread from G1.3 is present), current instructions load without the old transcript, manual pasting, rejoining, or per-app connector setup, and the write succeeds. Score the fresh-chat pack outcome here (repeatable loading vs manual workaround). Target: one explicit Loomspan selection and one app request.

**G1.6 Newly added operation.** Keep two conversations distinct from here on: conversation A is the original G1.1–G1.4 conversation, and conversation B is the fresh G1.5 conversation. Leave conversation B untouched (do not send it any further message) so it still holds the version-1 pack for G1.7. OPERATOR (not in either companion conversation): apply `poc/fixtures/grocery-list-v2-update.sql` to the hosted project through the dashboard SQL editor, then run its post-apply verification queries (app and pack at version 2; version-2 definition lists `list_items`, `add_item`, `remove_item`). No Edge Function redeploy, no companion reconnect, no tool change. Then, in conversation A only, type:

> Use Loomspan. Load the current grocery-list pack and remove Milk from my grocery list.

Required: the companion retrieves the updated pack via `get_pack` and invokes `remove_item` through the unchanged `call_operation` tool; Milk is gone from the server-side state. Score G1.6 separately from G1.7.

**G1.7 Stale version (basic).** Score separately from G1.6. Return to conversation B, which still holds the version-1 pack from before the bump because G1.6 was run in conversation A, and without telling the companion to reload first, type:

> Add Pears to my grocery list with quantity 3, using the app version you already have loaded.

The stale call must use `add_item`, an operation the version-1 pack already knows; do not ask for `remove_item` here, because a companion holding only the version-1 pack has never been told that operation exists. Required tool-log evidence, in order: (1) a `call_operation` for `add_item` carrying `app_version` 1 after the bump, rejected before mutation with `error_code` `stale_version` and `current_version` 2 (Pears absent from server state at that point, corroborated by the rejected log row); (2) a `get_pack` call; (3) exactly one retry with `app_version` 2 that completes the request, so the whole G1.7 request causes exactly one write (Pears added once). Count writes in `poc_tool_call_log` and the item state; a duplicate add or an extra write fails the "exactly one write" requirement. If the companion reloads the pack before any version-1 call, record G1.7 as not-observed with that reason rather than passed — the stale call must actually occur.

### Between surfaces: restore the version-1 fixture (OPERATOR)

Run this reset after the first surface finishes and before the second surface starts (and before any repeat run), so every surface starts G1.1–G1.5 against the identical version-1 fixture. Re-running `seed.sql` alone does not reset a bumped fixture (its inserts are `ON CONFLICT DO NOTHING`). Through the same dashboard SQL editor, run:

```sql
BEGIN;
DELETE FROM poc_grocery_items WHERE app_id = 'grocery-list';
INSERT INTO poc_grocery_items (app_id, name, quantity) VALUES ('grocery-list', 'Oats', 2), ('grocery-list', 'Apples', 4), ('grocery-list', 'Milk', 1);
DELETE FROM poc_app_definitions WHERE app_id = 'grocery-list' AND version = 2;
UPDATE poc_apps SET current_version = 1 WHERE id = 'grocery-list';
UPDATE poc_packs SET version = 1, instructions = 'Grocery List app guidance. When showing the list, present the items alphabetically with a count header such as "3 items" above the list. When adding an item and the quantity is not known, ask the user for a quantity instead of inventing one. Use list_items to read the list and add_item to add an item with a name and a quantity.' WHERE id = 'grocery-list';
COMMIT;
```

Then re-run the step-1 confirmation in "Before either surface runs" (app at version 1, seeded Oats/2, Apples/4, Milk/1) and record the reset in the next surface's worksheet. The reset restores fixture state only; it does not erase the previous surface's worksheet, transcripts, or `poc_tool_call_log` evidence.

### Scoring rules that apply to every step

- Pack delivery is scored honestly everywhere: native installation, session loading, repeatable fresh-chat loading, and manual workaround are different outcomes and are never merged into one "installed" claim. Persistent native installation is not required to pass if repeatable on-demand loading works.
- Classify every blocker twice: by category (account/policy eligibility, transport/authentication, host discovery, instruction delivery/adherence, persistence, generic invocation, user friction) and by root cause (fixture, provider, companion, interoperability, unknown). State every workaround and its added setup burden. An unavailable capability on a surface is an eligibility finding, not a runtime failure.
- Keep OAuth failures as cause-unconfirmed ("authentication/integration failure — cause unconfirmed") until checked against the ticket-3 reference flow (`poc/web/tests/oauth-reference-flow.mjs`).
- Do not fix fixture defects mid-run. A defect in the MCP server, schema, packs, or web pages is recorded with evidence and routed back to its owning ticket; the run resumes only after that ticket's fix. Companion-behavior findings are results, not defects to engineer around.
- Thresholds are recording requirements, not automatic verdicts: record cold-setup duration and manual steps, returning-use burden (target one explicit selection + one request), latency, manual interventions, and wrong-app/wrong-environment calls even when a threshold is missed.

### Gate 1 exit decision (recorded)

Decision: **pending / not-run** (2026-10-28). Both Gate 1 surfaces (Muse and ChatGPT web) are not-run: no human tester has run G1.1–G1.7 on either surface, so there is no worksheet evidence to cite and no go/narrow/revise/stop verdict is recorded. Recording any of the plan's four decision categories now would fabricate a result.

Evidence required to record the decision: both worksheets completed from actual runs (every field filled; G1.1–G1.7 each passed, failed, blocked, or not-run with a reason; G1.6 and G1.7 scored separately with tool-log evidence; every blocker dual-classified with workaround burden), plus the redacted transcripts, tool-call traces, and server-side state for each run. With that evidence, apply the plan's categories exactly: proceed broadly (at least two independent companion products pass, including a conversational surface for nontechnical users); proceed with narrower support (only one Gate 1 host passes); revise pack delivery (native installation fails but repeatable loading works — do not claim persistent installation); or reconsider the central experience (repeated manual copying, per-app setup, or unreliable pack following/invocation). Update both worksheets and this section in the same change that records the decision.
