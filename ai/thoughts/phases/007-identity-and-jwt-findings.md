# Loomspan Cloud — Identity and JWT Findings

## Status and evidence scope

This document records the source inspection following the [app lifecycle discussion](006-app-lifecycle.md). It distinguishes existing framework/sidecar behavior from Cloud design work and recommendations that have not been finalized.

Inspected local repositories:

- Loomspan Framework: `52f11dd90c12863b2ec440583cfe2396eda946f6`.
- Loomspan Sidecar: `ddae36814247fba74ffb74b0fdff7add04228b50`.
- The sidecar declares framework dependency `1.0.0-beta.8`. The framework checkout is ahead of that tag. The inspected authentication-scoping and handoff paths also exist in the matching release; relevant differences were checked rather than assuming all development-branch behavior applies to the sidecar dependency.

Evidence consists of production source and existing test source. Tests were not executed during this inspection. No framework or sidecar code was changed. This is not an end-to-end verification of a Cloud, Supabase, or remote MCP authentication integration.

## 1. Main finding

Authenticated caller propagation into JavaSkill execution already exists. Cloud does not appear to need a new framework mechanism solely to make the authenticated user available to a Java DataSkill.

That finding does not resolve trusted app/environment context, app membership, registration, or data-access strategies. Those remain Cloud design work.

## 2. Existing sidecar behavior

### JWT authentication at the HTTP boundary

The sidecar configures stateless JWT authentication for its `/v1/**` execution endpoints. Its converter uses the JWT subject as the principal name and converts the `roles` claim into authorities without adding a prefix.

Source: [JwtSecurityConfiguration.java](C:/opendev/code/loomspan-sidecar/src/main/java/ai/loomspan/sidecar/security/JwtSecurityConfiguration.java:43).

The execution decoder checks the signature against sidecar trust keys, configured audience, timestamps, and expected claim/header shapes. Its token contract includes `RS256`, `typ: loomspan-execution+jwt`, `token_use: loomspan_execution`, and a roles list. It requires nonblank issuer and subject; this should not be mistaken for a verified Cloud issuer-allowlist design.

Source: [ExecutionJwtDecoder.java](C:/opendev/code/loomspan-sidecar/src/main/java/ai/loomspan/sidecar/security/ExecutionJwtDecoder.java:30).

This is a sidecar-specific credential format. It is not evidence that the same decoder can directly accept Supabase access tokens. Cloud's token validation and trust configuration must be designed for its selected identity provider.

### Authentication across queued execution

The sidecar retains the `JwtAuthenticationToken` with queued work. At dispatch it checks expiration and revalidates the credential, temporarily installs the authentication in Spring Security's context, and calls the framework's supported handoff API. It restores the previous context afterward.

Source: [ExecutionCoordinator.java](C:/opendev/code/loomspan-sidecar/src/main/java/ai/loomspan/sidecar/execution/ExecutionCoordinator.java:177).

This is an existing pattern Cloud can learn from, not a decision to copy the sidecar coordinator or its queue lifecycle. In particular, it does not prove that the sidecar already implements Cloud's per-app publication drainage requirements.

### Ownership of asynchronous results

The sidecar identifies an execution owner by issuer plus subject. Result lookup checks that identity rather than treating possession of an execution ID as sufficient access.

Sources: [ExecutionOwner.java](C:/opendev/code/loomspan-sidecar/src/main/java/ai/loomspan/sidecar/security/ExecutionOwner.java:7), [result lookup](C:/opendev/code/loomspan-sidecar/src/main/java/ai/loomspan/sidecar/execution/ExecutionCoordinator.java:152).

The existing integration test checks that a different subject cannot retrieve the result, a renewed token for the same issuer/subject can, and a different issuer with the same subject cannot.

Test evidence: [AuthenticatedExecutionApiIntegrationTest.java](C:/opendev/code/loomspan-sidecar/src/test/java/ai/loomspan/sidecar/execution/AuthenticatedExecutionApiIntegrationTest.java:261).

This may inform Cloud publication-event ownership, but Cloud's event-access policy has not been selected.

### Optional outbound JWT passthrough

For REST targets configured for caller passthrough, the sidecar retrieves the current JWT from Spring Security, checks expiration, and forwards it as an Authorization bearer token. This is explicit route behavior, not automatic forwarding to every external service.

Source: [GenericRestSkillHandler.java](C:/opendev/code/loomspan-sidecar/src/main/java/ai/loomspan/sidecar/rest/GenericRestSkillHandler.java:57).

Knowing the caller inside a JavaSkill and forwarding the caller's token to a database/service are distinct capabilities. No decision has been made to forward companion credentials to Supabase from the DataSkill implementation.

