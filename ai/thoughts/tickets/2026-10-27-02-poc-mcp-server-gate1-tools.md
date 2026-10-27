# Serve the Gate 1 MCP tools: discover apps, deliver packs, and execute grocery operations

## Outcome

A companion connected to the Loomspan POC can, over one authenticated MCP connection, discover the grocery-list app, retrieve Build/Run/app packs, and read and add grocery items through generic tools — with server-side membership, validation, and version enforcement. Adding `remove_item` later requires only a database definition update, not a change to this server or to any companion connection.

This is the runtime the Gate 1 questions depend on: one generic connection serving current instructions and operations for an app.

## Requirements

- Implement a self-built MCP server as one Supabase Edge Function in `poc/mcp-server/`, exposed over Streamable HTTP at `https://yjrwyfkybszlpufsflan.supabase.co/functions/v1/mcp`. It is not the official Supabase MCP server for coding agents. No MCP code runs on Cloudflare.
- Expose exactly these Gate 1 tools. These names and shapes are the POC fixture contract, not final product contracts:
  - `list_apps` → lightweight summaries only (app ID, name, version, one-line summary, environments). No instructions or operation definitions.
  - `get_pack` → the Build pack, the Run pack, or a selected app's pack, containing pack/app ID, version, instructions, available named operations, and argument definitions. Baseline delivery is this tool returning instructions for the current conversation; persistent native skill installation is a separate host capability and is not implemented or claimed here.
  - `call_operation` → app ID, environment, `app_version`, operation name, and arguments. Environment defaults to production.
- Authenticate every tool call with the Supabase-issued token and run it as the signed-in user. Reject unauthenticated calls. Enforce membership server-side (RLS and/or explicit membership checks) regardless of what any pack instructs.
- Read operation definitions from the Postgres app-definition records established by the foundation ticket. Executing an operation must be driven by the stored definition, so that a definition update adding `remove_item` works through the unchanged server. Hardcoding the v1 operation set in a way that blocks a DB-added operation fails this ticket.
- Enforce the version contract on `call_operation`: if `app_version` is not the current version, reject before any mutation and return a structured stale response containing `ok: false`, `error_code: "stale_version"`, the current version, and guidance directing the companion to call `get_pack` and retry once with the current version.
- Enforce the grocery rules server-side: `list_items` returns items in insertion order; `add_item` rejects an empty `name` and any non-positive-integer `quantity` before mutation and returns guidance the companion can act on (correct the request or ask the user, with no invented values).
- Return structured, actionable errors — not stack traces — for at least: unauthenticated, not a member, unknown app, unknown operation, invalid arguments, and stale version.
- Write every tool call to the tool-call log (user, app, operation, app version, outcome, timestamp). Never log credentials or tokens.
- Bound all writes to the synthetic grocery fixture. Do not implement Gate 2 tools (`save_sandbox_definition`, `publish_test_revision`), a second app, a DataSkill interpreter, billing, or migrations tooling.

## Acceptance criteria

- [ ] An authenticated owner call to `list_apps` returns the grocery-list summary without pack instructions; an unauthenticated call is rejected.
- [ ] `get_pack` returns the Build, Run, and grocery packs by ID, each with its version, instructions, and (for the app pack) operation and argument definitions.
- [ ] Through `call_operation`, the owner can list items (insertion order) and add an item; the added item persists and appears in a later list.
- [ ] `add_item` with an empty name or an invalid quantity mutates nothing and returns actionable guidance.
- [ ] A `call_operation` carrying the previous `app_version` after a version bump mutates nothing and returns the `stale_version` response with current version and reload guidance.
- [ ] After the app-definition row is updated in Postgres to add a new operation (no function code change, no redeploy), `get_pack` shows it and `call_operation` executes it.
- [ ] A signed-in user without a membership row cannot list or mutate grocery items, and each rejected call is recorded.
- [ ] The tool-call log contains entries for the calls above with no credentials or tokens stored.

## Context

Governing plan: `ai/thoughts/plans/proof_of_concept.md` (Hypotheses, Smallest useful test fixture, Gate 1 tool contract). This is ticket 2 of 4 for Gate 1. It depends on `2026-10-27-01-poc-foundation-supabase-fixture.md` (schema, seed, packs, membership, preflight evidence). The OAuth consent page that makes real companion sign-in usable is the next ticket (`2026-10-27-03-poc-web-oauth-onboarding-consent.md`); this ticket may be verified with tokens obtained through Supabase Auth directly.

## Execution profile

- **Recommended:** Full 5-Step Pipeline
- **Confidence:** high
- **Rationale:** This ticket is an external protocol (MCP over Streamable HTTP), an authorization boundary (per-user membership enforcement), and a persisted-contract change (DB-driven operation definitions, version/stale semantics). Each is an explicit full-pipeline trigger.
- **Reassessment triggers:** If Supabase Edge Function constraints force the operation executor away from DB-driven definitions, stop for a developer decision; that choice determines whether the Gate 1 mid-test update can work at all.
