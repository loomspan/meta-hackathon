# Loomspan Cloud — Skill Namespaces

## Status and scope

This document continues the [platform components discussion](002-platform-components-and-responsibilities.md) and [optional JavaSkill configuration direction](004-optional-javaskill-configuration.md).

It records the namespace direction agreed in the conversation. These are current design decisions, still subject to refinement, not a completed implementation specification. Open mechanics and assistant suggestions are identified separately below.

The framework and sidecar implementations have not been inspected during this discussion. Statements about existing behavior are attributed to the project owner rather than presented as verified code findings.

## 1. Motivation

The project owner described the current framework as supporting dynamic skill updates, but requiring the full set to be updated as one atomic unit. For Cloud, this would appear to require either a separate framework instance for each customer or management of a combined publication containing everyone's skills.

Namespaces are intended to allow multiple independently managed sets of skills and configuration within one running framework. This should let Cloud host multiple customers economically without requiring an app update to replace unrelated apps' definitions.

This capability is useful outside Cloud too. For example, a company could keep department skills and configuration separate within one Loomspan deployment.

## 2. Agreed namespace model

The framework should not care why a namespace exists. It should manage namespaces and enforce their boundaries without interpreting them as customers, departments, or apps.

Skills and associated namespace configuration can be published to a namespace. Each namespace can be updated independently and atomically, without replacing the skills or configuration of other namespaces.

Each namespace has **Public** or **Private** skill-call visibility. The direction uses visibility on ordinary namespaces, not a reserved namespace named Public and not a separate global cross-namespace enable/disable switch.

### Skill-call visibility rules

| Target namespace visibility | Call from the same namespace | Call from a different namespace |
|---|---|---|
| Private | Permitted by namespace visibility | Denied by namespace visibility |
| Public | Permitted by namespace visibility | Permitted by namespace visibility |

Permission in this table is only the namespace visibility decision. RBAC and other applicable execution checks still apply.

These rules apply to **skill-to-skill call visibility**. They do not define external authentication, publishing permissions, database access, or anonymous internet access.

### Configuration remains separate

Making a namespace Public grants cross-namespace access to its skills, subject to security. It does **not** grant other namespaces access to its configuration.

Public visibility is therefore not a general export of everything stored in a namespace. The configuration delivery mechanism for a namespace's own skills remains to be designed.

## 3. RBAC

The project owner stated that Loomspan Framework already supports RBAC. Namespace visibility supplements that security rather than replacing it.

A Public skill can still be restricted by RBAC. Being reachable from another namespace does not itself grant permission to execute the skill. Similarly, a permission that would otherwise allow invocation does not remove the Private namespace boundary for a cross-namespace skill call.

The exact integration with existing RBAC, including identity propagation and the order and location of checks, remains unverified and open to implementation design.

## 4. Independent publication and execution consistency

The intended publication boundary is the namespace: update its skills and associated configuration together without replacing unrelated namespaces.

The project owner believes the framework already provides consistent execution during dynamic updates and suggested adapting that mechanism to respect namespaces. We should verify and extend the existing behavior as needed rather than assume a new execution-consistency mechanism is required.

The discussion has not selected snapshot representations, locking, version identifiers, retention rules, or publication APIs. In particular, the behavior of an execution that uses both its own namespace and a Public namespace while either is updated remains an implementation question.

Independent publication does not imply that changing a Public skill cannot affect its callers. It means publication does not replace other namespaces' definitions. How callers observe shared-skill updates requires further design.

## 5. Framework versus hosting-application responsibilities

### Loomspan Framework

- Support generic namespaces for skills and associated configuration.
- Support independent atomic updates at the namespace boundary.
- Enforce Public/Private visibility for skill-to-skill calls.
- Continue applying its security controls, including RBAC.
- Keep namespace configuration inaccessible to other namespaces merely by virtue of Public visibility.
- Adapt existing update-consistency behavior to namespaces as needed after inspection.

The framework does not assign business meaning to a namespace or prescribe who should be allowed to publish to a Public namespace.

### Hosting application generally

The application managing the framework determines how namespaces are used, who may manage or publish them, and which are Public or Private. A corporate deployment can establish its own management rules.

Namespace skill-call visibility is distinct from the host's external entry points. How an external request is authorized and routed into a namespace belongs to the hosting integration; a Private namespace is not inherently an unusable app.

### Loomspan Cloud

The agreed mapping is **one namespace per micro app**. A user can own multiple apps and therefore have multiple app namespaces.

Cloud controls app ownership, membership, publication permissions, and routing of authorized requests to the appropriate app. The project owner explicitly stated that ordinary Cloud users will not be allowed to publish skills into Cloud's public/shared capability area.

The intended arrangement discussed is Private app namespaces with shared capabilities in Public namespaces. The exact set of shared namespaces, their names, and their contents have not been defined. No special reserved namespace is required.

Cloud-specific data strategies and data access remain distinct from framework skill-call visibility. A namespace boundary alone does not define permission to read or modify application records.

## 6. Proposals and implementation details still open

### Naming and resolution

- What is the namespace identifier and how is it represented in publication and invocation APIs?
- The assistant proposed resolving unqualified skill names locally and requiring explicit targets for cross-namespace calls. That syntax and lookup behavior have not been finalized.
- What is the visibility default for a newly created namespace?
- How are existing deployments without namespaces represented or migrated?

### Execution and security context

- How does the framework identify the calling namespace at each step of a skill chain?
- The assistant suggested that a Public skill does not gain a right to call back into a Private caller's namespace. This follows the direct-call visibility model, but callback/delegation behavior and any execution-context mechanics have not been designed.
- How are authenticated identity, RBAC context, and app context propagated without confusing caller identity with namespace visibility?
- How do external MCP invocations select and enter a namespace?

### Updates and lifecycle

- What existing atomic-update and execution-consistency mechanisms can be made namespace-aware?
- How are concurrent publications to the same or different namespaces handled?
- What consistency applies when an execution crosses into a Public namespace that is updated independently?
- How are visibility changes and namespace deletion handled for active executions?
- Which configuration belongs to a namespace and which remains host-level, such as framework settings or shared infrastructure configuration?

### JavaSkills and shared resources

- The assistant noted that multiple namespaces could potentially reference one registered JavaSkill implementation while supplying separate definitions and configuration. Reusing implementation code is conceptually distinct from calling a skill in another namespace; the binding and lifecycle mechanics remain open.
- How are JavaSkill instances and mutable state scoped?
- Namespaces are intended to isolate definitions, configuration, visibility, and updates. They are not by themselves an established design for isolating credentials, database access, or resource consumption. The shared-hosting implications need inspection.

## 7. Approaches superseded by the agreed direction

- A single reserved Public or Shared namespace with special naming semantics.
- A global configuration switch to allow or deny cross-namespace calls.
- Framework-prescribed publisher roles for Public namespaces.

Public/Private visibility supplies the skill-call rule, existing RBAC still applies, and the hosting application determines management permissions.

## 8. Suggested next investigation

Inspect the framework's publication, skill lookup, invocation, RBAC, configuration, and execution-consistency paths, along with the sidecar's hosting integration. Use those findings to propose the smallest compatible namespace enhancement. That investigation has not yet occurred.
