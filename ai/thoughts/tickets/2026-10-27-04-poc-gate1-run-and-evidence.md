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

- [ ] The version-2 fixture update artifact and the per-surface runbook are in the repository, and applying the update changes no Edge Function code and requires no companion reconnect.
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
