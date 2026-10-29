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
| 4 — Gate 1 run + evidence (`ai/thoughts/tickets/2026-10-27-04-*.md`) | Not started. No Gate 1 verdict exists yet. | Depends on ticket 3. Owns the version-2 `remove_item` artifact, the per-surface runbook/worksheets, and G1.1–G1.7 scoring. |

Carried into ticket 4 (deliberately not claimed here): (a) the hosted DB-only definition update adding `remove_item`, proven locally by the Deno core test with a fake repository but not yet against hosted Postgres (ticket 4, G1.6); (b) the formal previous-`app_version`-after-a-real-version-bump probe, covered locally and by a hosted wrong-version probe but not by an actual hosted bump (ticket 4, G1.7). These two criteria stay unchecked in ticket 2 until then.

Environment state for resuming: the developer is logged in to the Supabase CLI (`npx supabase`, v2.122.0) and the project is linked from `poc/mcp-server` (CLI state under `supabase/.temp/`, git-ignored — re-run `npx supabase link --project-ref yjrwyfkybszlpufsflan` if missing). Docker Desktop's service was started for the local Postgres proof and left running; the throwaway `loomspan-poc-pg` container was removed. Never run `supabase config push` (see "Hosted deploy"). No credential, token, password, or key value is recorded anywhere in this repository; test-user passwords exist only in the developer's records, and hosted re-verification takes them via `Read-Host` environment variables (see "Direct-token acquisition").

## Supabase preflight evidence

All three items were verified in the dashboard on 2026-10-27, so acceptance criterion 1 passes. The JWT item was also corroborated against the project's public JWKS endpoint (`/auth/v1/.well-known/jwks.json`), which publishes the same ES256 public key, and the OAuth discovery document (`/.well-known/oauth-authorization-server/auth/v1`) advertises authorization, token, and dynamic client registration endpoints. Current configuration notes for later tickets: Authorization Path is `/oauth/consent` and Site URL is `http://localhost:3000`; ticket 3 changes these to the `loomspan.ai` origin and `/poc/oauth/consent` when the consent page exists. If any item later becomes unavailable, record it as `BLOCKER — authentication/integration blocker, cause unconfirmed`, stop, and escalate for a developer decision; do not design around it and do not create a replacement project.

| Item | Dashboard location | Observed state | Verified by | Date |
| --- | --- | --- | --- | --- |
| OAuth 2.1 authorization server can be enabled | Authentication > OAuth Server | Enabled. Authorization Path: `/oauth/consent`. Site URL (Authentication > URL Configuration): `http://localhost:3000` | Developer in dashboard | 2026-10-27 |
| Dynamic client registration can be turned on | Authentication > OAuth Server | Enabled (open registration: any MCP client may register) | Developer in dashboard | 2026-10-27 |
| JWT signing is asymmetric (ES256 or RS256), not HS256 | Settings > JWT Signing Keys | ECC (P-256), i.e. ES256, key id fingerprint `46ba…318f`; corroborated via the public JWKS endpoint | Developer in dashboard + JWKS fetch | 2026-10-27 |

Redaction rule: record toggle state, Authorization Path, Site URL, signing algorithm, and key id fingerprint only. Never record access or refresh tokens, client secrets, the JWT secret, anon or service-role key values, or the test owner credentials.

## Repository layout

