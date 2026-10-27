# Loomspan Cloud — App Lifecycle

## Status and purpose

This is a living record of the lifecycle discussion following the [namespace design](005-skill-namespaces.md). It builds on the [micro app design intent](001-micro-app-design-intent.md) and [platform component outline](002-platform-components-and-responsibilities.md).

The document distinguishes current product directions from tentative mechanisms and open questions. It is not a finalized specification or implementation plan. Later clarifications here supersede earlier suggestions where explicitly noted, particularly Share Nothing departure behavior and sandbox refresh.

The subsequent [identity and JWT inspection](007-identity-and-jwt-findings.md) established existing authenticated-caller propagation from source and test-code inspection. Publication drainage, timeout termination guarantees, and the remaining lifecycle integration have not been verified by that inspection.

## 1. Responsibility boundary

Loomspan Cloud owns the app lifecycle: sandbox and production management, publication permissions and restrictions, user registration and departure, data retention, and usage/tier management.

Loomspan Framework remains a general execution host. Its generic namespace, configuration, execution, and security capabilities support Cloud without acquiring Cloud-specific lifecycle rules.

## 2. Sandbox, production, and promotion

### Current direction

Apps have sandbox and production environments so they can be exercised before production publication. Production publication proceeds through sandbox rather than allowing direct publication of app definitions to production.

Production starts empty: sandbox test records are not promoted into production. Later publications update the existing production app and preserve its data except where approved schema changes intentionally remove it. Intentional starter/reference data has not been specified.

The tentative implementation is to publish the app twice, for example with `_sandbox` and `_prod` identifiers, and provide a Cloud operation to promote the sandbox definition to production. The suggested name `publishSandbox` is not a finalized API.

The assistant noted that separate environment publications may refine the earlier one-namespace-per-app mapping into one namespace per app environment. That mapping, identifier scheme, and its relationship to the app's logical identity still need confirmation.

### Sandbox refresh

The project owner explicitly agreed that there should be a way to refresh sandbox with **the owner's data from production**. This supersedes the earlier suggestion that sandbox refresh would be unnecessary if all production publications originated in sandbox.

This does not establish permission to copy every participant's production data. The exact meaning of the owner's data, particularly under Share Everything or where records reference shared content, remains to be defined.

### First publication

The companion prepares the app in sandbox, where its definitions and behavior can be validated and exercised. Cloud promotes a specific tested revision, creates the production schema, and installs the corresponding skills and configuration. Production becomes available only after successful publication, with no sandbox test data copied into it.

The exact required checks, artifact packaging, and method of identifying the tested revision remain open. The direction is to promote the tested artifacts, not silently include subsequent sandbox edits.

### Supported V1 schema changes

The current scope is deliberately limited:

| Change | V1 direction |
|---|---|
| Add tables or columns | Supported. |
| Rename tables or columns | Supported as renames that preserve the associated data. |
| Remove tables or columns | Supported, with destructive effects made explicit during publication review. |
| Increase a `varchar` column's size limit | Supported. |
| Other data-type changes or shrinking a `varchar` limit | Outside the selected V1 scope. |
| Uniqueness constraints | Enforced in the database and included in DDL changes. |

The brief additive-only proposal was superseded: renames and removals remain supported. There is no promise that older companion artifacts remain compatible with a new publication.

Most application constraints, relationships, and business logic should live in configuration and the DataSkill implementation rather than database logic. Uniqueness is an explicitly identified exception because it must remain correct under concurrent writes. Exact uniqueness scope, constraint-edit operations, and treatment of existing duplicates still require design.

Publication review should identify destructive changes so the user understands and approves the data loss. The precise review/approval interaction is not yet designed. Arbitrary data transformations and automatic rollback are not committed capabilities.

### Rehearsing schema changes

Before promoting a schema-changing revision, the intended workflow is to refresh sandbox from production, apply the proposed DDL there, and allow the user and companion to verify the resulting app before publishing.

