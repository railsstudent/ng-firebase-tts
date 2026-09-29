# Specification: Minimalist Home Screen & Navigation

**Status**: `ready-for-agent`

## Problem Statement

When users first visit the application, they are immediately routed into the heavy, complex multimodal analysis workspace without any introduction to the application's capabilities, purpose, or workflow. Furthermore, once inside the workspace or sub-pages, users have no accessible mechanism to return to the landing page or orient themselves, as the header strictly contains centered title text with no navigation landmarks.

## Solution

Provide a clean, minimalist Home Screen landing view based on the Obsidian & Electric Indigo design system that introduces the AI studio's core capabilities (multimodal image analysis, grounded obscure facts, and streaming text-to-speech) and presents a prominent call-to-action button to enter the workspace. Complement this with a zero-dependency, accessible inline SVG Home Navigation button positioned on the left edge of the global application header that enables users to return to the Home Screen from anywhere in the app.

## User Stories

1. As a first-time visitor, I want to see a clear and focused landing screen, so that I understand the core purpose and capabilities of the AI application before entering the full workspace.
2. As a visitor, I want to see a prominent "Launch Studio" call-to-action button, so that I can immediately transition to the multimodal analysis dashboard with a single click.
3. As a mobile user, I want the home screen layout to adapt seamlessly to small screens with touch-friendly button targets, so that I have a smooth mobile experience.
4. As a user in the workspace or any sub-view, I want to see an accessible Home icon in the top header, so that I can easily navigate back to the home screen.
5. As a keyboard user, I want the home navigation button in the header and the primary action on the landing screen to be focusable and activatable via Enter/Space, so that I can navigate without a mouse.
6. As a screen reader user, I want the home navigation button to have a clear descriptive label ("Go to Home Screen"), so that I know where the action will lead.
7. As an application developer, I want the home navigation icon to be a standalone inline SVG component without third-party icon fonts or dependencies, so that page load performance is preserved and zero unnecessary network requests are made.
8. As an application user navigating to the root URL (`/`), I want to be redirected to the home screen, so that I always land on a welcoming entry view.
9. As an application user navigating to an unrecognized route, I want to be redirected back to the home screen, so that I never get stuck on a broken or empty page.
10. As a performance-conscious user, I want the home screen to load instantly with the initial application bundle without an extra network round-trip, so that initial page render is immediate.
11. As a user entering the workspace, I want the heavy AI logic and Web Audio synthesis modules to be loaded on demand, so that initial startup bandwidth remains lightweight.
12. As a user navigating between home and dashboard, I want the application shell, header, and footer to remain stable without layout shift or visual flashes.

## Implementation Decisions

### 1. Minimalist Landing View (Home Screen)

- Implement a standalone landing component presenting a centered floating surface card that adheres to the project's visual theme tokens.
- Display a high-contrast headline, an overview description outlining multimodal intelligence and audio synthesis, and a primary action button linked directly to the workspace route.
- Ensure the view integrates seamlessly into the existing application shell without introducing custom full-screen height overrides or isolated background layers.

### 2. Standalone Zero-Dependency Home Icon

- Implement a standalone SVG icon component following the repository's strict icon contract: encapsulated `:host` display styling, relative Tailwind CSS references, and inline SVG markup with `aria-hidden="true"` and `fill="currentColor"`.
- Reject any external font packages, icon libraries, or asset downloads.

### 3. Global Header Navigation Landmark

- Refactor the application header component to support relative positioning with a left-anchored navigation link containing the standalone Home icon.
- Ensure the header gradient title (`h1`) remains horizontally centered across desktop and mobile viewports.
- Explicitly remove the global subtitle to avoid context mismatch on the landing view and eliminate visual clutter.
- Equip the navigation link with an accessible label and standard router link bindings.

### 4. Application Routing Architecture

- Configure the home landing view as an eagerly bundled route for immediate first contentful paint.
- Configure the multimodal dashboard workspace as a lazily loaded route to defer heavy AI and Web Audio bundles.
- Configure root redirect (`''` with full path matching) and wildcard fallback (`'**'`) to route to the home landing view.

---

## Testing Decisions

### Good Test Principles

Tests must verify external behavioral contracts, accessible landmarks, and routing transitions rather than internal component implementation mechanics or framework internals.

### 1. Standalone Home Icon Tests

- Verify the icon component instantiates correctly and renders an inline SVG element with `aria-hidden="true"` and `fill="currentColor"`.

### 2. Header Navigation Tests

- Verify the header renders the navigation anchor targeting the home route.
- Verify the navigation anchor includes the correct `aria-label="Go to Home Screen"`.
- Verify the header title renders with `h1` heading hierarchy without any extraneous subtitle elements.

### 3. Home Screen View Tests

- Verify the landing view renders the hero card, headline, description, and primary CTA button.
- Verify the primary CTA button links to the dashboard workspace route.

### 4. Routing Integration Tests

- Verify navigating to root (`/`) redirects to `/home` and displays the home landing view.
- Verify navigating to `/dashboard` renders the multimodal workspace.
- Verify invalid routes redirect to `/home`.

---

## Out of Scope

- Multi-tab header navigation bars, search inputs, or secondary navigation links.
- User authentication portals, login dialogs, or account profile menus.
- Complex marketing carousels or external video previews.

---

## Further Notes

- All styling conforms strictly to Tailwind CSS v4 `@apply` rules with explicit `@reference` directives.
- All domain terminology conforms to the project's ubiquitous language.
