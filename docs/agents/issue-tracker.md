# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.

## Spec Authoring & Document Boundaries

To keep codebase abstractions clean and prevent dead exports, follow strict separation between product requirements, architectural decisions, and implementation tickets:

### 1. `spec.md` (Product Specification)

- **Purpose**: Defines **what** the feature accomplishes and **why**.
- **What Belongs**: Problem statement, user stories, domain data models/interfaces (`src/app/shared/interfaces/`), behavioral rules (e.g. mathematical formulas, dimension constraints, compression quality), and user-observable acceptance criteria.
- **What is Forbidden**: Do NOT include code-level function signatures, parameter lists, private service methods, or internal helper function names (e.g., avoid listing `calculateImageTokens(...)`). Leave code decomposition to the implementation phase.

### 2. `docs/adr/` (Architectural Decision Records)

- **Purpose**: Captures architectural decisions, trade-offs, and technology choices (e.g., using browser Canvas APIs for client-side compression vs. server-side functions).

### 3. Implementation Grilling & Tickets (`issues/NN-<slug>.md`)

- **Workflow**: Use `spec.md` and the `ADR` as inputs to grill and plan the technical design.
- **Purpose**: Deconstructs the feature into concrete engineering tasks:
  - Defining the minimal public API surface (single public entry points for services and utilities).
  - Designing internal, unexported module helpers and `private` service methods.
  - Formulating the TDD test matrix that tests observable public behavior rather than internal helpers.
