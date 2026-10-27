# Publish the POC web pages and prove the real OAuth connection end to end

## Outcome

An ordinary user starting from a public page at `https://loomspan.ai/poc/` can follow companion-specific steps and a short copyable entry prompt to connect Muse or ChatGPT web to the Loomspan MCP server, sign in, approve the request on a consent page, and complete an authenticated tool call — without pasting secrets, authoring code, or editing configuration files.

Gate 1 cannot pass on a no-auth transport smoke test, so this ticket proves the real Supabase OAuth 2.1 path (discovery, dynamic client registration, sign-in, consent, token exchange) before companions are scored.

## Requirements

- Build the static pages in this repository under `poc/web/`, served with the `/poc/` base path: an onboarding page at `https://loomspan.ai/poc/` and an OAuth consent page at `https://loomspan.ai/poc/oauth/consent`.
- Deployment to `loomspan.ai` is manual and is part of this ticket's done state: copy the static POC content into the separate Cloudflare Pages repository for `loomspan.ai`, push, and verify the live URLs. There is no automatic deployment from this repository. "Unlinked" means only that the main site does not visually link to `/poc/`; the pages are public by design and that is not access control.
- The onboarding page gives companion-specific setup steps for the two Gate 1 surfaces (Muse at muse.ai and ChatGPT web) and one short copyable entry prompt that points the user at connecting Loomspan and opening the grocery-list app. The page contains no per-app connection instructions; one connection serves all apps.
- The consent page is a small client-side app using `supabase-js` with the public anon key only. The service-role key must never appear in `poc/web/` source or in the deployed output. The page must:
  - preserve `authorization_id` through the sign-in flow;
  - load and display the authorization details (requesting client and requested access);
  - let the user approve or deny, and complete the corresponding OAuth outcome for each choice.
- Configure and document in `poc/README.md` the Supabase Auth settings this requires: Site URL set to the `https://loomspan.ai` origin and Authorization Path set to `/poc/oauth/consent`. Do not use per-commit preview origins for OAuth testing; they do not match the configured Site URL.
- Verify the main site does not intercept the POC routes: `https://loomspan.ai/poc/` and `https://loomspan.ai/poc/oauth/consent` return the POC pages, not a SPA fallback, redirect, or 404 from the main site.
- Prove the flow with a known-working client or reference flow before blaming any companion: complete OAuth discovery, dynamic client registration, sign-in, consent approval, token exchange, and then an authenticated `list_apps` call against the MCP endpoint from ticket 2.
- On any failure in discovery, registration, sign-in, consent, or token exchange, initially classify it as an authentication/integration failure with cause unconfirmed. Record the failing step with redacted evidence (no credentials or tokens) and any workaround plus its user burden. Do not silently hide a workaround in the onboarding steps.
- Approval and denial are both tested. A denied request must not result in a usable token or an authenticated tool call.

## Acceptance criteria

- [ ] `https://loomspan.ai/poc/` serves the onboarding page with Muse and ChatGPT web setup steps and the copyable entry prompt, deployed via the separate `loomspan.ai` repository.
- [ ] `https://loomspan.ai/poc/oauth/consent` serves the consent page (not a main-site fallback or redirect), built with the `/poc/` base path.
- [ ] A reference OAuth flow completes discovery, dynamic registration, sign-in, and consent approval, receives a token, and makes an authenticated `list_apps` call.
- [ ] The consent page shows the requesting client and requested access before the user decides, and `authorization_id` survives sign-in.
- [ ] A denied consent produces no authenticated tool call.
- [ ] The deployed web output and `poc/web/` source contain no service-role key, credential, or token.
- [ ] Any OAuth failure encountered is recorded with its step, redacted evidence, and classification as cause-unconfirmed until investigated; any workaround is written into the onboarding steps with its added user burden stated.

## Context

Governing plan: `ai/thoughts/plans/proof_of_concept.md` (Planned test configuration, Gate 1 G1.1). This is ticket 3 of 4 for Gate 1. It depends on `2026-10-27-poc-mcp-server-gate1-tools.md` (live MCP endpoint and tools) and on the foundation ticket's preflight evidence. The scored companion runs are the final ticket (`2026-10-27-poc-gate1-run-and-evidence.md`). Fixing MCP server or schema defects discovered here belongs to those earlier tickets, not to web-page workarounds.

## Execution profile

- **Recommended:** Full 5-Step Pipeline
- **Confidence:** high
- **Rationale:** This ticket crosses a security and authorization boundary (OAuth consent, token issuance), integrates a beta external protocol against two independent companion products, and includes a cross-repository deployment. Consent or token-handling mistakes would invalidate every Gate 1 result.
- **Reassessment triggers:** If Supabase requires consent-flow behavior materially different from the `authorization_id` flow described above, stop and record the actual required flow for a developer decision before building around it.
