# Documentation Architecture & Document Boundaries

This document defines the separation of roles and scope boundaries across the three core document types.

## Core Document Types

1. **`spec.md` (Product Specification / PRD)**:
   - **Role**: Defines **what** the feature accomplishes and **why** from the user's perspective.
   - **Content**: Problem statement, user stories, product-level behaviors, and **natural-language testing decisions** framed around user journeys, accessibility, and security gates for product managers and non-technical stakeholders.
   - **Scope Boundaries**: Focuses on user-visible behavior; leaves low-level class names, method signatures, private helpers, and library mechanics to the ADR and implementation tickets.

2. **`docs/adr/` (Architectural Decision Records)**:
   - **Role**: Documents **how** the system is built, technology choices, and architectural trade-offs.
   - **Content**: Rationale for technical decisions, evaluation of alternatives, performance and bundle considerations, data storage or persistence strategies, and overarching system patterns.

3. **Implementation Tickets (`.scratch/<feature>/issues/NN-<slug>.md`)**:
   - **Role**: Concrete engineering execution breakdown.
   - **Content**: Specific public API contracts, internal module structure, test matrices, and step-by-step implementation tasks. See [issue-tracker.md](issue-tracker.md).
