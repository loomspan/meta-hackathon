# Loomspan Cloud — Data Ownership and Access Enforcement

## Status and scope

This document records the agreed ownership and enforcement direction following the [Data Skills discussion](003-data-skills-v1-direction.md), [app lifecycle](006-app-lifecycle.md), and [companion-first invitations](009-companion-first-invitations.md).

It supersedes the earlier Owner Edit departure policy: when a participant leaves or is removed, their data leaves active app use, just as under Share Nothing. Detailed relationship enforcement and cross-user reference mechanics remain open for component design.

## 1. App ownership and contribution ownership

App ownership controls the app definition, publication, invitations, and membership management. Contribution ownership governs records under the selected data strategy. App ownership does not grant access to another participant's private data or transfer ownership of their contributions. Transferring the app does not transfer contribution ownership.

Every application table definition must include `ownerId`, referencing the permanent Cloud internal account ID. This requirement applies under all three strategies, including Share Everything; having an owner does not limit the shared editing rights of that strategy. The precise field type, schema representation, and enforcement mechanics remain to be designed.

Ownership on creation comes from trusted account context, not a companion-supplied claim. A caller cannot impersonate another owner by supplying or changing `ownerId`. App-authored operations and definition changes must preserve ownership and access protections.

## 2. Alice and Bob recipe example

Alice owns the app. Bob joins and creates Bob's Chili, including recipe-specific ingredient entries such as “two cans of beans.”

| Action | Share Nothing | Owner Edit / Everyone Read | Share Everything |
|---|---|---|---|
| Alice or another participant reads Bob's recipe | No | Yes | Yes |
| Alice or another participant changes or deletes Bob's recipe | No | No | Yes |
| Bob reads or changes his recipe while a member | Yes | Yes | Yes |
| Bob leaves or is removed | His data is privately archived and removed from active use. | His data is privately archived and removed from active use. | Shared content remains available to remaining participants. |
| Alice transfers app ownership | Bob's data rights remain unchanged. | Bob's data rights remain unchanged. | Shared access remains unchanged. |

Under Share Nothing and Owner Edit, the private archive remains available to Bob for 30 days and is then deleted. There is no option to leave his contributions active after departure. Rejoining starts without his former active data and does not automatically restore the archive. Share Everything retains its existing shared-content behavior and has no agreed personal-archive entitlement.

## 3. Keep owned data structures together

A recipe and its recipe-specific ingredient entries form one owned contribution. Those entries inherit the recipe's ownership and access rules and follow it through deletion, departure, and archival. Access restrictions must also apply when an entry is addressed directly.

For Share Nothing and Owner Edit, ordinary owned relationships must keep each user's data structure together. Bob must not attach Alice-owned ingredient entries as constituent parts of his recipe. The DataSkill must enforce this separation; authoring guidance alone is insufficient. The exact relationship declarations and checks are deferred to component design.

Independent reference data has a separate lifecycle from recipe-specific entries. Removing a recipe should not imply deleting an independent catalog record it references. How such data is modeled, owned under the required `ownerId` rule, and made accessible remains part of the open issue below; no ownership exception or catalog mechanism has been selected.

## 4. Cross-user references without mixing ownership

The platform will support a generic reference system for referring to another user's records while preserving separate ownership. A reference does not incorporate the target's owned structure into the referencing user's contribution.

Losing another user's data from the app must not break the referencing user's data. Each user's owned data must remain intact and usable as a unit. Optional references to unavailable targets may disappear or become inactive; remaining references to available data must continue to work. A reference must not keep departed data available or cause dependent deletion of the referencing user's owned structure.

A reference must not itself grant access, transfer ownership, or make the target part of the referencing user's data. Share Nothing continues to prevent access to another user's private records. Support for references and the intact-data guarantee are agreed; exact representation, cleanup, and presentation of unavailable references remain open.

## 5. Enforcement responsibilities

- **Cloud:** Establish authenticated account, authorized app/environment, and membership for each application request. Supply trusted context to execution.
- **DataSkill:** Apply the selected strategy to every data operation, including related-record access and ownership assignment. App-authored named operations remain within the caller's permitted data boundary.
- **Loomspan Framework:** Provide generic execution and authentication capabilities without acquiring Cloud-specific strategy meanings.

The responsibility split is agreed. The implementation contract between Cloud and DataSkill, relationship validation, database protections, and prevention of bypass still need component-level design. Previously accepted queued/running work retains the lifecycle policy in document 006; checking each new request does not establish cancellation of accepted work.

## 6. Open issue: DATA-OWNERSHIP-001 — Related data and cross-user references

**Status: Open.** Revisit during detailed DataSkill and Cloud component design.

Design a generic way to enforce same-owner constituent relationships while supporting explicit cross-user references without mixing owned data structures.

Questions to resolve:

- How do definitions distinguish owned child records, independent reference data, and cross-user whole-record references?
- How does DataSkill validate owner consistency on creation, updates, reparenting, and direct child-record operations?
- How is `ownerId` assigned to child records created by another participant under Share Everything, while keeping a contribution together?
- What form does a reference take, and how are target app, environment, membership, and data permissions checked when it is used?
- How are references to deleted, departed, or inaccessible targets removed or made inactive while preserving the referencing user's owned data and the usability of remaining references?
- How do references behave during archival, export, sandbox refresh, forks, and rejoining without copying another user's data into the user's owned structure?
- How are independent catalog records owned and exposed while every table still includes `ownerId`?
- How are cleanup and reference updates coordinated with concurrent or already accepted operations?

The generic reference capability and intact-data guarantee are requirements. A reference API, storage model, and cleanup mechanism have not been selected.

## 7. Other decisions still open

- Whether and how an existing app may change its sharing strategy, especially from private to shared.
- Exact sandbox-copy and export rights for readable but separately owned data.
- The Cloud-to-DataSkill context contract and concrete database enforcement mechanisms.

These remain design work, not authorization to implement or additional settled behavior.