## 3. Existing framework behavior

### Supported invocation and authentication capture

The framework uses Spring Security authentication at invocation. Its supported `SkillInvocationHandoff` contract explicitly captures the current authentication at handoff and enforces authorization during execution.

Source: [SkillInvocationHandoff.java](C:/opendev/code/loomspan-framework/src/main/java/ai/loomspan/api/SkillInvocationHandoff.java:5).

### JavaSkill execution context

For Java and REST skill execution, the framework checks access, resolves the caller, and installs an isolated security context around the implementation call on the execution worker. The prior context is restored when that scope closes.

Implementation evidence: [ExecutionCoordinator.java](C:/opendev/code/loomspan-framework/src/main/java/ai/loomspan/internal/core/ExecutionCoordinator.java:151), [ScopedAuthentication.java](C:/opendev/code/loomspan-framework/src/main/java/ai/loomspan/internal/security/ScopedAuthentication.java:19).

These internal classes explain the behavior; they are not supported extension APIs for Cloud. A Java DataSkill should use standard Spring Security APIs consistent with the configured context strategy rather than import framework-internal session or security types.

An existing framework integration test runs Alice and Bob concurrently on separate execution workers and checks that each sees the correct identity. It also verifies that an unrelated stale global context does not override the configured security-context strategy.

Test evidence: [JavaSkillIntegrationTest.java](C:/opendev/code/loomspan-framework/src/test/java/ai/loomspan/integration/JavaSkillIntegrationTest.java:130).

This supports reuse of the existing identity channel; it is not proof of complete Cloud tenant isolation or propagation into arbitrary asynchronous work created independently by a JavaSkill.

### Role-based authorization

The framework evaluates skill access policies against Spring Security authorities, with support for role-prefix configuration and role hierarchy. Authentication propagation therefore supports both caller identification and existing role checks.

Implementation evidence: [SkillRoleEvaluator.java](C:/opendev/code/loomspan-framework/src/main/java/ai/loomspan/internal/security/SkillRoleEvaluator.java:21).

Framework RBAC does not itself establish Cloud app membership or per-record permissions. The namespace visibility design also remains distinct from those permissions.

## 4. What Cloud still needs

| Area | Outstanding Cloud work |
|---|---|
| Companion connection | Select and implement the sign-in/authorization flow for remote MCP connections, including credential renewal and reconnect behavior. |
| Identity provider | Confirm Supabase Auth or another chosen setup, then define issuer, audience, signature/key trust, and claim mapping. Supabase Auth remains the tentative direction. |
| User identity | Map validated identity to a Cloud profile using a defined stable identifier. The sidecar's issuer/subject ownership pattern is evidence, not an adopted Cloud profile schema. |
| App joining | Define invitations, acceptance, and exactly when registration is added to the user's profile. |
| Membership and roles | Resolve owner/participant authority for the requested app and define how revoked membership affects subsequent or queued work. |
| Trusted app context | Bind a request to the authorized app, environment, namespace, and applicable app version without treating caller-supplied identifiers as authorization. |
| Data access | Connect the authenticated user and trusted app context to the selected data strategy for reads and writes. |
| Database credentials | Decide how DataSkills authenticate database access; caller identity availability does not choose the database credential model. |
| Async event access | Define who may inspect and repair publication events using Cloud permissions. |

The sidecar's current HTTP execution authentication is not a completed companion-facing OAuth/MCP connection experience. It also does not supply Cloud invitation and membership behavior.

## 5. Proposed reuse direction, not a finalized authentication flow

The assistant recommends retaining Spring Security authentication as the caller-identity channel and building Cloud-specific membership and app-context handling around it.

A conceptual request path is:

```text
Authenticated companion request
  -> Cloud resolves the user and checks app authority
  -> Cloud selects the app/environment and establishes trusted context
  -> framework captures authentication and enforces skill authorization
  -> DataSkill executes under the Cloud data-access strategy
```

This is not a selected middleware order, API contract, or claim schema. Context binding, membership rechecks, and integration with app-version admission remain open.

Cloud will host the framework directly, not run through loomspan-sidecar. It can reuse supported framework APIs and standard Spring Security patterns. Sidecar code provides examples, not permission to depend on framework internals or a requirement to adopt sidecar-specific credentials and management authentication.

## 6. Next discussion: connect and join

The next user-facing decisions are how a person connects their companion to Cloud and how they become registered in an app. Useful cases to work through include an existing user accepting an invitation, a new user arriving through a shared link, and a registered user returning from a fresh companion context.

Whether linking a companion is platform-wide, how Build and Run authorization differ, which interactions trigger registration, and how invitation acceptance is represented remain to be decided. Recording these questions does not establish their answers.
