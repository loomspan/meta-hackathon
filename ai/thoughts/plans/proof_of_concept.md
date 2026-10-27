# Loomspan Companion Feasibility Proof of Concept

## Purpose and status

**Status: Proposed experiment; not implemented or tested.**

Before investing in the full Cloud platform, establish whether ordinary users can connect their companions to Loomspan, obtain Build/Run guidance, load app-specific instructions, and reliably use an app across conversations.

The critical question is whether the complete experience is smooth enough for the intended audience. A developer making one successful tool call is insufficient evidence.

This plan follows [Companion Connection and App Discovery](../phases/011-companion-connection-and-app-discovery.md) and [Public Plugin Review and Named Operations](../phases/012-public-plugin-review-and-named-operations.md). Creating this plan does not establish a final API, supported-companion list, or implementation commitment.

## Planned test configuration

The test fixture is planned to run on Supabase with a static frontend on Cloudflare Pages:

- **Supabase project (decided):** the existing free nano-tier project **Loomspan Testing** at `https://yjrwyfkybszlpufsflan.supabase.co`.
- **Supabase Edge Functions** host the custom MCP server (one function exposing the generic tools below) over Streamable HTTP at `https://yjrwyfkybszlpufsflan.supabase.co/functions/v1/mcp`. This is a self-built MCP server following Supabase's [Deploy MCP servers](https://supabase.com/docs/guides/ai-tools/byo-mcp) guide; it is not the official Supabase MCP server that connects a coding agent to a Supabase project. No MCP code runs on Cloudflare.
- **Supabase Postgres** holds the fixture state: seeded apps, packs, memberships, synthetic records, app versions, and a tool-call log.
- **Supabase Auth** provides the owner and participant test identities and acts as the OAuth 2.1 authorization server for MCP clients, with dynamic client registration enabled so companions can register themselves. Tool calls run as the signed-in user, enforced server-side (RLS and/or explicit membership and version checks in the function).
- **Cloudflare Pages (decided):** the static pages are hosted on the already-existing site `https://loomspan.ai`, in the unlinked subdirectory `/poc/`. The onboarding page is at `https://loomspan.ai/poc/` and the OAuth consent page at `https://loomspan.ai/poc/oauth/consent`. "Unlinked" means only that the main site does not visually link to it; the pages are public, which is required, and unlinked is not access control. Source for these pages lives in this repository under `poc/web/` (see Repository structure below); the developer copies the static POC content into the separate Cloudflare Pages repository for `loomspan.ai` and pushes it to deploy. There is no automatic deployment from this repository to `loomspan.ai`. The consent page is a small client-side app using `supabase-js` with the public anon key only (never the service-role key): it preserves `authorization_id` through sign-in, loads the authorization details, shows the requesting client and requested access, and lets the user approve or deny the request. Supabase's Auth Site URL is set to the `https://loomspan.ai` origin and the Authorization Path to `/poc/oauth/consent`; per-commit preview origins are not used for OAuth testing because they do not match the configured Site URL. The static app must be built/served with the `/poc/` base path. Assumption to verify in a deployment smoke test: the main site has no SPA fallback or redirect rule that intercepts `/poc/` or `/poc/oauth/consent`.

This configuration is a test fixture choice, not a production platform commitment. Before building on it, verify in the Supabase project that the OAuth 2.1 server can be enabled (it is beta, available on all plans at the time of writing), that dynamic client registration can be turned on, and that JWT signing uses an asymmetric key (ES256 or RS256), since the MCP auth middleware rejects legacy HS256 tokens.

Initially classify failed OAuth discovery, dynamic registration, sign-in, consent, or token exchange as an **authentication/integration failure with cause unconfirmed**. Investigate fixture configuration, the consent page, Supabase behavior, the companion, and interoperability before attributing a cause. Check the fixture against a known-working client or reference flow and retain redacted evidence of the failing step. Record compatibility workarounds and their user burden explicitly; do not silently hide them or assume every failure is a companion limitation.

## Repository structure (decided)

All POC code in this repository lives under a single `poc/` directory off the project root, so the experiment is self-contained and deletable without touching the rest of the project:

```text
poc/
  mcp-server/   # Supabase Edge Function, migrations, and seed for the MCP server
  web/          # Source for the onboarding page and the OAuth consent page
  fixtures/     # Pack contents, seeded app definitions, and test data, if needed
  README.md     # Setup, deployment (including the manual copy to the loomspan.ai
                # Cloudflare Pages repository), and Gate 1/Gate 2 runbooks
```

