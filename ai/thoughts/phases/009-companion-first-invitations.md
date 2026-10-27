# Loomspan Cloud — Companion-First Invitations

## Status and scope

This document continues [Federated Login and Cloud Accounts](008-federated-login-and-cloud-accounts.md) and the [app lifecycle discussion](006-app-lifecycle.md).

It records the accepted companion-first invitation direction. Connection mechanics, invitation policies, and implementation details explicitly listed as open are not agreed requirements. No companion integration has been implemented or verified through this discussion.

This document resolves earlier open questions in document 008: V1 invitations are email-addressed, and explicit acceptance after matching authenticated email creates registration. Login alone does not register the user. It also establishes the companion as the primary invitation experience, rather than treating a web join page as the complete onboarding flow.

## 1. Purpose

Joining should leave the user ready to use the app with their AI companion, not merely registered in Cloud's database.

The recipient receives a shareable prompt that directs their companion to Loomspan onboarding instructions and identifies the invitation. This supports a companion that has never encountered Loomspan, as well as one already connected.

The prompt initiates onboarding. It is not a credential or a grant of app access. Cloud's authenticated checks and acceptance operation establish membership.

## 2. Agreed registration boundary

V1 invitations are tied to an email address. The user must authenticate through a supported federated provider with a matching verified email and explicitly accept the invitation.

Cloud resolves or creates the user's permanent internal account under the model in document 008. On successful invitation acceptance, Cloud registers that internal account ID with the app and includes the membership in the user's profile.

Reading the invitation, retrieving onboarding instructions, signing in, or authorizing the companion does not itself constitute app registration. Possession of the invitation reference is not sufficient to join.

The email match comes from trusted authentication evidence, not an email supplied in a companion's tool arguments. Provider verification evidence and email-comparison rules remain open as recorded in document 008.

## 3. Intended companion-first flow

### Receive the invitation prompt

The user gives the prompt to their companion. It contains an onboarding address and invitation reference, with enough context to explain which app the user intends to join.

Illustrative wording only:

> Help me join Alice's Recipe Collection on Loomspan Cloud. Start with the Loomspan onboarding instructions at [address] and use invitation reference [reference]. Guide me through connecting and signing in, show me the app's sharing rules, and help me accept the invitation. Then load the app's instructions so we can use it.

Addresses, reference format, wording, and delivery channel have not been selected. This does not commit Cloud to sending email or messages through any particular service.

### Retrieve bootstrap instructions

Public onboarding instructions explain how to connect to Loomspan and continue with the invitation. They must be retrievable before authentication so a new companion can learn how to establish the connection.

Public bootstrap instructions do not imply public access to app-specific packs, private invitation details, or application data. They are also distinct from the framework's Public namespace visibility, which governs skill-to-skill calls rather than anonymous web access.

### Connect and authenticate

If necessary, the companion guides the user through connecting to Cloud's MCP service and signing in with a supported federated provider. The user authorizes the companion connection through the authentication flow.

A browser may be involved in login and authorization, while the companion remains the place where the user joins and begins using the app. A prompt is not assumed to be able to install or authorize an MCP connection automatically.

The invitation context must be preserved across connection and login so the companion can resume the intended task. The implementation of that continuity remains open.

### Resolve the invitation and obtain acceptance

Using the authenticated connection, the companion resolves the invitation. Cloud checks the invitation's eligibility and the verified-email match before allowing acceptance.

The companion presents the app and its data-sharing strategy and obtains the user's explicit acceptance. It then invokes Cloud's acceptance operation, which creates registration using the internal account ID.

If the email does not match, joining does not proceed. The discussed experience is to explain the mismatch and let the person sign in with the invited account. Exact account-switching behavior and how much invitation information can be shown before eligibility is confirmed remain open.

### Load the app and begin use

After acceptance, the companion obtains the Loomspan-maintained Run skill pack and the app-specific skill pack. The Run pack supplies common platform-use instructions; the app-specific pack supplies the application's business and presentation instructions and description of available data.

The companion also obtains the app identifier and version needed for subsequent operations and artifact-refresh checks. Exact response fields, retrieval methods, and pack-version relationships remain undecided.

The intended end state is an authorized, registered user whose companion has the instructions needed to start using the app. Failure or interruption while loading packs does not have a defined recovery policy yet; acceptance and artifact loading should not be assumed to be one atomic operation.

## 4. Returning conversations and other companions

Membership persists in Cloud beyond the invitation conversation. A fresh context or another authorized companion needs a way to discover the user's registered apps and retrieve the applicable Run/app packs and versions.

The invitation prompt is an entry mechanism, not the only durable record of which app the user joined. App discovery and pack retrieval APIs remain to be designed.

Companion-first is the primary onboarding direction. Whether Cloud also supports web acceptance in V1 remains open; web acceptance would not inherently prevent later companion discovery if that capability is provided.

## 5. Responsibilities

