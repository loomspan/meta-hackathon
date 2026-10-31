# Extend the POC test to magic login and Cloud internal accounts

## Outcome

A tester whose only credential is access to an email mailbox can connect first a known-working reference OAuth client and then Codex to the existing Loomspan POC MCP server, sign in on the existing consent page with a one-time email code, approve the connection, and use the grocery-list app. Cloud gives that email a permanent internal account the first time it signs in, and every later sign-in with the same email — fresh conversation, fresh connection — reaches the same account and the same grocery data. A different email is a different account and has no grocery access.

Today the POC proves only password sign-in with synthetic users, and it authorizes tools by raw Supabase Auth user ID. This ticket extends that proven fixture to the login-and-account model the product will actually use, without re-scoring Gate 1 and without adding any federated provider.

## Requirements

### Sign-in on the consent page

- The existing hosted consent page at `https://loomspan.ai/poc/oauth/consent` remains the sign-in surface. When it receives an authorization request and the user has no session, it offers email-code sign-in: enter an email address, receive a one-time 6-digit code from Supabase Auth, enter the code on the same page.
- A first-time email must be able to complete this and end up signed in. There is no separate signup form, no username, and no password anywhere in the flow.
- Sign-in happens in the same browser tab as the authorization request, so the pending request is still there afterwards. After successful sign-in the page shows the requesting client and the requested access, and only then lets the user approve or deny. Denial produces no token and no authenticated tool call.
- A wrong or expired code signs nobody in, neither approves nor denies the pending authorization, and leaves the user able to retry or request a new code and still complete the flow.
- The sign-in offer is the email code only: no clickable-link-only sign-in, and no provider sign-in buttons. No code, token, or credential is pasted into the companion, rendered beyond the user's own code entry, logged, or stored as evidence. A static token or secret in an MCP URL or client header is not an acceptable substitute for this flow.
- The mailbox is the credential: whoever controls the mailbox that receives the code can sign in as that account. This is an accepted property of the design for this test; do not build mitigations for it here.

### Cloud accounts

- On the first successful sign-in for an email, the user gets exactly one Cloud account with a permanent internal account ID. By the time their first authenticated tool call completes, that account exists. Simultaneous first sign-ins for the same email still produce one account, not two.
- The matching key is the email trimmed of surrounding whitespace and lowercased, with no other rewriting: a plus-tag (`name+tag@…`) or different dots make a different address and a different account.
- The email that identifies the account comes only from the authenticated Supabase session/token. Email addresses supplied in tool arguments or companion text are never identity evidence, and no tool gains an email parameter.
- Authorization for the POC tools is by internal account ID, not by Supabase Auth user ID. A Supabase user is only the sign-in identity that resolves to the account.
- Signing in with a different email always means a different account. This work adds no account linking, no account merging, and no change-my-email flow.

### Tools and preserved fixture

- The existing tools `list_apps`, `get_pack`, and `call_operation` keep their names, inputs, outputs, and error behaviour (including `unauthenticated`, `not_member`, `stale_version`, and `invalid_arguments`); only the identity they authorize against changes, from Supabase user ID to internal account ID.
- An unauthenticated call is still rejected. A signed-in account with no grocery membership sees no grocery app in `list_apps` and gets `not_member` from grocery `get_pack` and `call_operation`. A member can list apps and items and add an item that persists.
- The existing hosted grocery fixture survives this work: the grocery-list app and its seeded items (Oats/2, Apples/4, Milk/1) are unchanged by any data migration, and no existing Gate 1 evidence is invalidated.

### Carrying the existing test owner over

- The current synthetic password users (for example `poc-owner@example.invalid`) cannot receive email codes and are not the identity source going forward.
- At execution time the developer designates one real, code-receiving mailbox as the POC owner. Its address is supplied only through the execution environment and is never written into this repository, its evidence, or any transcript stored here.
- The account resolved for that designated mailbox holds the grocery owner membership, so the owner experience — same app, same seeded data — continues under email-code sign-in. How the membership is carried onto that account is an implementation choice; losing the membership or the seeded data is not acceptable.

### Deployment and evidence

- Use the existing hosted POC Supabase project (Loomspan Testing, identified in `poc/README.md`). Do not create a replacement project. Supabase Auth and project settings are changed in the dashboard only, never by pushing local configuration.
- The finished work is live, not just local: any database change is applied to the hosted project without losing the fixture, the MCP function serving the new account resolution is the hosted one, and the changed consent page is deployed to its existing `loomspan.ai/poc/` location through that site's existing separate repository.
- Email delivery for this test uses Supabase's built-in sending with its default code lifetime and rate limits, against mailboxes the tester controls. Production SMTP is out of scope.
- `poc/README.md` is updated so its sign-in and test-owner instructions describe the email-code flow (password instructions retired or marked superseded), with redacted results: dates, outcomes, counts, and error codes only — never a mailbox address the developer designated, a code, a token, or any key.