The MCP server and the static web pages are separate deployables inside that one wrapper. Nothing POC-related is added at the project root.

## Hypotheses to test

1. A short onboarding prompt and URL can guide the user through connecting one generic Loomspan MCP server and obtaining the Build/Run packs, with acceptable manual setup.
2. The same connection supports Build and Run without per-app configuration.
3. A companion can discover lightweight app summaries and obtain the selected app's instructions and operation definitions through MCP.
4. It can use those instructions to invoke named operations through a generic executor, without a separately installed connector or manually registered tool for every app.
5. A new conversation can explicitly select Loomspan, rediscover the user's apps, and resume with current instructions without the previous transcript.
6. Updating an app or adding a new app does not require rebuilding the companion's Loomspan connection.

Natural-language recognition without explicit selection is a convenience test, not a baseline pass condition. Direct/custom installation and public Directory distribution are separate tracks; the latter remains unresolved.

## What “install a skill pack” means

Record these outcomes separately. Do not report all of them as installation:

| Outcome | Evidence required |
|---|---|
| Persistent native skill installation | The pack exists in the companion's supported skill mechanism and can be selected in a new conversation. Record who installed it and which host capability performed the installation. |
| Instructions loaded for the current conversation | The companion retrieves the pack through MCP and follows its app-specific guidance. No persistence is claimed. |
| Repeatable loading in a fresh conversation | Explicit Loomspan selection causes the companion to retrieve and use the pack again without manual pasting. |
| Manual workaround | The user pastes instructions, edits configuration, or adds each app separately. Record the burden rather than counting it as automatic delivery. |

Test whether an MCP-delivered pack can lead the companion to install it through a supported host capability, where available. Do not assume the remote MCP server can itself write into the companion's skill store. If persistent installation is unavailable, test repeatable on-demand loading as a distinct alternative.

## Candidate test matrix

These are proposed test targets, not verified capability claims. Confirm current setup instructions, account eligibility, and policies before each run. Test only through supported interfaces.

The intended audience is ordinary users, not full-scale developers. Developer/coding-agent surfaces are therefore not the target audience and are out of scope for this POC (decided).

| Companion surface | Why include it | Initial state |
|---|---|---|
| Muse (Meta, muse.ai) | Gate 1 surface selected by the developer. Confirm its remote MCP and OAuth setup path before counting any result. | Not tested |
| ChatGPT web | Test a conversational experience through a direct/custom connection. A paid ChatGPT web plan is available, so this is the Gate 1 conversational surface. | Not tested |
| Muse phone app (iPhone) | Gate 2 surface: same companion as a Gate 1 product, on an iPhone. Mirrors the Gate 1 selection so web-to-phone continuity is measured. Runs the full Gate 2 phone sequence, including cold setup on the device. | Not tested |
| ChatGPT phone app (iPhone) | Gate 2 surface: same companion as the Gate 1 conversational product, on an iPhone. Runs the full Gate 2 phone sequence, including cold setup on the device. | Not tested |
| Muse and ChatGPT apps (iPad) | Gate 2 secondary surface: shorter returning-use check only (explicit Loomspan selection, load the grocery app, one read and one write in a fresh conversation). An iPad-only failure is recorded as a separate surface result, not a phone failure. | Not tested |
| Claude web or desktop | Deferred candidate conversational companion, post-Gate 2. Only free-tier access is assumed; record eligibility and any connector limits as findings. Does not block Gate 1 or Gate 2. | Deferred |
| Gemini web | Deferred candidate conversational companion, post-Gate 2. A Google Gemini plan is available; confirm supported MCP/custom-connection setup and eligibility before counting any result. Does not block Gate 1 or Gate 2. | Deferred |
| Codex desktop, Claude Code, Antigravity | Developer/coding-agent surfaces. Explicitly out of scope: the target audience is ordinary users, not full-scale developers. | Out of scope |

Treat web, desktop, CLI, and mobile as separate surfaces. Do not infer mobile compatibility from a web success.

Record product/model version, account plan, workspace policy, available tools, and setup path. An unavailable feature is an eligibility finding, not proof that the server design is broken.