| Component | Responsibility in this direction |
|---|---|
| Public bootstrap material | Explain connection and invitation onboarding before authentication. |
| AI companion | Guide connection, present the app and sharing strategy, obtain acceptance, invoke Cloud operations, and load skill packs. |
| Supabase Auth and supported providers | Authenticate the person and support companion authorization under the connection design still to be completed. |
| Loomspan Cloud | Resolve accounts, check verified email and invitation eligibility, create membership, expose authorized discovery and pack retrieval, and supply app-version information. |
| Loomspan Framework | Execute hosted skills with existing authentication/RBAC and the planned namespace behavior; it does not own Cloud invitation or registration policy. |

The user remains the source of acceptance. The exact way conversational acceptance is represented in an authenticated request has not been specified.

## 6. Agreed V1 invitation policies

Invitations, active membership, and retained data have separate lifecycles. The project owner accepted the following rules:

| Topic | V1 rule |
|---|---|
| Who can invite | Only the current app owner. Participants cannot invite others. |
| Access granted | Participation under the app's data strategy, not app ownership or sandbox access. |
| Expiration | Pending invitations expire after seven days. An accepted membership does not expire with the invitation. |
| Reissuing an invitation | Replace the pending invitation and start a new seven-day period. The previous reference stops working. |
| Revocation | The owner can revoke a pending invitation immediately. |
| Repeated acceptance | If the same account already accepted and remains a member, return an already-joined result and the information needed to load the app. Do not create another membership. |
| Leaving and rejoining | Leaving ends membership. Rejoining requires a new invitation and explicit acceptance. An old accepted invitation cannot restore access. |

Seven days is the V1 policy; configurable invitation durations have not been selected.

### Acceptance and concurrent requests

Cloud must check invitation status, expiration, verified-email eligibility, and membership consistently at acceptance time. Earlier inspection of an invitation by the companion does not reserve eligibility or bypass a subsequent revocation or expiration.

Repeated or concurrent acceptance requests must result in one membership, including when the first request succeeded but its response was lost. The exact transaction and response implementation remains open.

For an account that accepted and subsequently left, retrying that old acceptance does not recreate membership. Cloud explains that a new invitation is required. Accepted invitations are not reusable admission credentials.

### Invitation revocation versus member removal

Revocation applies to pending invitations. Once accepted, an invitation has completed its purpose; revoking an invitation is not a way to remove an active member.

Whether and how owners can remove active members remains open for the next discussion. No member-removal permission or data-retention behavior for forced removal is established here.

### Rejoining and retained data

Rejoining does not undo the data decision made when leaving:

| Data strategy | V1 rejoin behavior |
|---|---|
| Share Nothing | Previously archived data stays archived. The returning user starts with no active personal data; automatic restoration is not part of this flow. |
| Owner Edit / Everyone Read | Retained records remain associated with the user's internal account ID, and the returning user can manage them again. Removed records stay removed. |
| Share Everything | The returning user regains access to current shared content under the app's strategy. |

Archive retention and any separate recovery capability remain unresolved lifecycle topics. A new invitation does not itself restore archived or deleted records.

### App retirement and owner departure

When an app enters the no-participants archive/removal lifecycle, invalidate its pending invitations. Accepting an old invitation must not silently reactivate the retired app. The underlying archive timing and storage mechanics remain open in document 006.

An app with remaining participants but no owner has nobody authorized to issue new invitations under these V1 rules. Existing participants can continue using it as discussed in the lifecycle design. Whether ownership can be transferred, and how that occurs, remains open; this document does not introduce a transfer mechanism.

General bearer-style links that let anyone holding them join are not the selected V1 invitation model. Copying or forwarding the prompt does not remove the verified-email requirement.

## 7. Connection and implementation details still open

- Whether and how the owner can remove active members, including effects on their data and in-flight work.
- Whether and how ownership transfer is supported, including departure of the current owner.
- How pending invitations are discovered and accepted without the original prompt.
- Exact invitation states, references, response payloads, and atomic acceptance/revocation implementation.
- How an invite attempt for an already active member is presented; the established rule is that membership must not be duplicated.
- Which companion is supported and tested first, and how does it fetch bootstrap instructions, establish MCP access, and resume the invitation?
- How are the bootstrap instructions published and updated?
- What does the invitation reference look like, and how is it preserved during redirects and conversation changes?
- Which authenticated operations resolve invitations, accept them, discover apps, and retrieve packs?
- How are Build and Run connection scopes arranged for a user who joins apps and also creates their own?
- How are interrupted connections, accepted invitations with incomplete pack loading, and repeated onboarding attempts resumed?
- How are membership changes reflected in pack retrieval and subsequent skill calls?
- How are app publication/version changes handled during onboarding?

Different-email account linking, email changes, and account recovery remain open in document 008. This invitation flow does not silently define those policies.

## 8. Suggested next step

Discuss owner removal of active members and ownership transfer next. The V1 invitation lifecycle above is agreed, while those separate membership and ownership policies remain open. Then validate the complete bootstrap-to-first-operation path with one supported companion. The need to test that path is a recommendation; universal companion compatibility is not an established capability.
