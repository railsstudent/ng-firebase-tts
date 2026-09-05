# 0006: Accessible Custom Components using Angular Aria, CDK Overlay, and Tailwind CSS v4

- **Status**: Accepted
- **Date**: 2026-09-02 (Updated 2026-09-05)

## Context

The application requires professional-grade accessibility (A11y), responsive viewport positioning, and full keyboard navigation across all interactive elements—specifically the AI Voice Model Selector, Suggested Image Tags list, and Collapsible Image Recommendations list.

Traditionally, implementing these custom accessible widgets requires writing complex, custom keyboard-listening logic, focus management, manually sync'ing dynamic ARIA attributes, and building custom overlay collision-detection systems. This often results in bloated, bug-prone TypeScript components and visual styling inconsistencies.

## Decision

We will adopt `@angular/aria` for headless accessibility primitives and `@angular/cdk/overlay` for floating panel placement, styled natively using Tailwind CSS v4's state modifiers:

1. **AI Voice Model Selector (Hybrid WAI-ARIA Combobox + CDK Floating Overlay Pattern)**:
   - Use `@angular/aria` primitives (`ngCombobox`, `ngComboboxPopup`, `ngListbox`, `ngOption`) to manage ARIA attributes, keyboard navigation (Arrow Up/Down, Enter, Escape), and focus management.
   - Use `@angular/cdk/overlay` (`cdkConnectedOverlay`) to handle floating anchor positioning, collision avoidance, and viewport boundary auto-flipping.
   - Keep this custom component fully integrated with Angular's modern Signal Forms (`[formField]`).

2. **Suggested Image Tags List (Single-Select Explicit Listbox Pattern)**:
   - Move from plain `<span>` lists to a semantic `<ul>`/`<li>` listbox using `ngListbox`, `[multi]="false"`, and explicit selection (`selectionMode="explicit"`).
   - Enable `allowEmpty` support so that clicking or pressing Enter on an already active tag toggles it off (clearing the selection).
   - This provides low-noise keyboard navigation (arrows move focus, reading the option text, and selection only happens when explicitly confirmed).

3. **Collapsible Recommendations (Lazy-Rendered Accordion Pattern)**:
   - Use `ngAccordionGroup` with multi-expansion enabled (`[multiExpandable]="true"`) to allow collapsible recommendation cards.
   - Embed panel contents inside `<ng-template ngAccordionContent>` to activate lazy rendering, ensuring hidden text does not bloat the DOM until expanded.

4. **Tailwind CSS v4 ARIA State Styling**:
   - Style all interactive, active, and focused states natively in the HTML/CSS templates using Tailwind CSS v4's standard modifiers (e.g., `aria-selected:`, `aria-expanded:`, `focus-visible:`).
   - Keeping the component TypeScript files completely stateless regarding presentational states.

## Consequences

### Positive

- **WAI-ARIA Compliance & Robust Positioning**: Interactive controls automatically receive proper roles, focus management, and keyboard support, while floating panels automatically avoid screen-edge clipping.
- **Low-Noise Screen Reader UX**: Explicit single-selection prevents screen readers from announcing "selected" on every arrow key stroke, keeping speech clean and simple.
- **Stateless Components**: Visual active states are handled natively in the CSS via ARIA attributes, keeping the component TypeScript code extremely clean and focused on business logic.
- **Improved Performance**: Lazy-rendered accordion panels keep the DOM tree light and fast on initial page load.

### Trade-offs / Dependencies

- **Headless Styling Responsibility**: Since `@angular/aria` is headless, we must write and maintain all custom layout and focus ring styling manually using Tailwind CSS v4.
- **Dependencies**: Adds `@angular/aria` for accessibility primitives and `@angular/cdk` for overlay positioning primitives in `package.json`.
