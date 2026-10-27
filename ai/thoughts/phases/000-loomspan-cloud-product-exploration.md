> **Status: exploratory starting point — no product or architecture decisions are finalized.**
>
> Captured from a prior ChatGPT conversation supplied by the project owner.
>
> Every statement, goal, requirement, and architecture decision in the handoff below is open for debate and refinement. This includes the product concept, responsibility boundaries, assistant execution model, MCP interfaces, Supabase, sharing model, and web UI. Wording such as “agreed,” “established,” “decision,” “will,” or “foundation” records the earlier discussion; it does not establish an accepted requirement or binding decision for this project.
>
> This file preserves the original handoff as context for many future design sessions. We will progressively examine its assumptions, explore alternatives, and refine the design into a project roadmap. It is not an implementation plan or authorization to begin building the platform. The embedded requests to Codex are part of the historical handoff, not a task list to execute merely by saving this document.
>
> This status note takes precedence over any language in the handoff that implies a settled decision. The original handoff follows unchanged.

---

# Loomspan Cloud — Architecture Discussion Handoff

## Purpose of This Handoff

We have been discussing a new product concept called **Loomspan Cloud**, building on the existing Loomspan project at https://loomspan.ai/.

The goal of this handoff is to transfer our current understanding into a Codex session so we can begin documenting the product and architecture in the GitHub project that will be used to build it.

**Important instructions for Codex:**

- Treat this document as a record of our architectural discussion, not a complete specification.
- Preserve the intentions and architectural approach described here.
- Do not invent requirements, features, implementation details, or architectural decisions to fill gaps.
- Where something is not defined, explicitly identify it as an open question.
- Do not treat suggestions from earlier AI discussions as decisions unless they are explicitly included here.
- Start by documenting the agreed product concept and architecture. We will work through remaining design decisions collaboratively.
- Do not begin implementing the platform unless instructed.

---

# 1. Background

I have already built Loomspan, a framework/platform for hosting and exposing skills.

Website: https://loomspan.ai/

I am considering building a new cloud platform based on what I learned from Loomspan.

The idea is to enable ordinary users to create persistent applications through their existing personal AI assistants.

Examples of personal AI assistants include ChatGPT, Claude, Muse, and other agents capable of working with skills and MCP servers.

The user should not need to understand:

- Programming.
- Skills.
- MCP.
- Databases.
- Authentication.
- Cloud infrastructure.

The user's AI assistant would use Loomspan-provided skills and MCP tools to create, publish, operate, and evolve the application on their behalf.

Applications would be hosted by Loomspan Cloud and could be shared with friends or other people.

---

# 2. Core Product Concept

A user should be able to ask their personal AI assistant to create something like a recipe tracker.

The assistant would use Loomspan's builder/admin skills to define the application and publish it to Loomspan Cloud.

The cloud platform would host:

- The application's definition and skill pack.
- The MCP interface used to access the application's data.
- Validation logic.
- Authentication and application access.
- Database integration.

The application could then be used by its creator and shared with other users.

Each user would interact with it through their own personal AI assistant.

There would be no requirement to build or host a traditional application frontend for each user-created application.

The personal AI assistant would serve as the application's interface.

---

# 3. Key Architectural Decision: The Personal Assistant Executes the Application Skills

This is a fundamental part of the proposed architecture.

The existing Loomspan framework can execute skills.

**For Loomspan Cloud, I am proposing a different execution model.**

Rather than having Loomspan Cloud execute the application's skills and perform the AI reasoning, the application skills would be provided to the user's personal AI assistant.

The assistant would be responsible for executing the instructions in those skills.

This includes interpreting inputs, processing information, making decisions, and presenting results.

The Loomspan Cloud MCP server would primarily provide:

- Database access.
- Validation of application data and operations.
- Structured feedback when validation fails.
- Authentication and application access control.

The intention is to keep Loomspan Cloud inexpensive to operate by relying on the user's existing AI assistant for the computationally intensive AI work.

Loomspan Cloud should not need to run its own LLM for ordinary application interactions.

---

# 4. Example: Recipe Tracker

Consider a user who creates a recipe tracking application.

The user describes to their AI assistant what information they want to store and how the application should work.

