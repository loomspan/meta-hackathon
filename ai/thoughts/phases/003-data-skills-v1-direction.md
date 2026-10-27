# Loomspan Cloud — Data Skills V1 Direction

## Status and scope

This document continues the [micro app design intent](001-micro-app-design-intent.md) and [platform components discussion](002-platform-components-and-responsibilities.md).

It separates V1 choices explicitly accepted in the conversation from candidate designs and unresolved details. Agreed choices represent the current direction and remain revisable as the project develops. Examples are illustrative, not an implemented or finalized configuration format.

This is design documentation, not an implementation plan. Assistant suggestions are not treated as accepted requirements merely because they were discussed.

## 1. Agreed V1 choices

### Named operations with explicit query definitions

For V1, Data Skills will use **named operations backed by explicit query definitions**. The project owner accepted this approach and the structured example discussed, while expecting the design to evolve.

The operation name communicates its purpose; an explicit definition describes its query. Runtime parameter values allow an operation to serve different requests without changing its query structure.

Deriving queries by parsing method names and accepting arbitrary runtime query definitions were considered alternatives, but were not selected for V1.

### Encourage queries suited to the user's needs

Companions should be encouraged to develop and use queries that meet the user's needs rather than routinely retrieve broad datasets and filter them afterward.

The project owner's motivation is to avoid unnecessary data transfer, framework load, and apparent slowness. Suitable named operations should perform the relevant filtering through the data layer.

This is a design direction, not a defined query optimizer, performance guarantee, or set of numerical limits.

### Companion-side filtering as a fallback for non-owners

For V1, if a non-owner's companion needs filtering that the available operations do not provide, it can use its own intelligence and capabilities to filter the returned results before displaying them.

This fallback does not grant the participant permission to change the shared app definition or submit a new arbitrary query to Loomspan. The previously stated creator-only application evolution rule continues to apply.

The conversation moved away from adding a Loomspan collection-processing skill to solve this V1 filtering need. Such a skill is not part of the selected V1 approach; it has not been ruled out for all future purposes.

## 2. Framework design constraints stated by the project owner

The design should meet the product goals while remaining manageable by Loomspan Framework, keeping implementation as simple as practical, and limiting technical debt. The framework serves consumers beyond Loomspan Cloud, so Cloud-specific sharing strategies should not become framework concepts.

The subsequent direction is to implement Data Skills through a JavaSkill that interprets an app's data definition. The framework invokes that JavaSkill without understanding the data definition. Rather than introduce a native Data Skill parser or Cloud policy system into the framework, we are exploring optional, implementation-owned configuration for JavaSkills generally. See [Optional JavaSkill Configuration and Responsibilities](004-optional-javaskill-configuration.md).

No framework implementation was inspected as part of this discussion. Compatibility with its current skill contracts, execution model, and composition mechanisms has not yet been established.

## 3. Candidate Data Skill structure

The project owner proposed that a Data Skill might consist principally of a **data schema and repository methods**.

The proposed schema description could use YAML to describe tables, fields, data types, not-null constraints, and uniqueness. Descriptive guidance can explain fields and operations. For validation failures, the current direction uses one custom `message` containing both the explanation and any correction guidance, rather than separate failure-message and retry-hint fields.

This is a candidate structure. The conversation has not finalized the Data Skill artifact format, the schema feature set, or whether all these elements belong in one file.

The intended interpreter is the DataSkill Java implementation, not the framework core. YAML was proposed to give builders a consistent authoring experience, but YAML storage, file naming, and packaging are not requirements that have been finalized. Optional JavaSkill configuration is the current direction for making implementation-specific information available to that interpreter; the framework API remains open.

The assistant suggested thinking about the definition in three parts:

- Schema: available data and constraints.
- Operations: supported reads and changes, with inputs and outputs.
- Guidance: field and operation meanings and failure explanations.

That breakdown is an organizing suggestion, not an additional agreed architecture decision.

## 4. Illustrative named operation

The following example records the kind of explicit query definition the project owner liked. Its exact keys, operators, typing, and execution semantics remain subject to design.

```yaml
operations:
  findQuickRecipes:
    description: Find recipes within a preparation-time limit.
    parameters:
      maxMinutes:
        type: integer
        required: true
    query:
      entity: recipe
      where:
        field: preparation_minutes
        operator: lte
        parameter: maxMinutes
      order_by:
        field: preparation_minutes
        direction: ascending
```

Here, the query structure is published as part of the operation, while the companion supplies a value for `maxMinutes` when invoking it. Accepting this direction does not settle the full query language or commit to every feature shown in the example.

## 5. Business-validation direction

The project owner supported declarative business-validation helpers inspired by Rails Active Record, with custom feedback to the calling companion. These extend the schema-constraint discussion to application-level rules, such as requiring a meeting's end time to follow its start time.

The direction is to express these rules in the DataSkill's optional implementation-specific configuration and have the DataSkill Java implementation evaluate them deterministically, without requiring an LLM call. The framework does not need to interpret their business meaning.

### One message for failure explanation and correction guidance

Each rule can provide a custom `message` for the calling AI companion. That message can explain the failure and suggest how to correct the request or clarify the user's intent. The project owner explicitly chose a single message rather than separate `message` and `hint` fields, since both would be delivered to the same companion.

Illustrative syntax only:

```yaml
validation:
  - id: meeting_dates
    rule: comparison
    field: end_time
    greater_than: start_time
    message: >
      The meeting must end after it starts. Check whether you interpreted
      the dates and times correctly. If the intended times are unclear,
      ask the user for clarification before submitting again.
```

The rule determines validity; the message guides the companion's response. The example does not finalize the configuration keys, rule identifiers, comparison syntax, or error-response contract.

### Candidate helpers and implementation options

