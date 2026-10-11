# MCP Tools & Research Protocols

This document defines mandatory protocols for discovering APIs, architectures, and framework capabilities.

## Pre-Implementation Discovery Protocol

Before authoring new utilities, styles, or services, inspect existing project declarations first:

- **Design Tokens**: Inspect `@theme` in `src/styles.css` for existing tokens (e.g. `text-(--color-text-secondary)`) instead of using raw Tailwind palette classes.
- **Platform Injections**: Inspect `src/app/core/constants/navigator.const.ts` for existing injection tokens (`WINDOW`, `NAVIGATOR`) instead of writing ad-hoc `typeof` checks.
- **Architectural Decisions**: Inspect `docs/adr/` for relevant domain specifications and design decisions.

## Mandatory MCP Server Priorities

Never use generic web search when dedicated MCP servers are available in the workspace:

1. **Angular Questions (`angular-cli` MCP server)**:
   - **Target Version**: Angular 22.
   - **Tools to Use**:
     - `search_documentation`: Official Angular documentation search.
     - `get_best_practices`: Canonical style guide and architecture patterns.
     - `ai_tutor`: Concept explanations and migration help.
     - `run_target`: Targeted testing and builds (`target: "test"`).
   - **Constraint**: Web search is strictly forbidden for Angular framework APIs and patterns unless the MCP server explicitly fails or is unreachable.

2. **Firebase & Google Cloud Questions (`firebase-mcp-server`)**:
   - **Target Versions**: Firebase Web SDK 12.x, App Hosting, Remote Config, Firebase Security Rules.
   - **Tools to Use**:
     - `developerknowledge_answer_query`: Direct architectural and SDK questions.
     - `developerknowledge_search_documents`: SDK documentation lookup.
   - **Constraint**: Web search is strictly forbidden for Firebase SDK and configuration questions unless the MCP server fails or hits rate limits.

3. **General Third-Party Tools**:
   - Web search is permitted ONLY for tools and libraries without dedicated MCP servers (e.g. Tailwind CSS v4, Vitest, CSpell).
