# Establish the POC foundation: Supabase preflight, repository scaffold, and grocery-list fixture data

## Outcome

The Loomspan companion feasibility POC has a verified foundation to build on. The existing Supabase project is confirmed (or conclusively blocked) as an MCP OAuth host, this repository contains the self-contained `poc/` scaffold, and Postgres holds the version-1 grocery-list fixture — app definition, packs, membership, synthetic items, and a tool-call log — ready for the MCP server ticket that follows.

Without this, every later POC ticket would be built on unverified beta platform behavior and an undefined data shape.

## Requirements

- Use the existing free nano-tier Supabase project **Loomspan Testing** at `https://yjrwyfkybszlpufsflan.supabase.co`. Do not create a replacement project.
- Before any fixture is treated as buildable, verify in that project and record redacted evidence for each item: the OAuth 2.1 authorization server can be enabled, dynamic client registration can be turned on, and JWT signing uses an asymmetric key (ES256 or RS256), not legacy HS256. If any item cannot be enabled, stop and record it as an authentication/integration blocker with cause unconfirmed; do not design around it inside this ticket.
- Create the POC scaffold in this repository exactly as: `poc/mcp-server/`, `poc/web/`, `poc/fixtures/` (if needed), and `poc/README.md`. Nothing POC-related is added at the project root. The README records setup steps and the preflight evidence.
- Persist app definitions and packs in Postgres. The MCP executor in the next ticket reads operation definitions from the database, so no operation behavior may depend solely on definitions compiled into function code.
- Seed one app, the grocery list, at pack version 1:
  - One items table/concept with `name` and `quantity`.
  - Operations `list_items` (read) and `add_item` (write), defined in the stored app definition with argument definitions.
  - `list_items` returns items in insertion order. Alphabetical presentation is a pack rule, not a server behavior.
  - Server-side validation rejects an empty `name` and any `quantity` that is not a positive integer, before mutation.
- Store three independently retrievable packs: a small Build pack, a small Run pack, and the grocery-list app pack. The grocery pack — and only the pack — states that items are presented alphabetically with a count header, and that the companion asks the user for a quantity instead of inventing one.
- Seed an authenticated test owner identity with a membership row granting access to the grocery app. Credentials, tokens, and secret keys are never committed to the repository; identity creation steps that require the Supabase dashboard are documented in the README for the developer to perform.
- Provide a tool-call log table that later tickets write to. It must be able to record the authenticated user, app, operation, app version, outcome, and timestamp without storing credentials or tokens.
- Only synthetic grocery data is used. No real user data, no billing, no invitation delivery, no production platform schema design.

## Acceptance criteria

- [x] Redacted preflight evidence is recorded in `poc/README.md` showing OAuth 2.1 server availability, dynamic client registration availability, and asymmetric JWT signing for Loomspan Testing — or the specific unavailable item is recorded as a blocker with cause unconfirmed.
- [x] `poc/` exists with the structure above, and no POC files exist at the project root.
- [x] Migrations/seed in the repository recreate the fixture from an empty schema: grocery app definition at version 1 with `list_items` and `add_item`, Build/Run/grocery packs retrievable as stored records, owner membership, seeded synthetic items, and the tool-call log table.
- [x] The stored grocery pack contains the alphabetical-with-count-header rule and the ask-for-quantity rule; the seeded server data and definition do not implement alphabetical ordering.
- [x] No credential, token, service-role key, or secret value appears anywhere in the committed scaffold, migrations, seed, or README.

## Context

Governing plan: `ai/thoughts/plans/proof_of_concept.md` (Planned test configuration, Repository structure, Smallest useful test fixture). This is ticket 1 of 4 for Gate 1 and has no ticket dependencies. The MCP server is the next ticket (`2026-10-27-02-poc-mcp-server-gate1-tools.md`); the web/OAuth pages and the Gate 1 run follow it. Gate 2 scope (publication tools, second/third apps, phone apps) is explicitly excluded here.

## Execution profile

- **Recommended:** Full 5-Step Pipeline
- **Confidence:** high
- **Rationale:** This ticket verifies beta external-platform behavior (Supabase OAuth 2.1, dynamic registration, JWT signing) and establishes the persisted app-definition and pack contracts every later ticket depends on. Material discovery remains, and a wrong foundation invalidates all downstream work.
- **Reassessment triggers:** If the preflight shows a required OAuth capability is unavailable on the nano-tier project, stop for a developer decision instead of re-scoping the fixture inside the pipeline.

## Pipeline notes

- Manual Supabase dashboard actions by the developer (enabling auth features, creating the test owner identity) are expected inputs to this ticket, documented in the README; they are not a reason to mark automated acceptance criteria as passed without the recorded evidence.
