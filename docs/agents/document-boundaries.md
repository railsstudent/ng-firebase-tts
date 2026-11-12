# Documentation Architecture & Document Boundaries

This document defines the separation of roles and scope boundaries across the three core document types.

## Core Document Types

1. **`spec.md` (Product Specification / PRD)**:
   - **Role**: Defines **what** the feature accomplishes and **why** from the user's perspective.
   - **Content**: Problem statement, user stories, product-level functional/behavioral rules, and **natural-language testing decisions** framed around observable user journeys, fallback behaviors, accessibility, and security gates for product managers and non-technical stakeholders.
   - **Scope Boundaries**: Every sentence in `spec.md` must be readable by a non-technical stakeholder without naming TypeScript interfaces/types, class or method names, private helpers, file extensions, CSS selectors, or SDK package mechanics (leave those to the ADR and implementation tickets).

2. **`docs/adr/` (Architectural Decision Records)**:
   - **Role**: Documents **how** the system is built, technology choices, and architectural trade-offs.
   - **Content**: Rationale for technical decisions, evaluation of alternatives, performance and bundle considerations, data storage or persistence strategies, and overarching system patterns.

3. **Implementation Tickets (`.scratch/<feature>/issues/NN-<slug>.md`)**:
   - **Role**: Concrete engineering execution breakdown.
   - **Content**: Minimal public API contracts, internal module structure (`private` service methods and unexported helpers), step-by-step implementation tasks, and concrete Red -> Green `*.spec.ts` test code blocks that verify observable public behavior. See [issue-tracker.md](issue-tracker.md).