The assistant proposed preserving the candidate definitions and migration before refresh, reconstructing the production schema baseline with the owner's permitted data, then applying the candidate DDL and matching skills/configuration. This is a way to test the transition rather than merely test the final schema; its exact refresh and revision mechanics remain open.

Promotion applies the tested changes to production, rather than copying the modified sandbox database over production. Owner-only sandbox data may not expose every case present in other participants' records, so rehearsal is not a guarantee that all production checks will pass.

The assistant recommended that Cloud generate DDL from supported change operations, rather than accept arbitrary companion-authored DDL. That implementation approach has not been separately finalized.

### Later publication: stop admission, drain, publish, reopen

The agreed publication model accepts temporary unavailability for the affected app:

1. Stop accepting new application operations for that app.
2. Let already accepted queued and running work drain before changing the production schema or definitions.
3. Apply the schema changes, if any, and publish the matching skills and configuration.
4. Activate the new app version and reopen access only after publication succeeds.

Other apps are not intended to be closed by this app's publication. The gate mechanism and exact ordering of version activation, verification, and reopening remain implementation details.

The project owner believes the framework already enforces timeouts, so accepted work should finish or time out. The implementation should be inspected and reused rather than assuming a new timeout mechanism is needed. In particular, confirming that timed-out work no longer mutates data is part of verifying safe drainage, not a completed finding.

The assistant recommended returning a temporary publishing response for new operations instead of holding them for execution after the schema changes. Exact response codes, payloads, and retry guidance have not been selected.

### App versions and companion refresh

The app must expose a version that the companion can compare with its installed local artifacts. After a new publication, an outdated companion receives a response directing it to refresh those artifacts.

The accepted version-check direction is to check the companion's app version before executing an operation. An incompatible/outdated request is rejected without performing the requested application operation; the companion refreshes and submits a request appropriate to the new definition. This avoids applying an old request and only then reporting that its instructions were stale.

The proposed simple V1 policy requires the current app version rather than maintaining older operation contracts. Version identifiers, request/response fields, download mechanics, and handling of absent version information remain open. Retention of configuration for already running work does not establish support for new calls against old app definitions.

### Asynchronous publication status and failure

Publication is an asynchronous Cloud event. The owner can track its status in the Cloud dashboard, and the companion can check the status.

The agreed status model is:

```text
Publishing -> Published
Publishing -> Error
```

If publication partially fails, the app remains unavailable until the owner addresses the issues through their companion. Cloud must not reopen an app with mismatched schema and definitions merely because some publication steps succeeded. Automatic rollback is not promised.

The event identifier, status API, diagnostic payloads, persistence, repair/retry operations, and behavior after a Cloud process restart remain open. Administrative status and repair access must be distinguished from the unavailable app-operation path; the exact interfaces are not defined.

### Publication and refresh details still open

- What automated checks and user verification are required before promotion?
- How is the tested revision fixed, and how is a changed production baseline detected?
- Which artifacts form a publication, and how are they coordinated with database DDL?
- How are duplicate or concurrent publication submissions handled in the single-instance V1 deployment?
- How are publication progress and partially applied changes recorded for owner-assisted repair?
- Does sandbox refresh replace or merge data, and how are existing experiments preserved?
- How is refresh coordinated with active sandbox work and production data changes?
- Who can access sandbox, and how is its data kept separate from production?
- How are configuration-only changes that invalidate existing records checked?

## 3. Allowed published capabilities

Cloud will restrict the skill types users may publish. The project owner identified Data Skills and TypeSafe skills as likely initial supported types, with additional types possible later. The exact initial list remains to be finalized.

These are Cloud restrictions, not restrictions on the general capabilities of Loomspan Framework. The assistant recommended checking allowed types when accepting app definitions; enforcement locations and checks have not been designed.

The project owner expects existing framework boundaries to help keep skill executions separate and believes the framework tracks calling-user information. The sidecar's JWT propagation was identified as something to inspect and learn from.

Cloud will not use loomspan-sidecar for this project. Its implementation can be a reference for supplying trusted identity to JavaSkills, including the DataSkill implementation, without adopting the sidecar as the Cloud runtime.

## 4. V1 interaction boundary

