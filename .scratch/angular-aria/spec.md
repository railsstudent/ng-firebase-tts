# Specification: Angular Aria Accessibility with Tailwind CSS v4

**Status**: `ready-for-agent`

## Problem Statement

Users navigating the application using screen readers, keyboard-only input, or other assistive technologies face barriers when interacting with key elements. Specifically, the dynamic AI voice model selector is a standard native HTML select element that lacks custom styling options, the suggested image tags list has no list-level structural context or selection cues, and the recommendations display is always fully visible, taking up excessive vertical screen space and adding visual clutter without support for keyboard-driven folding. Additionally, these custom interactive widgets lack proper keyboard arrow navigation, focus management, and automatic ARIA state management.

## Solution

Integrate `@angular/aria` to scaffold headless, accessible components for the AI voice model selector (Combobox/Select pattern), suggested image tags (single-select Listbox pattern with explicit selection mode), and image recommendations (lazy-rendered Accordion pattern with multiple expansion support). Use Tailwind CSS v4's native ARIA variants and component classes to style all active, focused, and expanded states, maintaining a cohesive design while ensuring full compliance with WAI-ARIA standards and screen-reader requirements.

## User Stories

1. As a keyboard-only user, I want to use Up/Down arrow keys to navigate through recommended items, and press Space or Enter to collapse or expand them, so that I can easily scan content without excessive scrolling.
2. As a screen reader user, when I navigate to the recommendations section, I want the system to announce that it is an accordion and whether each item is expanded or collapsed, so that I understand the visual hierarchy.
3. As a performance-conscious mobile user, I want recommendation reasons to be lazily rendered, so that DOM nodes are only created and rendered when I expand a recommendation.
4. As a screen reader user, when I focus on the suggested tags section, I want the system to announce the total number of suggested tags, so that I understand the size of the list.
5. As an assistive-tech user, I want to browse suggested image tags using Left/Right arrow keys with low-noise explicit selection (where navigating shifts focus without triggering speech interruptions until explicitly selected), so that I can preview tags cleanly.
6. As a screen reader user, when a tag is selected, I want the screen reader to natively read the tag's text and its active selection state, so that I receive immediate confirmation of my action.
7. As a mobile developer, I want the custom tags to have toggleable single-selection (with no selection initially, and the ability to click again to deselect), so that users can have full control to clear their selections.
8. As a screen reader user, when I focus the AI Voice Model Selector, I want it to be announced as an interactive dropdown, so that I know I can open it to reveal option lists.
9. As a keyboard-only user, I want to open the voice selector dropdown, use Arrow keys to highlight voices, and press Enter to select a voice, so that I can customize audio parameters without using a mouse.
10. As a developer, I want the custom voice selector to synchronize its selection with the parent view so that user choices update the audio prompt parameters.
11. As a designer, I want all ARIA state-based visual indicators (such as rotated chevron icons on expanded panels, active highlight backgrounds on options) to be styled dynamically matching Angular Aria patterns, avoiding unnecessary custom state management.

## Implementation Decisions

### 1. External Package Dependency

- Add `@angular/aria` to `package.json` dependencies to supply headless keyboard navigation and ARIA attribute directives (`ngListbox`, `ngOption`, `ngCombobox`, `ngComboboxPopup`, `ngAccordionGroup`, `ngAccordionTrigger`, etc.).

### 2. Custom AI Voice Model Selector (Select/Combobox)

- Encapsulate the voice selection combobox into a dedicated feature component (`VoiceSelectorComponent`).
- Bind the trigger utilizing `ngCombobox` and the popup dropdown utilizing `ngComboboxPopup` paired with `ngComboboxWidget`, `ngListbox`, and `ngOption`.
- Dismiss the overlay on user commitment via `(click)="onCommit()"`, `(keydown.enter)="onCommit()"`, and `(keydown.space)="onCommit()"` on `ngListbox`.
- Maintain active element visibility using `afterRenderEffect(() => this.listBox()?.scrollActiveItemIntoView())`.
- Maintain seamless value synchronization between the selector and the parent container.

### 3. Accessible Suggested Tags List (Single-Select Listbox)

- Refactor suggested tags in `tags-display.component.html` using headless listbox directives (`ngListbox`, `multi="false"`, `selectionMode="explicit"`).
- Decorate child option items with `ngOption` to provide roving tabindex focus and accessible toggleable single-selection without unnecessary template boilerplate.

### 4. Collapsible Recommendations Display (Lazy-Rendered Accordion)

- Refactor the recommendations list in `recommendations.component.html` to a multi-expandable accordion container (`ngAccordionGroup`, `[multiExpandable]="true"`).
- Attach headless `ngAccordionTrigger` directives (e.g. `<p ngAccordionTrigger>`) to recommendation titles within the card headings to manage keyboard navigation and toggle corresponding `ngAccordionPanel` containers following official Angular Aria headless patterns.
- Style chevron indicators dynamically with rotation transition when expanded.
- Wrap content panels inside `<ng-template ngAccordionContent>` to activate lazy rendering, ensuring hidden text only enters the DOM upon user expansion.

### 5. Seams and Core Architecture

- Style integration is achieved directly within components' CSS stylesheets and templates by referencing Tailwind CSS v4 utilities, component-scoped classes, and ARIA state bindings (`[aria-selected='true']`, `optionRef.selected()`, `triggerRef.expanded()`, `focus-visible:`).
- Parent component encapsulates form state updates seamlessly, ensuring zero impact on downstream speech-generation models and services.

---

## Testing Decisions

### Good Test Principles

- Test only **external accessible behavior** and ARIA contract compliance. Avoid writing tests that assert on internal, private states of `@angular/aria`.
- Leverage Angular Aria's native `@angular/cdk/testing` component harnesses (e.g., `VoiceSelectorHarness`) or DOM integration testing to write robust tests decoupled from DOM structures.

### 1. Suggested Tags Accessibility Tests

- Verify that setting empty tags displays the correct fallback text.
- Verify that arrow-key navigation correctly shifts focus between tag options.
- Verify that explicit selection toggles `aria-selected="true"` natively on the active option when `selectionMode="explicit"` is configured.

### 2. Custom Dropdown / Voice Selector Tests

- Verify that clicking the trigger opens the dropdown popup.
- Verify that keyboard navigation and selection update the parent Signal Form value.
- Verify that pressing Escape successfully closes the popup and restores focus to the trigger.

### 3. Accordion Recommendations Tests

- Verify that all panels are initially collapsed (if configured) or open as expected.
- Verify that clicking the trigger expands/collapses the panel and toggles the `aria-expanded` attribute.
- Verify that panel content is not present in the DOM when closed, validating the lazy rendering seam.

---

## Out of Scope

- Introducing fully custom autocompletion/type-ahead filtering logic inside the Voice Selector beyond standard list selections.
- Setting up custom system sound effects or visual audio wave animations during screen reader announcements.
- Global site-wide keyboard shortcuts outside of the immediate widget navigation flows.

---

## Further Notes

- `@angular/aria` is designed to work with all modern screen readers. Visual indicators for keyboard-focus should always use high-contrast focus rings (`focus-visible:ring-2`) to support low-vision and keyboard-only users.