The assistant proposed comparisons, inclusion/exclusion checks, length and format checks, and conditional rules as candidates for an initial helper set. The exact set has not been selected. Existing schema capabilities should be inspected before introducing overlapping definitions.

Rails is an authoring-pattern reference, not a proposed runtime dependency. Hibernate Validator and JSON Schema were discussed as possible implementation resources; neither has been selected. An implementation-side extension mechanism for additional validators was also suggested, but its API and supported extension scope remain open.

Rules involving stored state, such as one nomination per member per month, need further design. Their concurrency and database-enforcement requirements are not resolved by adding a declarative helper.

### Failures and retries

The intended feedback helps the companion revise a request or obtain clarification before trying again. It does not establish an automatic Cloud retry loop or guarantee that every failure is correctable.

The assistant recommended distinguishing corrected submissions from retries of transient infrastructure failures, and avoiding invented values merely to satisfy validation. Retry ownership, limits, error aggregation, transaction behavior, and write-retry safety have not been agreed on.

TypeSafe remains a candidate for some validation needs. Its role, guarantees, integration, and cost behavior have not been established; it is not required by the proposed local deterministic helpers.

## 6. Alternatives explored but not selected for V1

### Queries derived from method names

The project owner raised repository methods whose names explain their queries, using a JPA repository analogy. The assistant identified Spring Data JPA as the specific comparison: it supports both derived query methods and declared queries. See [Spring Data JPA query methods](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html).

The discussion selected explicit named-operation definitions instead of deriving query behavior from names.

### General runtime query construction

A structured query supplied by the companion at runtime was discussed as a way to answer questions not anticipated during app creation. It was not selected as the V1 query interface.

### Framework collection-processing skill

The project owner explored a Java-stream-like skill supporting operations such as `map`, `filter`, `reduce`, `limit`, and `skip` over JSON results.

The subsequent direction favored suitable database queries to avoid making broad retrieval and later filtering the normal path. Non-owner companions can perform fallback filtering themselves. No collection-operation syntax or framework implementation was adopted.

## 7. Ideas and details still open

### Data strategies and responsibility boundaries

The project owner supported separating strategy authoring from execution and liked the possibility that the same named operation, such as `findQuickRecipes(maxMinutes)`, could operate within different data-access boundaries according to the app's strategy.

The current direction keeps the Cloud-specific strategy meanings outside the framework. The Build skill pack can help configure an app, while Cloud owns its identity, membership, and sharing behavior. The DataSkill Java implementation interprets data definitions. How Cloud's strategy behavior connects to that implementation remains unresolved.

Cloud-owned strategy JavaSkills were proposed by the project owner. No wrapper, delegation, policy-provider, or database-enforcement mechanism has been selected. Earlier suggestions to add a generic policy contract directly to a native framework Data Skill are not the current direction.

For illustration, Share Nothing could restrict a recipe query to the caller's records, while shared-read strategies could query records available to app participants. Ownership columns, injected query predicates, and other enforcement mechanics remain proposals, not agreed storage or execution designs.

### Schema representation and constraints

- Does YAML describe a desired logical data model that Loomspan translates into database changes, or does it represent database DDL more directly? The assistant favored the former, but no choice was made.
- Which types, relationships, constraints, and schema-change operations are initially supported?
- What is the scope of uniqueness: the whole app, an individual user's data, or a combination of fields?
- How does schema configuration interact with the previously discussed data-access strategies?

### Validation and failure feedback

- Which business-validation helpers are included initially, and how are their rules represented?
- How is the single custom validation message delivered to the calling companion? Its combined explanation/guidance role is agreed; the response structure is not.
- The assistant suggested stable machine-readable error codes alongside human-readable guidance. This has not been agreed on.
- How are schema checks and business rules combined without duplicating or contradicting constraints?
- Are rules attached to entities, fields, named operations, or a combination? For partial updates, what record state is validated?
- How do validation failures affect writes, and are failures returned together or one at a time?
- How are stored-state rules enforced under concurrent requests?
- How do schema and business-validation failures relate to the broader retry design?

### Query definitions and execution

- What operators, field paths, combinations of conditions, relationships, sorting, and pagination belong in the initial query language?
- How are query parameters typed and validated, and what are the null and missing-value rules?
- Can an explicit named operation map to custom SQL? This was discussed as a possibility, not adopted as a V1 capability.
- How are operations checked against the schema and made to respect the app's access strategy?
- How does the DataSkill Java implementation receive its definition through the proposed optional configuration mechanism and fit existing framework execution mechanisms?
- How is Cloud's selected strategy enforced for reads and writes without allowing callers to bypass it? Configuration pass-through alone does not resolve this.

### Operation results

- The project owner initially assumed Data Skills would return JSON arrays. This has not been finalized as the universal result contract.
- The assistant raised single-record results, counts, mutation results, and information about additional records as reasons to examine the contract further.
- The assistant noted that filtering a partial result set cannot establish a complete dataset-wide answer. How pagination, completeness, and companion guidance are represented remains unresolved; no retrieval or completeness protocol has been agreed on.

### Authoring and evolution

- The assistant proposed that an owner's companion could add or update a named operation through the Build workflow when existing operations are insufficient. This is consistent with creator-controlled evolution, but the precise workflow has not been specified or separately approved.
- How are new or modified operations validated and published, and how do existing users receive those changes?
- Which repository operations for creating, updating, or deleting records are supported, and how are their contracts defined? The query discussion did not establish these details.

## 8. Suggested next investigation

The assistant suggested inspecting Loomspan Framework's current JavaSkill declarations, configuration facilities, inputs, outputs, execution context, and composition before choosing an implementation. The sidecar's JavaSkill registration and hosting pattern is also relevant to Cloud's intended use of the framework. These inspections have not yet occurred and are not completed architectural findings.