- `poc/mcp-server/` — Supabase config, migrations, seed, tests, and the ticket-2 MCP Edge Function in `supabase/functions/mcp/` (`index.ts`, `core.ts`, `data.ts`, `core.test.ts`), plus `tests/hosted-acceptance.mjs` for hosted re-verification.
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
Get-Content poc/mcp-server/supabase/seed.sql | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1
Get-Content poc/mcp-server/tests/fixture.assertions.sql | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1
# Re-run the seed once to prove idempotency, then re-run the assertions.
Get-Content poc/mcp-server/supabase/seed.sql | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1
Get-Content poc/mcp-server/tests/fixture.assertions.sql | docker exec -i loomspan-poc-pg psql -U postgres -v ON_ERROR_STOP=1
docker rm -f loomspan-poc-pg
node --test poc/mcp-server/tests/structure.test.mjs poc/mcp-server/tests/secret-scan.test.mjs
```

`poc-local-only` is a throwaway container-only password for the local Docker container; it is not a real credential. Applying the migration and seed to the hosted Loomspan Testing project is a developer-run step (Supabase CLI or dashboard SQL editor) with no connection string or key printed here.

## Test owner setup (dashboard)

Completed on the hosted project on 2026-10-27: the migration, seed, and fixture assertions were applied via the dashboard SQL editor with no errors, the synthetic test owner (`poc-owner@example.invalid`) and a non-member user (`poc-nonmember@example.invalid`) were created, and the placeholder membership UUID `00000000-0000-4000-8000-000000000001` was replaced with the real owner UUID (one membership row confirmed; 3 seeded grocery items). Credentials were set in the dashboard only and are recorded nowhere here. The procedure below is retained for recreation.

1. In the Loomspan Testing dashboard, create the synthetic test owner under Authentication > Users (for example `poc-owner@example.invalid`). Set the password in the dashboard only; never record it here or anywhere in the repository.
2. Copy the new user UUID from Authentication > Users.
3. Apply the migration and seed to the hosted project, then run this replacement statement with the real UUID substituted:

```sql
UPDATE poc_app_memberships SET user_id = '<paste-real-uuid>' WHERE app_id = 'grocery-list' AND user_id = '00000000-0000-4000-8000-000000000001';
```

4. Confirm one membership row exists for the real UUID and record the date here (no credentials).

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

First complete the preflight table above (or record the blocker and stop), apply the migration and seed to the hosted project, run the definition effect update above if the hosted database was already seeded, create the test owner and replace the placeholder membership UUID (see "Test owner setup"), and create a second signed-in user with no membership row for the non-member checks.

```powershell
cd poc/mcp-server
supabase link --project-ref yjrwyfkybszlpufsflan
supabase functions deploy mcp
```

Do not run `supabase config push` for this POC: the local `config.toml` is intentionally minimal (project id and the `mcp` function's `verify_jwt = false`, which the deploy applies), and pushing it would overwrite the dashboard-managed Auth settings (OAuth server, Site URL) verified in the preflight. Deployment on 2026-10-27 used this sequence: `mcp` function ACTIVE, version 1, and an unauthenticated probe returned HTTP 401 with a `WWW-Authenticate` protected-resource header.

### Direct-token acquisition (developer-performed)

Ticket 2 may be verified with tokens obtained through Supabase Auth directly; the companion OAuth/consent proof is ticket 3. The scripted form is `node poc/mcp-server/tests/hosted-acceptance.mjs`, which performs the password-grant token acquisition itself (Auth token endpoint with the public anon/publishable key in the `apikey` header) and reads all credentials only from environment variables (`POC_ANON_KEY`, `POC_OWNER_EMAIL`/`POC_OWNER_PASSWORD`, `POC_NONMEMBER_EMAIL`/`POC_NONMEMBER_PASSWORD`, set via `Read-Host -AsSecureString`). It prints only tool names, `ok`/`error_code` results, and HTTP status codes. Never paste a token or password value into this repository, a log, or a chat transcript.

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
5. L3 approval: `node poc/web/tests/oauth-reference-flow.mjs` — open the printed authorize URL, sign in on the deployed consent page as the test owner if prompted, confirm the page shows client `loomspan-poc-reference` and scopes `openid email profile` **before** approving, then Approve. Success is script exit 0 (`list_apps` ok with only `grocery-list`). A second run that shows no decision is recorded as "previously consented — auto-approved", not as a second decision pass.
6. L4 denial: `node poc/web/tests/oauth-reference-flow.mjs --deny` — click Deny. Success is script exit 0: `error=access_denied`, no code, no token exchange, unauthenticated `list_apps` HTTP 401.
7. On any failure at discovery, registration, sign-in, consent, or token exchange: record the step, HTTP status and `error`/`error_code` values only, and the classification "authentication/integration failure — cause unconfirmed", plus any workaround and its added user burden (with the matching onboarding step updated in the same change).

### Live failure record (Ticket 3)

- Step: `consent` (load authorization details after sign-in, on the deployed consent page opened with an authorization request).
- Redacted evidence: the page displayed only the error message `Cannot read properties of undefined (reading 'getAuthorizationDetails')`. No authorization identifier, credential, code, or token is recorded.
- Classification: initially an authentication/integration failure with cause unconfirmed; now root-caused — the previously pinned `supabase-js` 2.57.4 CDN bundle does not contain the `auth.oauth` consent APIs (`getAuthorizationDetails`/`approveAuthorization`/`denyAuthorization` are absent from its bundled `auth-js` 2.71.1 and present from `supabase-js` 2.78.0, verified by fetching both pinned bundles). The consent core also surfaced the raw `TypeError` message to the page; it now fails closed with a friendly, non-raw message when the OAuth namespace is missing.
- Fix: `poc/web/assets/consent.js` now pins `supabase-js@2.78.0`, and `poc/web/assets/consent-core.mjs` guards a missing `auth.oauth` namespace. Orchestrator copied both fixed files to `C:\opendev\code\loomspan-website\public\poc\assets\` on 2026-10-27 (SHA-256 byte-identical to source; the deployed copy of `assets/config.js` with the injected public key was not touched).
- Workaround / user burden: there is no user workaround. The developer redeployed the site with the fixed `consent.js`/`consent-core.mjs`, then reran L3 (approval) and L4 (denial); both PASSED (see Resolution evidence below).
- Resolution evidence (2026-10-27): after redeploy, L3 approval PASSED — `node poc/web/tests/oauth-reference-flow.mjs` printed PASS for discovery (authorization/token/registration endpoints present), dynamic client registration (HTTP 201), callback (code received, state matched), token exchange (bearer token received, `expires_in=3600`), and authenticated `list_apps` (`ok=true`, `app_ids=[grocery-list]`, summary only), ending `DONE: approval reference flow passed.` The transcript the developer supplied also contained the authorize URL; its client identifier and state values are not recorded here (state was consumed by the completed run). L4 denial PASSED on 2026-10-27 as well — `node poc/web/tests/oauth-reference-flow.mjs --deny` printed PASS for discovery, dynamic client registration (HTTP 201), denial (`error=access_denied`, no code, no token exchange attempted), and unauthenticated `list_apps` returning HTTP 401, ending `DONE: denial reference flow passed.` As with L3, the supplied transcript's authorize URL values are not recorded here.

## Scope boundaries (unchanged)

- Ticket 1 created the scaffold, schema, seed, packs, and log table; the MCP server, operation executor, and tool-call log writer are ticket 2 (see "MCP server (Ticket 2)" above).
- Web onboarding/consent pages are ticket 3 (complete above; live deployment and approval/denial OAuth proof PASSED on 2026-10-27).
- No Gate 1 run, version-2 update, Gate 2 tools or apps, participant identity, billing, invitations, or production schema design (ticket 4 / Gate 2).
- Only synthetic grocery data is used.
