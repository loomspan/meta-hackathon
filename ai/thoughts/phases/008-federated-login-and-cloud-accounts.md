# Loomspan Cloud — Federated Login and Cloud Accounts

## Status and scope

This document continues the [identity and JWT findings](007-identity-and-jwt-findings.md) and [app lifecycle discussion](006-app-lifecycle.md).

It records the agreed login and internal-account model. Invitation and account-linking decisions that remain open are listed separately. It is not a completed authentication implementation or a finalized protocol/API design.

The identity decision here supersedes the earlier assistant recommendation to use the Supabase user ID directly as Cloud's permanent account identifier. Cloud will own its internal account ID and the continuity of that account across supported federated providers.

## 1. Federated login and automatic account creation

Users sign in through a supported federated identity provider using Supabase Auth. Loomspan Cloud will not maintain its own usernames and passwords or require a separate traditional signup form.

Two initial entry scenarios were identified:

- A person connects their AI companion because they want to create an app.
- A person arrives through an invitation to an existing app.

A person may also visit the Cloud website directly. Website and companion entry paths use the same Cloud account model and federated identity system.

After successful authentication, Cloud resolves the account or creates it if none exists. Returning through another entry path should resolve the existing account rather than create a separate website or companion account.

Being invited to an app does not prevent a user from creating their own apps. Joining and creating are separate capabilities, not mutually exclusive account types.

## 2. Verified email and the permanent Cloud account ID

The agreed distinction is:

> The federated provider verifies the login. The verified email is Cloud's primary reference for matching that login to a Cloud account. Cloud assigns its own permanent internal account ID.

On the first eligible login for a verified email, Cloud creates an account with an internal ID. Subsequent supported federated logins with that same verified email resolve to the same Cloud account, even if the provider changes.

App ownership, memberships, data ownership, and usage reference the Cloud internal account ID rather than an email address or a provider-specific identifier.

For example, moving `mgiacomi@gltech.com` from Google sign-in to Microsoft sign-in should retain the same Cloud account ID when the login satisfies Cloud's supported-provider and verified-email rules.

This continuity is a Cloud responsibility. It must not depend solely on Supabase assigning the same Auth user ID to both logins. Supabase authentication identifiers still need to be associated with the resolved Cloud account, but the mapping schema and resolution mechanics remain open.

The matching reference must come from trusted authentication evidence, not an email asserted by a companion in operation arguments. Which supported-provider claims satisfy the verified-email requirement has not yet been specified.

## 3. Connecting a companion versus signing in to the website

Signing in identifies the person; authorizing a companion permits that client to act on the person's behalf. These are related but distinct steps. A dashboard login does not itself authorize a companion connection.

The discussed companion flow is:

1. The user starts connecting their companion to Cloud's MCP server.
2. The connection initiates a browser-based authorization flow.
3. The user signs in through a supported federated provider.
4. Cloud resolves or creates the Cloud account using the verified-email model.
5. The user authorizes the companion, and its connection completes the token exchange.
6. The companion can access Cloud capabilities subject to the user's permissions.

This captures the intended user experience, not exact callback ordering or middleware behavior. The later [Companion Connection and App Discovery](011-companion-connection-and-app-discovery.md) decision establishes one connection per companion for both Build and Run, with Cloud enforcing permissions per action. Exact protocol scopes, client registration, token refresh, connection revocation, and compatibility with individual companions remain to be designed and verified.

Supabase documents OAuth-server capabilities for MCP authorization and requires an application-provided authorization UI. At the time of the discussion, its OAuth server was documented as beta. Those findings support investigating this path; they do not establish a completed integration or guaranteed compatibility with every companion.

References: [Supabase MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication), [OAuth server setup](https://supabase.com/docs/guides/auth/oauth-server/getting-started).

## 4. Invitation direction established so far

The user accepted the distinction between intentionally joining through an invitation and discovering pending invitations during an unrelated login:

- Following a clearly identified join invitation can lead into authentication and completion of joining that app.
- A general login should surface pending invitations rather than silently join every app that has invited the user.
- Email-addressed invitations should be matched against trusted, verified email associated with the authenticated account.
- The invitation context needs to survive the login flow so the user can continue the intended join action.

These establish the intended experience. They do not finalize invitation eligibility, acceptance endpoints, link behavior, or the exact event that creates app registration.

App registration remains tied to the user's profile, as described in document 006. Discovering an invitation, being eligible to join, and being a registered participant need precise definitions in the next discussion.

## 5. Account-linking context from Supabase

Supabase distinguishes a user from its provider identities and permits multiple identities to be associated with a user. Its documentation describes automatic same-email linking for supported OAuth identities and explicit linking of different-email identities while signed in. SAML SSO users are excluded from those documented linking mechanisms.

References: [Supabase identities](https://supabase.com/docs/guides/auth/identities), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).

These are provider capabilities reported during research, not Cloud account-linking decisions. Cloud's internal-ID model is intended to preserve continuity independently of Supabase identity-linking outcomes. We have not committed to SAML support, automatic merging of existing Cloud accounts, or a different-email linking workflow.

## 6. Invitation details still open

- Are V1 invitations always addressed to a specific email, or can a share link grant membership to any eligible signed-in person who holds it?
- What happens when the user follows an invitation but signs in with a different verified email?
- Does completing login from a join link immediately register the user, or is there an explicit acceptance step after login?
- What exact event creates registration on the profile, and how does it relate to first app use?
- How are expired, revoked, already accepted, or repeated invitations handled?
- How do returning users discover and accept pending invitations through the dashboard or companion?
- If a person previously left the app, does joining again require a new invitation, and how does it interact with archived data?

These are questions to resolve, not additional accepted feature requirements.

## 7. Account matching and linking details still open

### Same-email matching implementation

- Which federated providers are supported initially, and what evidence establishes that the email is verified?
- What email normalization and comparison rules apply? No alias-collapsing or provider-specific rewriting policy has been selected.
- How does Cloud associate multiple Supabase authentication identities/users with one internal account when necessary?
- How are simultaneous first logins prevented from creating duplicate Cloud accounts?
- What should happen if previously associated authentication information changes or conflicts with the email match?

### Email changes and different-email identities

- How can an existing user change their account email while retaining their internal ID?
- Can a Cloud account have multiple verified emails or login identities with different emails?
- What proof or existing session is required to link a different-email identity?
- What happens if both emails already correspond to separate Cloud accounts? No account-merging behavior has been agreed on.
- How are loss of the previous provider, account recovery, and reassignment of an email address handled?

Automatic same-verified-email resolution is the agreed normal login behavior. It does not answer these separate account-change and recovery cases.

## 8. Framework and DataSkill connection

The source inspection in document 007 established that Spring Security authentication already propagates through supported framework invocation into JavaSkills. Cloud still needs to resolve that authenticated identity to its own account ID, check app membership, and bind the authorized app/environment context.

The DataSkill must use trusted context for user/data access rather than treating a caller-supplied account ID as proof of ownership. How the Cloud account ID is carried alongside authentication, and how roles and membership are refreshed, remain implementation decisions.

No framework change solely for basic authenticated-caller propagation has been established as necessary. Cloud will host the framework directly; sidecar code remains a reference, not the runtime for this project.

## 9. Next decisions

The next discussion should settle invitation eligibility and the registration event, followed by the minimum V1 email-change/account-linking behavior. The account model above should remain distinct from those unresolved workflows so later implementation does not silently choose policies on their behalf.