Gate 1 is Muse (Meta, muse.ai) and ChatGPT web only (decided). Gate 2 tests phone apps, mirroring Gate 1: the Muse and ChatGPT phone apps (decided). Gate 2 runs on Apple's mobile operating systems only: the iPhone runs the full Gate 2 phone sequence including cold setup on the device itself (connecting Loomspan from scratch in the phone app, with mobile setup burden recorded separately from returning use), and the iPad runs a shorter returning-use check. Android is recorded as untested and expands only if the Apple-device pass succeeds (decided). If a phone app cannot add a custom MCP connection, that is an eligibility finding, recorded rather than counted as a server failure. Claude web/desktop and Gemini web are deferred until after Gate 2 and block nothing. If a candidate is unavailable, record that eligibility result and select another; do not count it as a runtime failure.

## Smallest useful test fixture

Use one remotely reachable test MCP endpoint and synthetic data. Keep the endpoint and generic tool definitions unchanged across app additions and revisions. Per the planned configuration above, the endpoint is a Supabase Edge Function, persistent storage is Supabase Postgres, identities and MCP authorization come from Supabase Auth, and the web pages are served from `https://loomspan.ai/poc/` on Cloudflare Pages (copied manually from `poc/web/` in this repository to the separate `loomspan.ai` repository). No other hosting is required.

- A public onboarding page on Cloudflare Pages with companion-specific setup steps and a short copyable entry prompt.
- A small Build pack, a small Run pack, and independently retrievable app packs.
- Gate 1 starts with one seeded app (decided): a **grocery list**, chosen as the simplest throwaway fixture. It has one table of items (`name`, `quantity` as a positive integer). Pack version 1 offers `list_items` (read) and `add_item` (write). The pack — and only the pack — states that items are presented alphabetically with a count header (the server returns them in insertion order) and that the companion asks for a quantity instead of inventing one. The server rejects an empty name or a non-positive quantity before mutation. Mid-test, the operator adds `remove_item` as pack version 2 (see the fixture-update decision below). Gate 2 adds a second app with a different schema and presentation rules, then a third during testing. Their domains are test data, not platform features.
- Lightweight summaries followed by selected-app packs containing app ID, version, available named operations, argument definitions, and guidance.
- Gate 1 includes persistent synthetic data, basic validation, app/version identifiers, authenticated membership checks, and the basic stale-version mechanism: every `call_operation` sends `app_version`, and the server rejects a stale-version call before any mutation, returning the current version and directing the companion to call `get_pack` for a fresh pack and retry once with the new version. Gate 2 adds the full controlled version-change, stale-request, and recovery scenario in an older open chat (G2.4).
- A controlled app-definition change that adds an operation after the companion connection has been configured.
- Gate 1 uses an authenticated test owner with membership rows in Postgres; Gate 2 adds the participant identity and negative authorization cases. The authentication path must exercise the real Supabase OAuth 2.1 connection and authorization flow (including the Cloudflare Pages consent page); a no-auth transport smoke test alone cannot pass Gate 1.

Gate 1 uses only these candidate tools. Names and shapes are the POC contract for the fixture, not final product contracts:

```text
list_apps                    -> lightweight summaries
get_pack                     -> Build, Run, or selected-app instructions
call_operation               -> app ID, environment, version, operation, arguments
```

A stale-version `call_operation` is rejected before mutation and returns a response of this shape, directing the companion to reload and retry once:

```json
{"ok": false, "error_code": "stale_version", "current_version": 2,
 "guidance": "Call get_pack for this app, then retry once with the current app_version."}
```

Gate 2 adds bounded Build/publication fixture tools:

```text
save_sandbox_definition      -> bounded test definition change, owner only
publish_test_revision        -> promote the controlled fixture revision
```

Gate 1 can serve the small Build pack to check delivery without implementing a publishing workflow. The test operator adds the new fixture operation directly to the server-side definition and pack through a controlled fixture update; this must not require changing the companion's MCP tools or connection. Full Build behavior is tested in Gate 2.

**Fixture-update mechanism (decided):** app definitions and packs live in Postgres, and `call_operation` reads operation definitions from the database rather than from code compiled into the Edge Function. The mid-test G1.6/G1.7 update is an edit to the app-definition row that adds `remove_item` and bumps the grocery app to version 2. No Edge Function redeploy, no companion reconnect, and no tool change. That same version bump triggers the G1.7 stale-version rejection for calls still carrying version 1.

