# AGENTS

This file provides context, rules, and guidance for AI assistants working on this codebase.

## Directory Navigation

- **`src/app/core/<domain>/`**: Cohesive flat domain packages (with public `index.ts`). Keep domain files at the root level of the folder without nested subdirectories, and never export lazy-only services (`injectAsync` targets or services exclusively consumed by them) from barrel files that are also imported by eager modules in `main.js`.
- **`src/app/features/`**: Feature components, routing, and view models. Never create barrel files (`index.ts`) in feature folders or across `@defer` boundaries.
- **`src/app/pwa/`**: PWA infrastructure & update checking. Use direct targeted imports without barrel files to preserve `@defer` splitting.
- **`src/app/shared/`**: Reusable components, pipes, and domain models (`src/app/shared/interfaces/<domain>.interface.ts`).
- **`src/testing/`**: Shared mock factories (`createMockConfigService`, `createMockAiModel`).
- **`firebase/`**: Firebase CLI configs (`firebase.json`, Remote Config templates, prebuild scripts).

## Context Pointers & Protocols

- **MCP Tools & Research**: [docs/agents/mcp-tools.md](docs/agents/mcp-tools.md) — MUST query `angular-cli` and `firebase-mcp-server` MCPs first. Web search is strictly forbidden for Angular/Firebase platform APIs.
- **Coding Standards & Invariants**: [docs/agents/coding-standards.md](docs/agents/coding-standards.md) — Architectural invariants (zero `!`, zero `../`, native `#` for non-method private state/deps, TS `private` for methods, Signal Forms).
- **Testing & Mocking**: [docs/agents/testing-guide.md](docs/agents/testing-guide.md) — DI mocking at TestBed boundary using `mock<Name>` with `satisfies Partial<T>`, mock factories, and targeted runner usage.
- **Domain Modeling**: [docs/agents/domain.md](docs/agents/domain.md) — Project glossary and domain decisions.
- **Document Boundaries**: [docs/agents/document-boundaries.md](docs/agents/document-boundaries.md) — Scope separation across PRDs (`spec.md`), ADRs (`docs/adr/`), and implementation tickets (`.scratch/`).

## Verification & Pre-Commit Loop

1. **Targeted Testing during Development**: Use `angular-cli` MCP `run_target` with `target: "test"` against modified files or directories.
2. **End-of-Task Validation**: Run `npm run lint` and `npm run test:once` before declaring work complete to ensure zero violations.
