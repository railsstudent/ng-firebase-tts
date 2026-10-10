---
trigger: model_decision
description: Autonomous modern web platform discovery for UI components, HTML templates, CSS styling, forms, and browser APIs.
---

# Autonomous Modern Web Discovery

When designing, inspecting, or refactoring UI components, templates, styling, forms, or browser interactions:

1. **Autonomous Discovery**: Autonomously consult modern web platform primitives and the `modern-web-guidance` skill during the initial investigation turn before drafting plans or code.
2. **Prioritize Native Web Primitives**:
   - Prefer semantic HTML5 elements (`<dialog>`, `<popover>`, `<label for="...">`, `<details>`, `<summary>`) over synthetic div/button constructions.
   - Prefer native form and input capabilities (`input.value = ''` resets, input validation pseudo-classes `:user-valid` / `:user-invalid`, standard file/drag-drop APIs).
   - Prefer modern CSS standards (Tailwind v4 `@theme` design tokens, CSS container queries, `:has()`, view transitions) over custom CSS overrides.
3. **Zero User Prompting**: Never wait for or depend on the user to request modern web guidance. Take full ownership of web platform research upfront.