### Scope exclusions

- No federated provider (Google, Microsoft, GitHub, Apple, or any other) is added, configured, or tested.
- No invitation creation, discovery, acceptance, or membership management beyond carrying the one existing owner membership over.
- No public signup policy change beyond first-sign-in account creation, and no account recovery flow.

## Acceptance criteria

- [ ] Live reference flow: a tester signs in with an email code on the deployed consent page, sees the requesting client and requested access before deciding, approves, and completes an authenticated `list_apps` call; repeating with denial gives no token and an unauthenticated rejection from the MCP endpoint.
- [ ] Live Codex flow: from a fresh Codex connection, the tester signs in with an email code, approves, and completes an authenticated `list_apps` call that returns the grocery-list summary for the owner account.
- [ ] First sign-in for a new email creates exactly one internal account, and concurrency is proven by an automated test or scripted check that races duplicate first resolutions and observes one account — not left as an unexercised claim.
- [ ] The developer-designated owner mailbox, signing in by email code, sees `grocery-list` in `list_apps`, sees the seeded items Oats/2, Apples/4, Milk/1, adds an item, and sees it persist in a later list.
- [ ] A second controlled mailbox signs in successfully but is a different internal account: its `list_apps` contains no grocery app, and its `get_pack` and `call_operation` against grocery-list return `not_member`.
- [ ] Identity cannot be spoofed through the tools: calls made with the non-member's token that supply the owner's email address as an argument or in companion-supplied text still authorize as the non-member, and calls with the owner's token still authorize as the owner.
- [ ] The same mailbox typed with different letter case or surrounding whitespace resolves to the same internal account; the same mailbox with a plus-tag added resolves to a different internal account.
- [ ] A wrong code and an expired code each fail to sign in, leave the pending authorization neither approved nor denied, and requesting or retrying with a correct code then completes the flow.
- [ ] Existing automated suites for the MCP server and web pages pass, including coverage of first-login account creation, same-email reuse, case/whitespace matching, and different-email separation; the secret scan passes, and neither the consent page nor the repository contains password sign-in any longer.
- [ ] The deployed consent page offers no provider sign-in, account-linking, account-merging, or change-email flow, and `poc/README.md` records the redacted live results with no designated mailbox address, code, token, or key value anywhere in the repository.

## Context

This is a POC ticket following tickets `2026-10-27-01-poc-foundation-supabase-fixture.md` through `2026-10-27-04-poc-gate1-run-and-evidence.md` in the same directory; those built the fixture, MCP tools, live consent page, and Gate 1 run materials this ticket extends. Ticket 4's human Gate 1 companion runs are still not-run, and nothing here scores or changes them: results from this ticket are login-and-account evidence only.

The decisions behind this ticket, settled with the developer on 2026-10-30 and also recorded in `ai/thoughts/phases/013-magic-login-and-cloud-accounts.md`: magic login (email code) is the primary V1 sign-in and federated providers are deferred — Google, Microsoft, and GitHub are the agreed later set, each only with trusted verified-email evidence (a GitHub `noreply` address must fail closed), and Apple is undecided because its private-relay addresses may not match invited emails. Email is the account key, so an email change later means a new account and old-account recovery is manual and outside this work. None of that deferred or excluded behaviour is to be built here.

Helpful current-state pointers for orientation (discoverable in research, not constraints): the sign-in form lives in `poc/web/oauth/consent.html` and `poc/web/assets/consent.js`, the MCP entry point in `poc/mcp-server/supabase/functions/mcp/index.ts`, and the fixture schema in `poc/mcp-server/supabase/migrations/`; `poc/README.md` records the hosted project, the deployed-page locations, and the dashboard-only configuration rule.

## Execution profile

- **Recommended:** Full 5-Step Pipeline
- **Confidence:** high
- **Rationale:** Intent is settled, but the work changes a security and authorization boundary (how users sign in and how tool calls are authorized), a persisted identity contract (accounts and membership now key on an internal ID, requiring a data migration on a live fixture), and an external protocol surface (OTP sign-in inside the OAuth consent flow, exercised by a real companion). Those are exactly the full-profile triggers, so research, planning, and independent review are warranted.
- **Reassessment triggers:** If email-code verification cannot be completed on the consent page without losing the pending authorization request, or Supabase's built-in email delivery cannot reach the test mailboxes, stop and return for a developer decision; do not fall back to clickable links, provider sign-in, or pasted tokens. If the affected change proves to be smaller than expected, the profile still stays full because the authorization-boundary change remains.
