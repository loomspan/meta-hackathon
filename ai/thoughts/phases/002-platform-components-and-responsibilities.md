# Loomspan Cloud — Platform Components and Responsibilities

## Status and purpose

This document continues the [product exploration](000-loomspan-cloud-product-exploration.md) and [micro app design intent](001-micro-app-design-intent.md).

It records the project owner's component outline as a starting point for architecture discussions. It is not a finalized architecture, implementation plan, or commitment to every capability mentioned. Tentative approaches and future possibilities retain that status. Logical components described here do not imply separate deployed services.

The comparison and questions at the end are discussion prompts, not additional agreed requirements. Suggestions from the assistant are not adopted merely because they appeared in the conversation.

## 1. AI companion and skill packs

### Intended Build and Run tracks

The AI companion assists with both building and running micro apps. Loomspan Cloud is intended to support two distinct tracks through Loomspan-maintained skill packs:

- **Build skill pack:** Gives the companion the knowledge needed to build, publish, and update micro apps.
- **Run skill pack:** Provides the standard running components common to apps, including how to interact with Loomspan. It also directs the companion to download the selected micro app's specific skill pack.

The **micro app-specific skill pack** describes the app's business and presentation logic and what data is available. It is distinct from the common Run skill pack maintained by Loomspan.

### Tentative entry flow

The project owner proposed a master skill that helps the companion determine whether it is in Build or Run mode and, for Run mode, which app it is running. It would then direct the companion to download the appropriate Build or Run skill pack.

This is a likely approach, not a finalized discovery or routing design. Mode switching, app selection, and the mechanics of downloading skill packs remain undefined.

## 2. Application management

The intended responsibilities include publishing and creator-controlled updates, with forking already identified as an intended capability in the design-intent document.

### Change history and a Git-like workflow

The project owner wants to explore a Git-like workflow for app builders without requiring people to understand version control. The framework should make the companion aware of that workflow and teach it how to use it.

One intended use is helping the companion understand what changed when a user makes a mistake or wants to backtrack on a feature. That history could inform how the companion reverses or revises earlier changes.

This does not establish Git as the implementation, define branching or commit behavior, or promise an automatic rollback feature. How history relates to publication, schema changes, and forks remains open.

### Companion-assisted backups

The project owner wants users to be able to perform backups through their companions. Readable text is the proposed form that could help a companion inspect previous data and assist with repairs.

The current expectation is that a dedicated restore feature may not be supported initially. The possibility that a companion could use a readable backup to repair data is an intended benefit to explore, not a guarantee of recovery.

Backup contents, format, storage location, consistency, and the repair process have not been specified.

## 3. Skill hosting, delivery, and app discovery

The initial direction is to support **sharing and inviting** as ways for people to access apps.

A directory where creators publish apps for anyone to browse, search, and use is a **future possibility**, not an initial requirement.

The mechanisms for invitations, access to shared apps, skill delivery, and updates remain to be designed. Sharing an app's functionality continues to be distinct from its data-sharing strategy.

## 4. MCP interfaces

The tentative direction is to provide separate **Build** and **Run** remote MCP interfaces, likely authenticated through Supabase Auth.

The project owner hopes the Run MCP can be general enough for every app on the platform to use the same MCP interface. This is an architectural objective to investigate, not a confirmed topology or tool design.

Authentication flows, tool definitions, app context, and the relationship between logical interfaces and deployed servers remain unresolved.

## 5. Hosted skill execution and primitives

The initial intention is to support a limited set of hosted skills. That set could grow as users build more varied apps and Loomspan exposes additional primitives.

The discussion does not establish support for users publishing arbitrary executable code or new executable skill implementations. That boundary remains open.

### Data skills

Supabase is the intended initial data platform.

The project owner wants to consider generalizing data skills so they could support other platforms or database types later. Whether and how to introduce that abstraction remains a design question; additional backends are not an initial commitment.

Data operations, schema representation, and storage structure have not been defined.

### TypeSafe skills

The project owner proposed including access to the Loomspan framework's TypeSafe skills using a Loomspan-provided service key. The proposal is motivated by the owner's assessment that typesafe.ai is inexpensive.

This document records that rationale without validating pricing or cost assumptions. Inclusion, credential handling, usage boundaries, and the role of these skills in micro apps remain open for discussion.

### Validation skills or validation attached to skills

Validation could be a new skill type or something like a decorator applied to skills generally. Neither approach has been chosen.

Candidate rule types mentioned by the project owner include:

- Not-null checks.
- Data-type checks.
- TypeSafe checks.
- Regular-expression checks.
- Other validation that can make micro app behavior more deterministic without incurring AI costs on the cloud platform.

These are candidates to consider, not a finalized validation feature set. Earlier discussion also included validation with retries; the location, limits, and behavior of those retries remain undefined.

The relationship between the TypeSafe proposal and the aim of validation without cloud AI costs needs clarification. No conclusion about TypeSafe's execution or cost model is assumed here.

## 6. Identity, sharing, and data access

The project owner expects detailed exploration of this area to depend on a stronger understanding of the data skills.

One possibility is that data-access strategies attach to data skills. That is an idea to investigate, not an accepted enforcement architecture.

The previously proposed Share Nothing, Owner Edit / Everyone Read, and Share Everything strategies remain the starting examples. Their implementation, extensibility, and relationship to identity and authorization remain unresolved.

## 7. Comparison with the earlier component outline

The following comparison identifies what the new outline clarifies and what still needs discussion. It does not introduce additional platform requirements.

| Earlier discussion area | Current understanding |
|---|---|
| Companion and builder/admin skills | Expanded into common Build and Run skill packs, a micro app-specific pack, and a tentative master skill. |
| Published micro app definition | Several constituent artifacts have been described, but their packaging and relationships remain undefined. |
| Application management | Adds a desired Git-like workflow and companion-assisted backups; detailed publication, evolution, and fork mechanics remain open. |
| Skill hosting and delivery | Sharing and inviting are the initial direction; a browsable directory is a future possibility. Delivery mechanics remain open. |
| MCP interfaces | Tentative Build and Run remote interfaces, likely Supabase Auth, and a desired common Run MCP across apps. |
| Hosted execution | Initial candidates are data skills, TypeSafe skills, and validation capabilities. The boundary for adding executable skills remains open. |
| Validation and retries | Candidate checks and possible integration models are identified; execution and retry behavior remain open. |
| Identity and data access | Further exploration depends on data-skill design; attaching strategies to data skills is one possibility. |
| Persistence and schema management | Supabase is the initial direction; data layout, schema changes, and their relationship to app history and backups need discussion. |
| Web interface | Mentioned in the original handoff; its role and initial scope have not been developed in this component discussion. |

## 8. Questions for subsequent discussions

- What operations and configuration does an initial data skill expose?
- How does a data skill relate to the app's schema and chosen data-access strategy?
- What precisely is published as a micro app, and which artifacts change together?
- How does the common Run MCP select and operate within the correct app context?
- Does app building initially compose and configure provided primitives, and what would adding a new primitive involve?
- Where do validation and retries occur, and how do they interact with skill execution?
- What does app change history record, and how can the companion use it to help correct a change?
- What does a readable backup contain, and what repair capabilities are realistically supported?
- How do Build and Run authentication and authorization relate to creator and participant responsibilities?

These questions identify unfinished design work. They are not decisions, a prioritized roadmap, or authorization to implement the platform.
