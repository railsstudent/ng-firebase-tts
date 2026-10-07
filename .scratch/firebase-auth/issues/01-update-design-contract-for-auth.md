# 01-update-design-contract-for-auth

Type: task
Status: ready-for-agent
Blocked by: None

## Description

Update `Design.md` to define the authoritative UX/UI visual and interaction design contracts for the client-side authentication features (Header Sign-Out icon, Home dynamic Hero CTA, and Sign-In Modal Dialog).

## Target Files

- `Design.md`

## Specifications & Requirements

1. **Global Header (`HeaderComponent`)**:
   - Location: Embedded in the right corner of the header bar.
   - Visibility: Rendered conditionally when `isAuthenticated()` is `true`.
   - Element: `<button class="app-button-icon" aria-label="Sign out">` containing a 24x24 `SignOutIconComponent` (`@apply app-icon`).
   - Interaction: Hover/focus states matching existing design tokens (`text-(--color-text-secondary)` to `text-(--color-text-primary)`).
2. **Home Hero CTA (`HomeComponent`)**:
   - Unauthenticated State: Render secondary/primary CTA button labeled **"Sign In"** that triggers the accessible Sign-In Modal.
   - Authenticated State: Render primary CTA button labeled **"Launch Studio"** linking to `/dashboard`.
3. **Sign-In Modal Dialog (`SignInModalComponent`)**:
   - Overlay & Backdrop: Center-screen modal over `backdrop-blur-sm bg-black/40` overlay.
   - Card Geometry: Rounded container (`rounded-2xl bg-(--color-surface)`), subtle border (`border border-(--color-border)`), elevation shadow.
   - Form Fields: Floating/labeled input fields for Email and Password using Angular Signal Forms.
   - Live Feedback: Red validation hints below touched/invalid inputs (`text-(--color-error)`).
   - Alert Banners: Error banner at top of dialog for failed sign-in attempts (e.g., "Invalid email or password").
   - Action Buttons: Primary "Sign In" button with loading spinner state and "Cancel" button.

## Acceptance Criteria

- [ ] `Design.md` contains clear visual, interaction, and accessibility specifications for Header, Home CTA, and Sign-In Modal.
- [ ] Color, typography, and spacing tokens match the Tailwind CSS v4 theme in `src/styles.css`.
