# Run Gate 1 on Muse and ChatGPT web and record the go/narrow/revise/stop evidence

## Outcome

Gate 1 has a recorded verdict. Both Gate 1 surfaces (Muse and ChatGPT web) have either completed the G1.1–G1.7 sequence against the live POC fixture or produced a precisely classified blocker, with redacted evidence a fresh reader can audit, and the resulting go/narrow/revise/stop decision is written down.

This is the experiment the POC exists for: whether ordinary users can connect, load current app instructions, and reliably use an app across conversations — not whether the fixture merely runs.

## Requirements

- Prepare the run materials before any companion is scored:
  - A version-2 fixture update artifact (the database definition update that adds `remove_item` to the grocery app and bumps it from version 1, per the foundation ticket's DB-driven definitions). Applying it must require no Edge Function redeploy, no companion reconnect, and no tool change.
  - A runbook in `poc/README.md` (or a linked POC runbook) giving the exact G1.1–G1.7 steps per surface, the exact prompts the user types, and how to capture redacted transcripts, tool-call traces, and server-side state.
  - One blank results worksheet per surface, using the plan's Results worksheet fields, stored in the repository (for example under `poc/fixtures/` or `poc/`).
- Run the sequence on both surfaces, each from a clean state: remove any prior Loomspan setup, use a fresh conversation with memory/project guidance disabled where possible, and record any context that cannot be cleared. The tester supplies only the onboarding prompt/URL for cold setup.
  - G1.1 Cold setup: record every click, consent, URL copy, configuration edit, restart, and troubleshooting step, with duration. Confirm an authenticated tool call.
  - G1.2 Pack delivery: record Run and Build pack retrieval, distinguishing persistent native installation from in-conversation loading and from any manual workaround. Build-pack retrieval alone is not Build workflow support.
  - G1.3 Select and use: explicit Loomspan selection, list the grocery summary, load its pack, default to production, and perform one read and one write through `call_operation`.
  - G1.4 Prove pack use: request behavior depending only on pack rules (alphabetical presentation with count header; asking for a missing quantity instead of inventing one). Merely returning pack text is not a pass.
  - G1.5 Fresh conversation: close the chat, start a new one, explicitly select Loomspan and reopen the grocery app. Confirm prior data persists, current instructions load without the old transcript or manual pasting, and perform another operation.
  - G1.6 Newly added operation: apply the version-2 update mid-run, then ask the companion to load and use `remove_item`. The MCP tools and connection must be unchanged.
  - G1.7 Stale version (basic): score separately from G1.6. A call carrying version 1 after the bump must be rejected before mutation with `stale_version` guidance; the companion then calls `get_pack`, retries once with version 2, and completes the request with exactly one write.
- Score pack delivery honestly everywhere: native installation, session loading, repeatable fresh-chat loading, and manual workaround are different outcomes and are never merged into one "installed" claim. Persistent native installation is not required to pass if repeatable on-demand loading works.
- Apply the plan's evaluation thresholds as recording requirements, not automatic verdicts: cold setup target 10 minutes with no user-authored code, hand-edited JSON/TOML, or secrets pasted into chat; returning use within one explicit Loomspan selection and one app request. Record latency, manual interventions, and wrong-app/wrong-environment calls. Stop spending on a failing surface after one documented setup attempt and one targeted correction, and record the unresolved blocker.
- Classify every blocker twice: by category (account/policy eligibility, transport/authentication, host discovery, instruction delivery/adherence, persistence, generic invocation, user friction) and by root cause (fixture, provider, companion, interoperability, unknown). An unavailable capability on a surface is an eligibility finding, not a runtime failure. Keep OAuth failures as cause-unconfirmed until checked against the reference flow proven in the web/OAuth ticket.
- Preserve redacted evidence per run: transcripts, tool-call traces, and server-side state changes. Never store credentials or tokens.
- Do not fix fixture defects inside this ticket. A defect in the MCP server, schema, packs, or web pages is recorded with evidence and routed back to its owning ticket; the run resumes only after that ticket's fix. Companion-behavior findings are results, not defects to engineer around mid-run.

## Acceptance criteria

- [x] The version-2 fixture update artifact and the per-surface runbook are in the repository, and applying the update changes no Edge Function code and requires no companion reconnect.
- [ ] A completed worksheet exists for Muse and for ChatGPT web covering every Results worksheet field, with G1.1–G1.7 each marked passed, failed, blocked, or not-run with a reason.
- [ ] Each surface's worksheet separately records cold-setup duration and manual steps, native-install vs session-load for Build/Run and for the app pack, and fresh-chat loading behavior.
- [ ] G1.6 and G1.7 are scored as separate results on each surface, with tool-log evidence of the new operation executing and of exactly one write after the stale-version retry.
- [ ] Every blocker recorded carries both a category and a root-cause attribution (or unknown), and every workaround states its added setup burden.
- [ ] The stored evidence contains no credentials or tokens.
- [ ] A Gate 1 exit decision is recorded using the plan's decision categories (proceed broadly, proceed with narrower support, revise pack delivery, or reconsider the central experience), citing the worksheet evidence for each surface.

## Context

Governing plan: `ai/thoughts/plans/proof_of_concept.md` (Gate 1, Proposed effort and usability gates, Results worksheet, Decision after the experiment). This is ticket 4 of 4 for Gate 1. It depends on `2026-10-27-03-poc-web-oauth-onboarding-consent.md` (live onboarding/consent and a proven reference OAuth flow). Gate 2 (validation feedback at scale, publication tools, additional apps, phone apps on iPhone/iPad, deferred Claude/Gemini web) is out of scope and gets its own tickets only after the Gate 1 decision recorded here.

## Execution profile

- **Recommended:** Fast-Track 2-Step Pipeline — Implementation & Review
- **Confidence:** medium
- **Rationale:** Intent, prompts, scoring, and thresholds are settled by the plan, and the affected area is bounded to run artifacts, worksheets, and evidence rather than a new system contract. The work is verification-heavy, so implementation plus independent review provides sufficient assurance.
- **Reassessment triggers:** If the run requires changing MCP server behavior, pack content semantics, schema, or web pages to proceed, stop and escalate to the Full 5-Step Pipeline under the owning ticket instead of fixing inside this run.

## Pipeline notes

- Companion interactions are performed by a human tester following the runbook; the pipeline prepares the run materials and records/analyzes the captured evidence. A surface that no human has actually run is recorded as not-run, never as passed.

## Execution notes

- 2026-10-28: Developer approved the Step 0 recommendation. Selected profile: `fast-track` (Fast-Track 2-Step Pipeline — Implementation & Review). Route: Step 4 (ticket-led, no research/plan artifacts) then fresh Step 5 review(s). Checkout at triage was clean on `main`; tickets 1–3 complete, ticket 4 not started. Upgrade trigger preserved: any need to change MCP server behavior, pack semantics, schema, or web pages stops this route and escalates to full under the owning ticket.
- 2026-10-28 (Step 4, fast-track): Run materials prepared. (1) Version-2 fixture update artifact `poc/fixtures/grocery-list-v2-update.sql`: DB-definition-only (inserts the `('grocery-list', 2)` definition adding `remove_item` as a generic `delete` effect matched by exact name, bumps `poc_apps.current_version` 1→2 and the grocery pack to version 2 naming `remove_item` while keeping the pack-only alphabetical/count/ask-for-quantity rules); guarded so re-applying is a no-op; no Edge Function code, redeploy, companion reconnect, or tool change. Proven locally: applied to a from-empty local Postgres (migration + v1 seed) with exit 0, post-apply app/pack at version 2 with operations `list_items, add_item, remove_item`, and a second application changed 0 rows. The Deno core suite proves the executor path (v2 `remove_item` executes; a version-1 call after the bump is rejected `stale_version` before mutation; `get_pack` + one version-2 retry completes with exactly one write). Hosted application is an operator mid-run step in the runbook, not yet performed.
- 2026-10-28 (Step 4): Per-surface runbook added to `poc/README.md` ("Gate 1 runbook (Ticket 4)") with exact G1.1–G1.7 steps and verbatim prompts per surface (Muse and ChatGPT web), evidence capture (redacted transcripts, tool-call traces, server-side state), honest pack-delivery scoring (native install vs session load vs repeatable fresh-chat load vs manual workaround), dual blocker classification (category + root cause) with workaround burden, thresholds as recording requirements, and the one-attempt-plus-one-correction stop rule. Blank results worksheets using every Results-worksheet field from `ai/thoughts/plans/proof_of_concept.md` are stored at `poc/fixtures/gate1-worksheet-muse.md` and `poc/fixtures/gate1-worksheet-chatgpt-web.md`.
- 2026-10-28 (Step 4): No human tester has run Gate 1 on either surface. Both worksheets are blank `not-run` templates (never pre-marked passed), and the Gate 1 exit decision is recorded in the runbook and worksheets as **pending / not-run** with the exact evidence required — no go/narrow/revise/stop verdict is fabricated from absent runs. Acceptance criteria that require actual human runs (completed worksheets, separate cold-setup/pack-delivery records, G1.6/G1.7 tool-log evidence, dual-classified blockers from real runs, stored redacted evidence, and the exit decision) remain unchecked. No fixture defect requiring an MCP-server, schema, pack-semantics, or web-page change was encountered, so the full-profile reassessment trigger was not hit; the version-2 pack-instruction update is part of the ticket's own fixture-update artifact, not a defect fix.
