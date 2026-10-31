# Loomspan Cloud — Magic Login and Cloud Accounts

## Status and scope

**Draft.** This document records the decisions settled in the login-and-cloud-accounts discussion of 2026-10-30. It is Draft until the project owner explicitly accepts it as Final. It is not an implementation or a finalized protocol/API design.

It refines [Federated Login and Cloud Accounts](008-federated-login-and-cloud-accounts.md) and the companion and invitation directions in [Companion-First Invitations](009-companion-first-invitations.md) and [Companion Connection and App Discovery](011-companion-connection-and-app-discovery.md).

One direction in document 008 is superseded for V1: users will not initially sign in through a federated identity provider. V1 sign-in is a passwordless email code ("magic login"). The rest of document 008's account model stands, in particular:

- Cloud assigns and owns a permanent internal account ID.
- App ownership, memberships, data ownership, and usage reference the internal account ID, not an email address, a Supabase Auth user ID, or any later provider-specific identifier.
- Signing in identifies the person; authorizing a companion is a separate step. A website login does not itself authorize a companion connection (document 011: one connection per companion, authorized per companion).

## 1. Primary sign-in: email code

V1 sign-in works as follows:

1. The user enters their email address on the Cloud sign-in surface. In the companion flow this surface is the OAuth consent page reached through the MCP authorization flow.
2. Supabase Auth sends a one-time 6-digit code to that address (`signInWithOtp`).
3. The user types the code back into the same sign-in surface. Successful verification establishes the Supabase session.
4. Cloud resolves or creates the Cloud account for that verified email (section 2), and the flow continues to consent/authorization as before.

Decisions behind this shape:

- **Code, not a clickable link.** The code is typed back into the same browser tab, so a pending authorization request survives sign-in. A link could open in a different browser or app and lose that context, and mail-scanning software can consume one-time links before the user clicks.
- **No pasted tokens or magic URLs in companion configuration.** A static bearer secret in an MCP URL or header has no consent, refresh, or clean revocation, leaks into transcripts and config files, and conflicts with the Gate 1 goal of no secrets pasted into chat. The companion still receives its credential only through the OAuth token exchange.
- **Mailbox possession is the verified-email evidence.** Controlling the mailbox that received the code is what proves the email for V1. Later federated providers must supply their own trusted verified-email evidence before they can resolve to an account.

## 2. Account resolution and creation

- On the first successful login for an email, Cloud creates an account and assigns its permanent internal account ID. No separate signup form exists, and Loomspan maintains no usernames or passwords.
- The matching key is the email address after trimming surrounding whitespace and lowercasing. No other normalization applies: plus-tags (`name+tag@…`) and dots are significant, so those variants are different addresses and therefore different accounts. This is deliberate — alias collapsing differs between mail systems and silently merging addresses that some systems treat as distinct would be a correctness and security risk.
- Subsequent logins with the same normalized email resolve to the same internal account, whatever entry path (website, companion connection, invitation) is used.
- The email used for matching comes only from trusted authentication evidence (the Supabase session/token). An email supplied in a companion's tool arguments is never account evidence.
- Account creation must be safe under concurrent first logins: two simultaneous first logins for the same email produce one account. This is an implementation requirement (a uniqueness guarantee on the normalized email), not an open policy question.
- The Supabase Auth user is an authentication identity mapped to the Cloud account. Resolving the authenticated caller to the internal account ID, checking app membership, and binding the authorized app/environment context remain Cloud work, as recorded in document 007 section 4. How the account ID is carried alongside authentication is an implementation decision.

## 3. Different emails, email changes, and recovery — V1 boundaries

These cases are explicitly **outside V1 behavior**, by decision rather than omission:

