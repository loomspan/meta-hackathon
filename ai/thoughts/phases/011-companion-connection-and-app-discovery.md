# Loomspan Cloud — Companion Connection and App Discovery

## Status and scope

This document records the accepted connection and app-loading decisions following [Federated Login and Cloud Accounts](008-federated-login-and-cloud-accounts.md) and [Companion-First Invitations](009-companion-first-invitations.md). Companion-specific discovery mechanisms remain under investigation; no integration has been implemented or verified.

## 1. One connection for Build and Run

Each companion uses one Loomspan connection for both Build and Run. Cloud enforces permissions for each action using the authenticated account and its authority over the requested app. Joining another app does not require a separate per-app connection.

Build and Run remain distinct capabilities and instruction packs. A shared connection does not grant administrative access to joined apps. This supersedes the earlier tentative direction of separate user-facing Build and Run connections. Exact tool organization, protocol scopes, and internal endpoint layout remain implementation decisions.

## 2. Lightweight discovery, then selected-app loading

App discovery returns lightweight summaries of the user's accessible apps. Full instructions are loaded when an app is selected, rather than loading every app's instructions during discovery.

Suggested summary fields are a stable app identifier, name, short description, the user's role, and availability. These fields and their response format are not yet finalized. If the user's request matches multiple apps, the proposed experience is to ask which one they mean.

Selecting an app leads to retrieval of the applicable Run and app-specific instructions. The existing direction also requires the app identifier and version for subsequent operations. The proposed loading contract includes operation descriptions and a coherent set of instructions and definitions for the selected published revision; exact packaging and retrieval APIs remain open.

App discovery does not itself accept pending invitations or create membership. Invitations continue to require explicit acceptance under document 009.

## 3. Production is the default

Opening an app defaults to using production, including when the user owns the app. The companion enters the Build workflow when the user asks to build or edit the app definition. Ordinary changes to application data are Run operations and do not imply editing the app definition.

Ownership alone must not silently select sandbox or enter the Build workflow. Cloud checks the user's authority for each administrative action. The precise transition into Build, sandbox selection, and return to production remain to be designed.

## 4. Returning in a new conversation

The intended experience is that a returning user can select and load a registered app without repeating invitation acceptance. Membership persists in Cloud; the conversation need not preserve the original invitation or app instructions.

Explicit selection of Loomspan through the companion's supported interface is the agreed baseline for starting an app in a new conversation. Natural-language discovery is a convenience, not a prerequisite for the supported experience. No universal selection syntax is prescribed.

After the user selects Loomspan, or the companion recognizes it through natural-language discovery, the proposed sequence is:

1. Establish a usable authenticated connection, guiding reconnection if required.
2. Discover accessible apps through lightweight summaries.
3. Select the requested app, clarifying ambiguity as needed.
4. Load the selected app's instructions and version, defaulting to production.
5. Invoke operations under current Cloud permissions and DataSkill access enforcement.

Existing version-check rules in document 006 apply: an outdated request is rejected before execution and directs the companion to refresh. Cached instructions do not preserve access after membership ends.

Recovery after successful joining but interrupted instruction loading is still an implementation discussion. The recommendation is to preserve the established membership and resume loading without requiring another invitation; loading and acceptance should not be assumed atomic.

## 5. Open issue: COMPANION-DISCOVERY-001 — How a fresh conversation finds Loomspan

**Status: Open for implementation and validation.** The product baseline is settled: explicit Loomspan selection is supported, with natural-language discovery as a convenience. Determine and validate the specific selection mechanism for each supported companion.

Discovery within Loomspan and discovery of Loomspan itself are different problems. A user saying “Open my recipe app,” or even naming Loomspan, does not by itself establish that the companion will find, select, or invoke the connection.

Determine:

- What metadata or instructions a connected companion sees in a fresh conversation, and when it can select Loomspan's tools.
- Whether native app mentions, explicit selection, installed skills, slash commands, or other companion-specific entry mechanisms are available and reliable.
- How users without an installed/authorized connection reach onboarding, and how this differs from returning-user discovery.
- Which explicit entry instructions users receive for the supported baseline on each companion.
- How to validate generic requests, branded requests, explicit invocation, and ambiguous app names with the first supported companion.

A small stable Loomspan entry instruction and a reusable open-app prompt remain packaging proposals for that baseline. No universal slash command, automatic tool selection, connector installation, or platform-directory availability is assumed.

## 6. Other open decisions

- Exact discovery and loading tool contracts, summary fields, pagination, and operation descriptions.
- Instruction/version consistency during publication and interrupted loading.
- Connection renewal, revocation, and recovery behavior across conversations.
- Build entry, sandbox targeting, and returning to Run without confusing environments.
- Which companion is supported and validated first.

These questions do not authorize implementation or establish compatibility with every companion.

The proposed [companion feasibility proof of concept](../plans/proof_of_concept.md) defines a small cross-companion test of connection, Build/Run delivery, app-pack installation versus on-demand loading, generic operations, and fresh-conversation reuse. Its tests and usability gates are proposed and have not been run.

## 7. Discovery research findings — not adopted integration decisions

Official documentation reviewed by a research subagent supports using connected tool/skill metadata to help a companion select Loomspan, with host-specific explicit selection as a fallback. It does not establish that an ambiguous request such as “Open my recipe app” will reliably select Loomspan or discover a private app within its catalog.

- **ChatGPT/Codex:** OpenAI documents tool descriptions and skill metadata as selection surfaces. Its connection-testing flow uses a fresh conversation and explicit plugin selection through `@`. See [tool selection](https://developers.openai.com/plugins/plan/tools), [skills](https://developers.openai.com/plugins/concepts/skills), and [connection testing](https://developers.openai.com/plugins/deploy/connect-chatgpt).
- **Claude:** Custom remote MCP connectors require connection and authentication; connected-app suggestions can use conversational intent. See [custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) and [connected-app suggestions](https://support.claude.com/en/articles/14730684-how-claude-suggests-connected-apps).
- **Claude Code:** Server instructions/tool names support discovery, and MCP prompts have explicit slash-command forms. This does not establish a universal `/loomspan` command across companions. See [Claude Code MCP](https://code.claude.com/docs/en/mcp).

For an unconnected user, a public bootstrap URL can explain setup, but finding instructions does not itself install or authorize the connection.

The research recommendation is to validate a minimal catalog in fresh conversations using generic wording, Loomspan-branded wording, explicit host selection, ambiguous app names, and a disabled connection. This is a proposed validation exercise, not a completed test or selected first companion.

### Public distribution compatibility remains open

OpenAI's [public plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines) restrict discovery/schema-fetch plus generic execution that exposes operations not individually available for review. Listing apps and loading instructions does not by itself settle compatibility of Loomspan's eventual named-operation execution interface. Check that interface against public-distribution requirements separately from private custom-MCP testing before committing to a distribution path.

See [Public Plugin Review and Named Operations](012-public-plugin-review-and-named-operations.md) for the source-backed analysis and open compatibility issue. No execution-interface redesign or public distribution commitment has been adopted.
