# Gate 1 Results Worksheet — Muse (muse.ai)

Status: **not-run**. No human tester has run Gate 1 on this surface yet.
Every result below is `not-run` with that reason; do not change a result to
passed/failed/blocked without redacted evidence from an actual run.
Follow the runbook in [poc/README.md](../README.md) ("Gate 1 runbook
(Ticket 4)"). Never store credentials or tokens in this file.

## Results worksheet (one record per surface and repeat run)

| Field | Result |
| --- | --- |
| Companion, surface, model/version, account plan | not-run — Muse (muse.ai); model/version and account plan to be recorded at run time |
| Gate and test IDs completed; deferred tests | not-run — no G1 test completed; none deferred yet |
| Setup prerequisites and initial state | not-run — clean state not yet established (remove prior Loomspan setup; fresh conversation; memory/project guidance disabled where possible; record anything that cannot be cleared) |
| Cold setup duration and manual steps | not-run — record every click, consent, URL copy, configuration edit, restart, and troubleshooting step, with duration (target: 10 minutes, no user-authored code, no hand-edited JSON/TOML, no secrets pasted into chat) |
| Build/Run: native install vs session load | not-run — score Build pack and Run pack separately (see pack-delivery scoring) |
| App pack: native install vs session load | not-run — score the grocery-list app pack separately from Build/Run |
| Fresh-chat loading and restart behavior | not-run — G1.5 not attempted |
| Newly added app/operation through unchanged MCP | not-run — G1.6 (`remove_item`, version 2) not attempted |
| Version refresh, permissions, and write correctness | not-run — G1.7 not attempted; membership/authenticated-call evidence not yet captured on this surface |
| Explicit selection and optional natural-language routing | not-run — explicit Loomspan selection is the baseline; natural-language routing is optional and scored separately, never as the baseline |
| Repeated-run results and evidence locations | not-run — record transcript, tool-call trace, and server-side state locations per run (redacted) |
| Blocker category and smallest viable remedy | not-run — no blocker recorded; see blocker classification table (dual classification is mandatory for every blocker) |
| OAuth/integration failure step, evidence, and attribution confidence | not-run — any OAuth failure stays cause-unconfirmed until checked against the ticket-3 reference flow |

## Per-test results (G1.1–G1.7)

Score each test exactly one of: passed, failed, blocked, not-run (with a reason).

| Test | Result | Reason / evidence location |
| --- | --- | --- |
| G1.1 Cold setup | not-run | No human run on this surface yet |
| G1.2 Pack delivery | not-run | No human run on this surface yet |
| G1.3 Select and use | not-run | No human run on this surface yet |
| G1.4 Prove pack use | not-run | No human run on this surface yet |
| G1.5 Fresh conversation | not-run | No human run on this surface yet |
| G1.6 Newly added operation | not-run | No human run on this surface yet; scored separately from G1.7 |
| G1.7 Stale version (basic) | not-run | No human run on this surface yet; scored separately from G1.6; requires tool-log evidence of `stale_version` rejection before mutation, one `get_pack`, one retry at version 2, and exactly one write |

## Pack-delivery scoring (never merge these outcomes)

For each pack, record exactly one outcome plus who performed it and the host
capability used: `persistent native installation`, `instructions loaded for
the current conversation` (session load), `repeatable loading in a fresh
conversation`, or `manual workaround` (record the added burden; never count
it as automatic delivery). Persistent native installation is not required to
pass if repeatable on-demand loading works.

| Pack | Outcome | Evidence |
| --- | --- | --- |
| Build pack | not-run | — |
| Run pack | not-run | — |
| Grocery-list app pack | not-run | — |
| Fresh-chat reload of the app pack (G1.5) | not-run | — |

## Run measurements

| Measurement | Result |
| --- | --- |
| Cold setup duration (target 10 minutes) | not-run |
| Cold setup manual steps (clicks, consents, URL copies, config edits, restarts, troubleshooting) | not-run |
| User-authored code / hand-edited JSON/TOML / secrets pasted into chat (target: none) | not-run |
| Returning use: explicit selections and app requests needed (target: one selection + one request) | not-run |
| Latency observations | not-run |
| Manual interventions during G1.2–G1.7 | not-run |
| Wrong-app / wrong-environment calls | not-run |
| Setup attempts used (stop after one documented attempt + one targeted correction) | not-run |

## Blocker classification (complete one row per blocker)

Classify every blocker twice. Category: account/policy eligibility,
transport/authentication, host discovery, instruction delivery/adherence,
persistence, generic invocation, or user friction. Root cause: fixture,
provider, companion, interoperability, or unknown. An unavailable capability
is an eligibility finding, not a runtime failure. OAuth failures stay
cause-unconfirmed until checked against the ticket-3 reference flow.

| Blocker | Category | Root cause (or unknown) | Workaround and added setup burden | Smallest viable remedy |
| --- | --- | --- | --- | --- |
| none recorded | not-run | not-run | none | — |

## Decision after the experiment

Decision: **pending / not-run**. This surface has not been run, so no
go/narrow/revise/stop verdict can cite worksheet evidence for it.
Required before a decision: a completed G1.1–G1.7 run (or precisely
classified blockers) on both Muse and ChatGPT web, with redacted
transcripts, tool-call traces, and server-side state.

Decision categories (from the plan, applied only after both surfaces run):

- Proceed broadly (proceed with the broad companion model): at least two independent companion products pass, including a conversational surface suitable for nontechnical users.
- Proceed with narrower support: only one Gate 1 host passes, or only one audience segment is reachable.
- Revise pack delivery: native installation fails, but automatic loading on selection and fresh-chat reloading work; do not claim persistent installation.
- Reconsider the central experience (stop): hosts require repeated manual instruction copying, per-app connector/tool setup, or cannot reliably follow loaded packs and invoke newly published operations.

Evidence cited for this surface: none — not-run.
