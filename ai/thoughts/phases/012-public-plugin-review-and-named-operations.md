# Loomspan Cloud — Public Plugin Review and Named Operations

## Status and scope

This is research and design analysis, not an adopted interface or distribution decision. It follows [Companion Connection and App Discovery](011-companion-connection-and-app-discovery.md). The accepted DataSkill named-operation model remains in place.

The restriction analyzed here concerns public Directory review, not an iPhone-specific limit or an established prohibition on directly configured Codex/custom MCP execution. The [companion feasibility proof of concept](../plans/proof_of_concept.md) evaluates direct-connection runtime behavior separately from public distribution.

## 1. Relevant official requirements

OpenAI's [plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines) apply to public Directory listings. They require separately exposed model-callable operations and prohibit discovery/schema-fetch plus generic execution of operations not individually exposed for review.

The [tool-design guidance](https://developers.openai.com/plugins/plan/tools) recommends coherent actions with explicit contracts and separation where permissions, side effects, or confirmation requirements differ.

The [remote MCP review documentation](https://developers.openai.com/plugins/deploy/app-review) describes continuous tool review. New tools become available after approval; held updates retain the previous approved definition. Server implementations must continue supporting that live contract.

## 2. Application to Loomspan

Named operations inside DataSkill and model-facing MCP tools are separate design layers. A declarative operation such as `findQuickRecipes(maxMinutes)` can remain the internal implementation of an individually exposed tool. The naming or declarative implementation alone is not the identified conflict.

The concerning candidate is:

```text
listApps()
loadApp(appId) -> discovers app-defined operations and argument schemas
executeOperation(appId, operationName, arguments)
```

These are illustrative names, not selected APIs. If the last call exposes unreviewed model-callable operations discovered by the preceding call, this analysis concludes that it matches the prohibited pattern. Publishing the operation in Loomspan or checking ownership does not establish that it has been exposed for OpenAI review.

App summaries and on-demand instructions can remain useful independently of that executor design. One authenticated connection also need not mean one execution tool: it could expose multiple separately described actions.

## 3. Candidate approaches — not decisions

- **Expose app operations individually:** A tool such as `find_quick_recipes` can delegate to the existing named-operation interpreter. This addresses separate exposure, but review access to private app definitions, per-user catalogs, new operations, and version changes remains unresolved. Approval is not established merely by generating tools.
- **Define fixed platform actions:** Stable listing, membership, publication, or bounded data actions may offer reviewable contracts. A generic executor renamed as a read or write action would not resolve undisclosed operation behavior. Whether a bounded data interface preserves the intended app semantics and satisfies review needs specific design and validation.
- **Validate custom connections separately:** A private/custom connection can test runtime behavior, subject to the host's controls and policies. Such a test does not prove public Directory eligibility or universal user availability.

Neither a skill nor loading an operation schema in text resolves the need for a reviewable execution interface.

## 4. Open issue: PLUGIN-COMPATIBILITY-001

**Status: Open.** Resolve the public-distribution interface before treating public Directory availability as a V1 capability.

- Can individually exposed tools generated from user-owned app definitions be supported and reviewed, including authenticated per-user tool catalogs?
- How can reviewers access the complete model-callable behavior while preserving user privacy?
- How do tool approval and retained old schemas interact with Loomspan's current-version requirement and supported destructive schema changes?
- Could a fixed, bounded platform API satisfy both the product model and review requirements without concealing arbitrary operations?
- Does V1 require public Directory distribution, or is a supported custom connection acceptable initially?

The reviewed documentation does not establish approval for Loomspan's user-generated operation model. The recommendation is to preserve internal named operations while evaluating a concrete model-facing contract and obtaining clarification on the unresolved review cases. No external inquiry has been sent and no approach above has been selected.
