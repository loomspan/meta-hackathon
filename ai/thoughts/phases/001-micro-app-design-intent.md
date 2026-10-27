# Loomspan Cloud — Micro App Design Intent

## Status and scope

This document captures the project owner's stated directions from the discussion following [the original product exploration](000-loomspan-cloud-product-exploration.md).

These are current design intentions, not a finalized specification or implementation plan. The product, requirements, and architecture remain open to refinement through future discussions. Recording a direction here does not settle its implementation.

The main sections below record ideas the project owner explicitly described. The final section separates questions and assistant suggestions that have not been agreed on. Silence or a move to another topic does not constitute agreement.

## 1. Purpose and philosophy

Loomspan Cloud is envisioned as a framework and cloud service supporting **micro apps**: small applications that people create and use with their AI companions.

The human and companion work together to establish:

- The goal of the app.
- What information it stores.
- How it will be used.
- How it will be presented or interacted with.

The intent is to let people build repeatable, semi-deterministic processes that still benefit from the intelligence and contextual flexibility of their companions. A micro app provides guidance for an app-like process while allowing the companion to adapt to the context in which it is being used.

Micro apps can be shared through Loomspan Cloud so that multiple people can use the functionality. Depending on the app's data strategy, they may also share data or collaborate on content.

Examples of intended companions mentioned in the discussion include ChatGPT, Claude, Gemini, and Muse. This expresses the intended direction; compatibility and integration details have not been established.

## 2. Creation, publication, and use

The companion helps build and publish basic application logic, database schema, and presentation logic.

The described publication outputs include:

- Skill packs.
- MCP configuration.
- Hosted skills.
- Schema updates.

After publication, a companion in a new context should be able to download the skill packs, call the MCP server, and run the app's business and presentation logic. The app is intended to remain usable beyond the conversation in which it was created.

The exact contents, formats, and publication mechanics of these artifacts remain undefined.

## 3. Intended division of responsibilities

### AI companion

The companion is the user interface and runs the app's business and presentation logic. It works with the human to define the app and uses its published instructions and MCP access in subsequent contexts.

### Loomspan Cloud

Loomspan Cloud hosts non-AI skills, including proposed Supabase database skills that have yet to be developed. It provides the persistent application data layer and validation rules, with validation and retries included in the intended approach.

The project owner described Loomspan as an **intelligent data layer** supporting application data and validation rules.

The precise boundary between companion-executed business logic, hosted non-AI skills, and validation remains to be designed. The discussion has not established where retries execute or how they are controlled.

## 4. Data management strategies

The platform should support, or at least suggest, a few starting data strategies while allowing people to develop strategies beyond those defaults. The mechanism for defining additional strategies has not been selected.

The project owner proposed the following three strategies as likely to cover many cases.

### Share Nothing

Each user can use the app but has their own data, with no sharing of that data between users.

**Example:** A parent creates an app to organize their child's homework and test results and uses it with their companion to discuss how to support the child's learning. The parent shares a link with a friend, who uses the app for their own child. The parents share the useful application functionality, but not their children's records.

This describes the intended user experience, not a physical database layout or copying mechanism.

### Owner Edit / Everyone Read

Participants can create, update, and delete their own records and have read-only access to other participants' records within the app.

**Example:** A recipe app lets invited participants contribute and maintain their own recipes while reading each other's recipes.

Here, “owner” refers to the owner of a record. Ownership of the application definition is described separately below. The example concerns people participating in the app; public access has not been specified.

### Share Everything

Participants can create, update, and delete any content in the shared app.

**Example:** A parent and son build a Dungeons & Dragons campaign together, with both able to manage the campaign's content.

### Extensibility

These strategies are starting examples, not an exhaustive list. The architecture should allow strategies beyond those initially presented by Loomspan.

No policy language, configuration model, or strategy-composition mechanism has been agreed on.

## 5. Application evolution and ownership

The project owner's current direction is that only the person who creates an app can edit its shared presentation logic, business logic, and data schema.

This is distinct from a participant's ability to change application data under the selected data strategy. For example, Share Everything allows participants to edit content; it does not, by itself, grant them the ability to change the shared application definition.

## 6. Forking

The project owner explicitly proposed planning a **Fork** feature so users can evolve or freeze an app if they choose.

Forking is therefore an intended product capability. Its detailed behavior has not yet been agreed on.

In particular, the discussion has not settled what a fork contains, how ownership is assigned, what “freeze” preserves, or what happens to data and access when an app is forked.

## 7. Questions and suggestions not yet agreed on

The following items arose in the discussion or identify unresolved details of the stated directions. They are not accepted requirements or architecture decisions.

### Data access and enforcement

The later [Data Ownership and Access Enforcement](010-data-ownership-and-access-enforcement.md) discussion establishes Cloud's per-request authentication and membership responsibility, DataSkill strategy enforcement, and required `ownerId` in every application table definition. App ownership grants no special access to private contributions. Share Nothing and Owner Edit now both remove a departing user's data from active use and provide a private 30-day archive.

- Concrete enforcement mechanisms and how publication preserves ownership/access protections remain to be designed.
- Keeping owned relationships together and supporting explicit cross-user references without mixing ownership are tracked as open issue **DATA-OWNERSHIP-001** in document 010.
- The assistant suggested treating the initial strategies as starter policies composed from platform capabilities. The project owner requested extensibility, but this particular implementation approach has not been selected.
- Combining private and shared data within one app was an assistant example, not an agreed requirement.

### Evolution and forks

- How do changes to a shared app affect its existing users and data?
- The assistant proposed defining a fork as an independently owned app based on a specific version, without automatic changes from the original. Those mechanics have not been agreed on.
- The assistant suggested that freezing could preserve an application definition while still allowing data changes. The meaning of “freeze” remains open.
- Does a fork start empty, copy some permitted data, or handle data another way?
- What happens to invitations, memberships, and permissions when an app is forked?
- Who may fork an app, and under what conditions?

### Execution and publication

- Which business rules belong in companion instructions, hosted non-AI skills, or validation?
- How are validation rules represented, and how do validation failures and retries work?
- How does a companion discover, download, and use an app's published artifacts in a new context?
- How do changes to skills and schemas reach existing users?
- What practical scope defines a micro app? No hard size or capability boundary has been set.

These questions are recorded for future design sessions. They do not authorize implementation or expand the agreed product scope.