For V1, micro apps operate only in response to AI companion requests.

Other supported interaction types may be added to Cloud later. Cloud-specific interaction features should remain outside the generic framework. No initial scheduling, event-triggered app execution, or background app-action capability has been selected.

This boundary describes micro app interactions; it does not prohibit Cloud's own lifecycle administration, such as asynchronous publication or archiving data.

Multiple Cloud instances are explicitly outside V1. Publication admission and drainage do not need a distributed multi-instance design for the initial release. Single-instance restart and recovery behavior still needs definition.

## 5. App registration and participation

The project owner wants app interaction tied to an app registration on the user's profile, making departure an explicit event Cloud can track.

For invited participants, matching verified email plus explicit invitation acceptance creates app registration. Login or invitation discovery alone does not. See [Companion-First Invitations](009-companion-first-invitations.md) for the agreed invitation and rejoin rules. Registration details for app creation and the implementation of lifecycle events remain to be designed.

App ownership and participation are related but distinct: a participant may use the app under its data strategy, while ownership controls changes to the shared app definition.

## 6. Leaving an app and data retention

These agreed V1 behaviors belong to Cloud. Voluntary departure and owner removal both end membership, while data handling depends on the app's strategy.

### Owner removal of active members

- Only the current app owner can remove another participant.
- Removal ends membership and blocks new app operations and skill-pack retrieval. Previously downloaded instructions cannot be recalled, but do not authorize continued access.
- Already accepted queued and running operations may finish under the access decision already made. Removal does not promise cancellation of all existing work. The execution integration still needs verification.
- Removal does not transfer ownership of the participant's records or grant the app owner new rights to delete or claim them.
- Rejoining requires a new invitation and explicit acceptance. An old accepted invitation cannot restore membership.

Removing an active member is distinct from revoking a pending invitation.

### Personal archives and active data

| Strategy | Behavior on voluntary departure or removal |
|---|---|
| Share Nothing | Archive the user's data for their download and remove it from active app use. The archive is private to the departing user, not accessible to the app owner or other participants. |
| Owner Edit / Everyone Read | Same as Share Nothing: privately archive the user's data for download and remove it from active app use. Their contributions do not remain available to other participants. |
| Share Everything | Shared content remains available for remaining participants to manage under the existing strategy. The new personal-archive policy does not apply. |

For Share Nothing and Owner Edit, the personal archive is available to the departing user for **30 days after departure or removal**, then is deleted. The deadline ends both download access and archive retention, not merely visibility in the dashboard.

The archive is a private copy for the user's retrieval after their data leaves active app use. Archive download is a Cloud account-management capability that does not require active membership. The 30-day window governs archive access and retention, not a choice to retain active contributions.

The intended archive represents the user's data at departure. The assistant recommended securing that snapshot before active-data cleanup. Coordination with already accepted work, archive creation failures, and the exact snapshot cutoff remain implementation questions; no race-free mechanism has yet been designed.

### Unified departure behavior for owner-based strategies

Share Nothing and Owner Edit use the same departure policy whether the participant leaves voluntarily or is removed: their owned data leaves active app use and is privately archived for 30 days. The earlier Owner Edit option to retain contributions and choose removal during a cleanup window is superseded by [Data Ownership and Access Enforcement](010-data-ownership-and-access-enforcement.md).

Owned child records follow their parent contribution. Cross-user references must not retain departing data as active content. Losing a target must leave the referencing user's owned data intact and usable; optional references may disappear or become inactive, and remaining references must continue to work. The implementation is open in **DATA-OWNERSHIP-001** in document 010.

### Rejoining

Rejoin behavior follows documents 009 and 010: Share Nothing and Owner Edit users start without their former active personal data and do not automatically restore archives; Share Everything users regain access to current shared content. Removed records stay removed.

The interaction between rejoining and a still-running archive-retention window needs implementation clarification. No automatic deadline extension or archive restoration is established here.

### Ownership transfer

Ownership transfer is now an agreed V1 capability, replacing its earlier tentative status. It is an explicit exception to the original creator-only administration model: the current owner controls the app and can transfer that role.