- **Different email, different account.** A login with a different verified email resolves to a different Cloud account. V1 has no different-email identity linking.
- **No account merging.** If two emails have each acquired their own Cloud account, V1 provides no way to merge them.
- **Email change means a new account.** If a user starts signing in with a new email address, that creates a new, empty account. Regaining the previous account is a manual support action outside any V1 flow.
- **Mailbox control is account control.** A direct consequence of email-as-key: whoever controls the mailbox can sign in as that account, including if an email address is recycled to a different person. This risk is accepted for V1 and recorded here so it is not discovered later. Any mitigation (such as re-verification challenges or account notices) is future work, not a V1 requirement.

## 4. Invitations under magic login

The invitation rules in document 009 stand (email-addressed invitations, owner-only, seven-day expiry, explicit acceptance creates registration, leaving ends membership and rejoining needs a new invitation). The following are now settled:

- **Pending invitations are surfaced after login.** After any successful login, Cloud shows the pending invitations addressed to the account's verified email — in the dashboard and through the companion — for explicit acceptance. Login never silently joins the user to invited apps (document 008 section 4).
- **Email mismatch reveals nothing about the app.** If a user opens an invitation but is signed in with a different email, Cloud says only that the signed-in email does not match the invited email and that they should sign in with the invited email. It does not reveal the app name, owner, or sharing details before eligibility is established.
- **Switching email is cheap under magic login.** Signing in with the invited email means requesting a code for that mailbox; no password or provider account is involved.

## 5. Federated login: deferred, as additional identities

Federated providers are deferred to a later stage. They are not part of V1 sign-in and are not required for the POC extension. The account model above is provider-agnostic, so adding a provider later changes no account, membership, or ownership logic.

The agreed later provider set is **Google, Microsoft, and GitHub**, chosen for reach across ordinary users (Google/Microsoft) and the developer-heavy early tester pool (GitHub). Conditions recorded with that decision:

- Each provider must supply trusted evidence that the email is verified before the login can resolve to an account by email.
- GitHub is included only on that condition: the account's primary, verified email is the matching key. A hidden email or a `…@users.noreply.github.com` address is not verified-email evidence and must fail closed with a "sign in with the invited email" outcome, not create or match an account.
- Apple is neither selected nor rejected. It is deferred because Hide My Email private-relay addresses often will not match the email an invitation was addressed to. Revisit Apple when an iOS app or consumer launch creates a concrete need.
- When federated login arrives, it arrives as additional authentication identities mapped to the same Cloud accounts under the same normalized-verified-email rule. Same-email continuity across providers (for example Google then Microsoft) is the property to test at that stage; it is not a V1 or POC-extension requirement.

## 6. Implementation defaults recorded with these decisions

These follow from the decisions above and need no further product decision:

- POC testing uses Supabase's built-in email sending with its default code expiry and rate limits, against mailboxes the tester controls. Production use requires custom SMTP and reviewed email templates; the built-in sending limits and deliverability are not production-grade.
- Supabase Auth settings continue to be managed in the dashboard only. Local configuration files must not overwrite them (the existing POC rule against `supabase config push`).
- Each companion is authorized separately through the OAuth flow; authorizing one companion does not authorize another, and sign-in alone authorizes none.
- No credential, code, or token is ever recorded in repository evidence. Test records note dates, outcomes, and error codes only.

## 7. Explicitly unresolved

- Apple as a provider (section 5).
- Account merging, different-email linking, and self-service email change/recovery flows.
- Invitation reference format, bootstrap-instruction publication, and invitation discovery API shapes (document 009 section 7).
- Companion token refresh, connection revocation, and recovery mechanics (document 011 section 6).
- Any mitigation for the recycled-email risk in section 3.

## 8. Scope contract for this record

- **In scope:** this decision record, and the POC ticket derived from it (`ai/thoughts/tickets/2026-10-30-poc-magic-login-cloud-accounts.md`).
- **Out of scope:** implementing the POC ticket, adding any federated provider, changing invitation or membership behavior beyond section 4, and resolving any item in section 7. Each of those returns as its own ticket or discussion.
- **Done means:** this document exists as Draft with every settled decision recorded, and the derived POC ticket exists with acceptance criteria. This document becomes Final only on the project owner's explicit acceptance. Implementing the ticket is a separate, later request.