The generic executor deliberately tests the uncertain runtime model. It is not a public Directory submission design. Server-side permissions apply regardless of instructions. Bound fixture writes to synthetic records and definitions; a production DataSkill interpreter, billing, full migrations, and invitation delivery are unnecessary for this experiment.

## Two-gate run sequence

Use a clean test profile or remove the prior Loomspan setup. Start fresh conversations with memory/project guidance disabled where possible, and record any context that cannot be cleared. Use the same pack contents across hosts except for a small documented entry/setup adapter.

### Gate 1 — Is the central experience viable?

Run this gate on the two Gate 1 surfaces, Muse and ChatGPT web, before building the broader workflow fixture.

| Test | User action | Required observation |
|---|---|---|
| G1.1 Cold setup | Supply only the onboarding prompt/URL and ask to connect Loomspan. | Record every click, consent, URL copy, configuration edit, restart, and troubleshooting step. Confirm an authenticated tool call. |
| G1.2 Pack delivery | Ask to obtain Run guidance and open the seeded app; also check retrieval of the small Build pack. | Distinguish native installation from context loading and record intervention. Build-pack retrieval alone does not establish Build workflow support. |
| G1.3 Select and use | Explicitly select Loomspan and use the seeded app. | List its summary, load its pack, default to production, and correctly perform a read and a write through the generic executor. |
| G1.4 Prove pack use | Request behavior that depends on a rule present only in the selected pack. | Observe required presentation or clarification behavior, correct operation name/arguments, and server logs. Merely returning pack text is not a pass. |
| G1.5 Fresh conversation | Close the chat and start a new one. Explicitly select Loomspan and open the same app. | Recover current instructions without the old transcript, manual pack pasting, rejoining, or per-app connector setup. Confirm previous data persists and perform another operation. |
| G1.6 Newly added operation | The test operator adds an operation and updates the pack after connection setup; ask the companion to load and use it. | The companion retrieves the updated pack and invokes the new operation through unchanged MCP tools, without manually registering tools or rebuilding the connection. |
| G1.7 Stale version (basic) | Submit a call with the previous app version after the pack has been bumped (this may share the G1.6 version bump, but is recorded separately). | Server rejects before mutation with `stale_version`, the current version, and reload guidance; the companion calls `get_pack`, retries once with the current version, and completes the request with exactly one write. |

**Gate 1 exit:** Both Gate 1 surfaces (Muse and ChatGPT web) complete the sequence with recorded setup burden and correct behavior. Persistent native installation is not required if repeatable on-demand loading works. Resolve fixture defects before interpreting host results. If only one surface passes, record a narrow-support result and investigate one alternative conversational surface before expanding the fixture. If reliable loading or generic invocation fails, pause Gate 2 and identify a credible remedy.

### Gate 2 — Does the broader workflow hold up?

After Gate 1 passes, add the remaining fixture pieces and broaden the companion sweep to phone apps. Run the Gate 1 sequence on newly added surfaces before evaluating their Gate 2 behavior.

| Test | User action | Required observation |
|---|---|---|
| G2.1 Validation feedback | Submit a fixture write that violates a rule. | No invalid mutation; companion uses returned guidance to correct the request or ask the user, without invented values. |
| G2.2 Build and publication | As owner, ask to edit the app definition in sandbox and publish the controlled revision. As participant, attempt the administrative actions. | Owner follows Build guidance and the sandbox/publication path; participant is denied by the server. Ordinary data edits remain Run operations. |
| G2.3 Additional apps | Add a second app with different instructions, then add a third after connection setup. | Discover and use each through unchanged generic tools, without per-app configuration. Load the selected app's instructions and keep data/app targeting correct. |
| G2.4 Stale instructions | Publish a new version while an older chat is open, then submit an old-version call. | Server rejects before mutation with `stale_version` and reload guidance; companion calls `get_pack`, reloads instructions, and submits an appropriate request without duplicate writes. This is the full recovery scenario; G1.7 covers only the basic mechanism. |
| G2.5 Interruption and access loss | Interrupt loading, then retry; subsequently revoke test membership. | Loading can resume; cached packs do not permit operations after revocation. Record host-specific reconnect requirements. |
| G2.6 Repeatability and usability | Repeat select/load/use/fresh-chat three times on promising candidates, including one run by someone who did not build the fixture. | Each repeat works; capture latency, manual intervention, and errors. Persistent-installation claims also survive a host restart; session loading succeeds by re-fetching. |

