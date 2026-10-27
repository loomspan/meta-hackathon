# Loomspan Cloud — Optional JavaSkill Configuration and Responsibilities

## Status and context

This document continues the [Data Skills V1 discussion](003-data-skills-v1-direction.md).

It records the direction to support implementation-specific information for JavaSkills while keeping the framework independent of Data Skill definitions and Cloud sharing strategies. The exact configuration API, lifecycle, storage, and enforcement design remain open. No framework or sidecar implementation has been inspected during this discussion.

This is a design direction, not a finalized specification or authorization to implement it. Assistant recommendations below are identified separately from the direction expressed by the project owner.

## 1. Current direction

The project owner explicitly supported this boundary:

> The framework would know how to invoke the JavaSkill, but wouldn't need to parse or understand the data definition.

The owner then proposed generalizing the pattern so JavaSkills can optionally carry information that the framework does not interpret but that their implementations can use. This should be useful to applications beyond Loomspan Cloud.

For Data Skills, the Java implementation interprets a declarative definition of the app's data and named operations. It is not necessary for the framework to introduce a native Data Skill definition language.

YAML is a candidate authoring format intended to feel consistent to the builder. The owner explicitly left open whether the structure must actually live as YAML.

## 2. Responsibility boundaries

### Loomspan Framework

- Execute JavaSkills through its generic skill mechanisms.
- Provide a general way to make optional implementation-specific information available to a JavaSkill, if existing facilities do not already cover the need.
- Remain unaware of the meaning of Data Skill schemas, named-query definitions, and Cloud sharing strategies.

The assistant proposed that the framework load and preserve the configuration as structured data and pass it to the implementation. That is one possible mechanism, not a selected Java API. “Does not interpret” refers to the contents' domain meaning; it does not imply silently discarding the configuration.

### DataSkill Java implementation

Interpret the data definition and perform the requested named operations. Schema interpretation, query-definition handling, and implementation-specific checks belong with this capability rather than the framework core.

The exact supported operations, schema features, validation timing, and database integration remain open, as recorded in document 003.

### Loomspan Cloud

Own the Cloud-specific identity, app membership, and sharing-strategy behavior. Cloud hosts the framework and registers the JavaSkills it needs, following the general hosting relationship the owner described for loomspan-sidecar.

The owner proposed that strategy implementations could themselves be JavaSkills living in Cloud. How those skills cooperate with the DataSkill implementation is still to be designed. Optional configuration alone does not define access enforcement.

### Build skill pack and AI companion

Help the user describe an app, author its data definitions and named operations, and configure its intended data strategy through the supported publication workflow.

The Build pack can teach consistent authoring conventions even when the framework does not understand every artifact's contents. The exact conventions and publication checks are open.

## 3. Proposed configuration shape — not an agreed format

The assistant suggested one explicit configuration field inside a JavaSkill declaration, rather than permitting arbitrary unknown fields throughout the declaration. This would distinguish framework-owned declaration properties from implementation-owned configuration.

Illustrative syntax only:

```yaml
name: recipe-data
type: java
implementation: DataSkill

config:
  schema:
    # DataSkill-specific definition
  operations:
    # DataSkill-specific named operations
```

None of these declaration keys has been checked against the existing framework. The field name `config`, inline layout, implementation identifier, and representation are not finalized. Separate referenced artifacts remain a possibility.

The same Java implementation could potentially serve multiple differently configured skill declarations. Instance creation, configuration binding, and isolation between those declarations have not been designed.

## 4. Recommended distinctions still to validate

The assistant recommended keeping three kinds of information distinct:

| Information | Proposed role |
|---|---|
| Implementation configuration | Published settings and definitions interpreted by the JavaSkill. |
| Invocation arguments | Values supplied for a particular call, such as an operation name and its parameters. |
| Trusted runtime context | Host-established identity and other execution information. |

The assistant also recommended keeping credentials out of ordinary app-authored configuration. These are design recommendations; no binding, context, or secret-management mechanism has been agreed on.

Further recommendations were to let the implementation validate its configuration and to supply structured configuration rather than require each JavaSkill to locate and reparse its own YAML file. Validation lifecycle and Java types remain open.

## 5. Framework versus Cloud packaging

The project owner wants data capabilities to be useful beyond Cloud while keeping Cloud strategies out of the framework.

A reusable capability does not necessarily have to be implemented in framework core. The assistant proposed initially developing the DataSkill implementation in Cloud, with an optional reusable skill library as a possible later packaging choice. That placement and extraction sequence have not been explicitly selected.

The configuration mechanism is intended to be generic. The location and distribution of the DataSkill interpreter, shared database code, and Cloud strategy JavaSkills remain undecided.

## 6. Earlier approaches not currently selected

- A native framework Data Skill parser that understands the app's schema and query language.
- A framework policy contract designed around Data Skill access restrictions.
- Hardcoding Share Nothing, Owner Edit / Everyone Read, or Share Everything into framework core.

The discussion moved toward a JavaSkill interpreter plus generic optional configuration instead. This does not establish that the existing framework needs changes; inspection may reveal sufficient configuration facilities already exist.

## 7. Open implementation questions

- What configuration or extension fields do current JavaSkill declarations already support?
- How does the sidecar register implementations and bind them to skill declarations?
- Should configuration be inline, referenced, or support another representation?
- What Java representation exposes it, and when is it available: initialization, invocation, or both?
- When does implementation-specific validation occur, and how are failures reported to the builder?
- How are configuration updates and multiple configured uses of one JavaSkill handled?
- How does Cloud supply trusted caller and app context separately from companion-controlled inputs?
- How do Cloud strategy JavaSkills cooperate with the data executor, including write restrictions and prevention of bypass?
- Where should the reusable data implementation and Cloud-only code live?

The next suggested investigation is to inspect existing framework and sidecar mechanisms before proposing new APIs. That investigation remains outstanding.