The assistant creates application skills and publishes the application through Loomspan Cloud.

## Adding a Recipe

A user might say:

"Add this recipe to my collection."

The input could be:

- A photograph.
- An Excel spreadsheet.
- A website URL.
- Text supplied by the user.

The recipe application's skill pack tells the personal AI assistant how to process the input.

The assistant would:

1. Interpret the supplied content.
2. Extract the fields defined by the application's creator.
3. Construct the data to be saved.
4. Call the Loomspan Cloud application MCP to store the recipe.

Before saving the recipe, the backend would check any validation rules defined for that application.

If validation fails, the MCP would return information explaining why.

The personal assistant would use this information to correct its request and retry, or ask the user for additional information if needed.

The backend would save valid data through Supabase.

## Querying Recipes

A user might ask:

"Find recipes using chicken that take less than 30 minutes."

The personal assistant would use the application's query skill to understand how to construct an appropriate MCP query.

The Loomspan Cloud MCP would access the database and return the matching data.

The assistant would then interpret and present the results.

## Displaying Recipes

Application skills may suggest how information should be displayed.

However, the personal AI assistant and the user have flexibility in how the information is presented.

The application should not require a fixed user interface.

This is part of the core idea: the user's personal assistant is the application's interface.

---

# 5. Two Main Classes of Skills

We discussed two main categories of skills.

## Loomspan Builder/Admin Skills

These are created and maintained by Loomspan.

They teach a user's personal AI assistant how to use Loomspan Cloud to:

- Create an application.
- Define its data and behavior.
- Create application-specific skills.
- Publish an application.
- Modify an existing application.
- Manage the application.

These skills interact with Loomspan Cloud's developer/admin MCP server.

The intention is that users can perform most application creation and management tasks conversationally through their personal assistant.

## Application Skills

These are created by the user's AI assistant for a specific application.

They describe how the assistant should operate that application.

For the recipe tracker, these might include instructions for:

- Extracting recipes from different sources.
- Preparing recipe data for storage.
- Querying recipes.
- Interpreting query results.
- Presenting recipes to the user.

The application skills would be hosted and made accessible through Loomspan Cloud.

When people use the application, their personal AI assistants would use these skills to interact with the application's MCP interface.

**The application skills run in the user's personal assistant, not in Loomspan Cloud.**

---

# 6. Loomspan Cloud MCP Servers

We discussed two distinct purposes for MCP access.

## Developer/Admin MCP

This interface is used by the user's personal AI assistant when creating or administering applications.

It works together with the Loomspan-provided builder/admin skill pack.

The assistant would use it to create, publish, and evolve applications.

The intention is for the majority of administrative work to happen through this interface rather than through a traditional web-based application builder.

## Application MCP

This interface is used when people interact with an application they created or were invited to use.

Its responsibilities primarily involve:

- Database access.
- Data validation.
- Returning validation errors and reasons.
- Enforcing access to the application.

The personal AI assistant performs the application-specific reasoning and uses the MCP server to interact with persistent data.

We have not finalized the MCP tool definitions or exact endpoint architecture.

One idea discussed was allowing a user to connect to Loomspan once and discover all the applications they have access to, rather than configuring a separate MCP connection for every application.

This is a proposed direction, not yet a finalized decision.

---

# 7. Supabase Integration

The current idea is to use **Supabase** to provide:

- User authentication.
- Database storage.

Loomspan Cloud would integrate with Supabase to provide persistence and manage access to user-created applications.

The user's personal assistant, using Loomspan's builder/admin skills, could initiate signup and authentication on the user's behalf through supported authentication flows.

The user should not have to understand Supabase or database administration.

We have not yet determined the detailed database architecture or how application-specific data will be represented internally.

---

# 8. Users, Ownership, and Sharing

The intended user model is straightforward.

**Every user can be an administrator of applications they create and a user of applications created by other people.**

A user may own multiple applications and participate in applications shared with them.

Application creators should be able to invite other people by email.

Loomspan Cloud would manage authentication and access to the shared application.

For example:

- Alice creates a recipe tracker and is its administrator.
- Alice invites Bob to use it.
- Bob signs in and accesses the shared recipe tracker.
- Alice uses ChatGPT.
- Bob uses Claude.
- Both interact with the same application data through their own assistants.