1. The current owner selects an active participant as successor.
2. Cloud offers the transfer to that participant.
3. The recipient explicitly accepts.
4. Cloud changes ownership in one operation.

Until completion, the original owner remains responsible and can cancel the pending transfer. If either party leaves before completion, the pending transfer becomes invalid.

On completion:

- The new owner gains publication, invitation, member-management, and sandbox authority.
- The former owner remains an ordinary participant unless they separately leave. Transfer alone is not a departure or personal-archive event.
- The app identity, production data, memberships, and selected data strategy remain unchanged.
- Ownership does not grant special access to records kept private by the data strategy, and does not change contribution ownership.

Before the new owner receives sandbox access, clear sandbox application data while preserving the sandbox schema and app definitions. This prevents an owner-data refresh from exposing the former owner's private records to the successor. The new owner can subsequently refresh using their own permitted production data.

Any pending publication must finish or be resolved before transfer completes. The exact coordination of acceptance, sandbox clearing, authority changes, and partial failures remains open.

### When the owner leaves without a successor

Remaining participants can continue using the app as it stands under its existing data strategy. Nobody can publish changes or issue new invitations without an owner. V1 does not automatically elect a replacement owner.

The departing owner's personal data follows the strategy-specific departure rules above. App ownership itself does not exempt that person from the archive or retention policy.

### When no registered participants remain

The project owner's direction is that all app data can be archived and removed once nobody remains registered to the app.

Pending invitations are invalidated so they cannot silently reactivate the app. The timing and storage mechanics of whole-app archival/removal, retention of the app definition, and any later reactivation remain open. This does not erase the agreed 30-day personal-download window: eligible departed users must retain that access even without app membership. Whole-app archives, including Share Everything content, do not acquire a defined retention period merely from the personal-archive rule.

### Remaining lifecycle implementation questions

- Archive format, storage, authorization, deletion scheduling, and recovery from failed archival or cleanup jobs.
- Snapshot consistency with accepted work and concurrent changes to shared data.
- Selecting a user's owned contribution structures and handling cross-user references when those contributions are removed; see **DATA-OWNERSHIP-001** in document 010.
- Deadline representation and enforcement at the 30-day boundary.
- Cleanup and archive behavior when a user rejoins before expiry.
- Ownership-transfer offer lifetime, duplicate/concurrent acceptances, and failure recovery during sandbox clearing.
- Billing and usage responsibility after ownership transfer; no billing reassignment policy has been selected.
- Coordination with publication, owner departure, and last-member app retirement.

## 7. Usage, tiers, and dashboard

Cloud will track usage from the outset and have free and paid tiers. Tier limits are not yet defined. The project owner expects usage will likely be displayed on the user's Cloud dashboard; the dashboard presentation remains tentative.

The assistant recommended separating usage measurement from tier policies so allowances can change independently. That is a proposed implementation principle, not an agreed metering design.

Open questions include which resources are measured, who bears usage for shared-app operations, how sandbox usage is accounted for, and how limits are enforced. No pricing, quotas, billing mechanism, or attribution model has been selected.

## 8. Connections to earlier lifecycle ideas

Earlier discussions identified change history, companion-assisted backups, and forking as intended directions. They remain relevant but are not resolved by sandbox/production support.

- The Git-like workflow is meant to help companions understand and revise changes; no automatic rollback capability has been committed to.
- Readable backups are intended to assist with data repair; backup contents and recovery behavior remain open, and dedicated restore was not expected initially.
- Forking is intended to let users evolve or freeze an app independently; copied artifacts, data, membership, and version semantics remain open.
- Sandbox refresh is a specific requested capability and should not be treated as a general backup restore or fork operation.

## 9. Suggested next design work

The assistant suggested walking through one app's lifecycle: sandbox creation, testing, promotion, invitation and registration, ordinary use, a schema change, sandbox refresh, participant departure, and owner departure.

That exercise can clarify the publication and data boundaries before selecting APIs or storage mechanisms. It is a proposed next discussion, not a completed design or additional feature commitment.