After the explicit-selection path works, try generic and Loomspan-branded requests in fresh chats. Also try ambiguous app names. Measure routing quality separately from the baseline.

**Gate 2 exit:** Apply the decision criteria below using both gates' results. Gate 1 success alone is an initial feasibility result, not a claim of full Build/Run support or broad companion compatibility.

## Proposed effort and usability gates

These are initial evaluation thresholds, not accepted product requirements. Record the evidence even when a threshold is missed.

- Timebox the initial Gate 1 sweep to roughly one working day once its minimal fixture is ready. Do not build Gate 2's publication workflow or run the phone-app sweep before Gate 1 establishes feasibility. Stop spending on a failing host after a documented setup attempt and one targeted correction; record the unresolved blocker without assigning an unsupported cause.
- Target cold setup within 10 minutes, with no user-authored code, hand-edited JSON/TOML, or secret values pasted into chat. Normal account login, consent, and connector URL entry are acceptable steps to measure.
- Target returning use within one explicit Loomspan selection and one app request, with no repeated setup or instruction copying.
- In Gate 2, require the three repeat runs to succeed on each proposed supported host. Record latency, manual interventions, wrong-app/environment calls, and any pack-format changes required.
- Keep authentication and membership enforcement in Gate 1. Gate 2 explicitly tests unauthorized and stale-version mutation rejection. A smooth presentation cannot compensate for an incorrect write, and an untested check must not be reported as passed.

## Results worksheet

Complete one record per surface and repeat run. Preserve redacted transcripts, tool-call traces, and server-side state changes; do not store credentials or tokens.

| Field | Result |
|---|---|
| Companion, surface, model/version, account plan | Not tested |
| Gate and test IDs completed; deferred tests | Not tested |
| Setup prerequisites and initial state | Not tested |
| Cold setup duration and manual steps | Not tested |
| Build/Run: native install vs session load | Not tested |
| App pack: native install vs session load | Not tested |
| Fresh-chat loading and restart behavior | Not tested |
| Newly added app/operation through unchanged MCP | Not tested |
| Version refresh, permissions, and write correctness | Not tested |
| Explicit selection and optional natural-language routing | Not tested |
| Repeated-run results and evidence locations | Not tested |
| Blocker category and smallest viable remedy | Not tested |
| OAuth/integration failure step, evidence, and attribution confidence | Not tested |

Classify blockers as account/policy eligibility, transport/authentication, host discovery, instruction delivery/adherence, persistence, generic invocation, or user friction. Keep failure category separate from root cause: fixture, provider, companion, interoperability, or unknown. Attribute OAuth failures only after investigation, including checking against a known-working client or reference flow. Document any workaround and its added setup burden. Distinguish fixture defects from host limitations.

## Decision after the experiment

- **Proceed with the broad companion model:** At least two independent companion products pass, including a conversational surface suitable for nontechnical users. Document the supported surfaces and exact setup burden.
- **Proceed with narrower support:** Only one Gate 1 host passes, or only one audience segment is reachable. Reassess the audience and onboarding promise before investing in the full platform.
- **Revise pack delivery:** Native app-skill installation fails, but automatic loading on selection and fresh-chat reloading work. Consider making repeatable loading the supported behavior; do not claim persistent installation.
- **Reconsider the central experience:** Hosts require repeated manual instruction copying, per-app connector/tool setup, or cannot reliably follow loaded packs and invoke newly published operations. Stop further platform expansion until there is a credible remedy.

Failure of one companion or public Directory review is not automatically failure of the whole concept. Failure of low-friction, repeatable app loading across the intended audience is a core product risk. Record the resulting go/narrow/revise/stop decision explicitly after testing.

## Related open work

- **COMPANION-DISCOVERY-001:** Explicit selection and subsequent loading on each supported host.
- **PLUGIN-COMPATIBILITY-001:** Public Directory distribution remains a separate evaluation; direct configuration success does not establish public approval.
- **PACK-DELIVERY-001:** Determine whether native installation is needed or whether reliable MCP-delivered, on-demand instructions satisfy the product experience. Keep this open until evidence and a product decision exist.