The exact permission model beyond the creator/admin and invited-user distinction has not been decided.

---

# 9. Applications Can Evolve

A core part of the concept is that users should be able to evolve their applications through conversation.

For example, after creating a recipe tracker, a user might say:

"Add nutritional information to my recipes and let me search by calories."

The personal AI assistant would use Loomspan's builder/admin skills and MCP tools to modify the application.

This could involve changing the application's data definition and updating its application skills.

The intention is for the assistant to handle the technical work rather than requiring the user to manually edit the database or skills.

We have not yet defined how schema modifications, migrations, versioning, or updates to existing users' skills will work.

These are architectural questions to explore later.

---

# 10. Loomspan Cloud Web UI

Loomspan Cloud will have a web interface.

However, the current expectation is that approximately **90% of application creation and administration could be handled through the user's personal AI assistant** using Loomspan's builder/admin skills and developer/admin MCP server.

The 90% figure is an expectation, not a validated requirement.

The web UI would provide an alternative way to access and manage the platform.

We have not yet defined the specific screens or functionality that the web UI will provide.

The core design philosophy is that users should not need to use a traditional visual application builder to create or evolve their applications.

---

# 11. Primary Design Goals

The design goals established in our discussion are:

**Accessible to nontechnical users**

Users describe what they want using natural language. Their AI assistant handles the technical work.

**Agent-native**

The personal AI assistant is both the development interface and the application interface.

**Low cloud operating costs**

Application reasoning and content processing happen in the user's personal AI assistant rather than in Loomspan Cloud.

**Persistent applications**

Application data lives in cloud storage and is available across conversations and sessions.

**Shareable applications**

Users can invite others to access applications they have created.

**Independent of a single AI assistant**

The same application should be accessible from different supported AI assistants.

**Evolvable through conversation**

Application creators can modify application behavior and data requirements by communicating with their assistant.

**Thin backend**

Loomspan Cloud focuses primarily on hosting skills, MCP access, authentication, validation, and persistent storage rather than executing the application's AI reasoning.

---

# 12. Topics Not Yet Decided

The following subjects were mentioned or naturally arise from the architecture, but have not been resolved.

They should remain open questions rather than becoming assumed requirements.

- Exact MCP server and endpoint topology.
- How skill packs are installed or discovered by different AI assistants.
- How updated application skills reach existing users.
- Detailed Supabase database architecture.
- How application schemas are represented.
- How application schemas evolve.
- Application versioning and migration strategy.
- Detailed authorization and permission model.
- Scope of the web interface.
- How validation rules are defined and implemented.
- The extent of compatibility with different AI agents.
- Application deployment and hosting infrastructure.
- Product packaging and pricing.

Do not resolve these questions merely to make the initial documentation appear complete.

They will be addressed in subsequent architecture discussions.

---

# 13. What I Want Codex to Do

Using this handoff:

1. Inspect the current GitHub repository and understand its existing structure.
2. Review existing Loomspan documentation where it is available and relevant.
3. Create or update an appropriate architecture documentation area in the repository.
4. Document the Loomspan Cloud product vision.
5. Document the proposed high-level architecture and responsibility boundaries.
6. Document the two classes of skills and the two logical MCP interfaces.
7. Document the intended user experience for creating, using, sharing, and evolving applications.
8. Capture explicitly unresolved architectural questions.
9. Keep the documentation faithful to this handoff.

Do not introduce additional features or technical requirements.

Do not start implementing Loomspan Cloud.

Do not turn the open questions into finalized architectural decisions.

The objective is to establish a shared, accurate architectural baseline in the repository that we can progressively refine together.

## Guiding Principle

**Loomspan Cloud enables personal AI assistants to create and operate persistent, shareable applications.**

The personal AI assistant performs the reasoning and executes the application skills.

Loomspan Cloud hosts the application definitions and skills, provides MCP access, validates operations, manages access, and persists application data through Supabase.

The user interacts with their application primarily through their existing AI assistant rather than through a traditional application interface.

This division of responsibility is the foundation of the product.

**Start by documenting what we know. Do not design what we haven't decided.**
