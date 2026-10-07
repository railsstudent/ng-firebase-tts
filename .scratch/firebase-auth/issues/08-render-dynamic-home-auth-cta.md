# 08-render-dynamic-home-auth-cta

Type: task
Status: done
Blocked by: 01-update-design-contract-for-auth, 03-create-auth-service-and-session-listener

## Description

Update the Home landing page hero section (`HomeComponent`) to dynamically toggle the primary CTA button between "Launch Studio" (with right arrow icon) when authenticated and "Sign In" (without arrow icon) when unauthenticated, adhering to Section 12 of `DESIGN.md` and Desktop/Mobile Stitch screens.

## Target Files

- `src/app/features/home/home.component.ts`
- `src/app/features/home/home.component.html`
- `src/app/features/home/home.component.spec.ts`

## Design & Visual Specifications

1. **Design System Contract (`DESIGN.md` Section 12: Home Screen)**:
   - **Outer Container (`.home-container`)**: Centered layout inside `.app-main` (`w-full flex-1 flex flex-col items-center justify-center py-8 sm:py-16`).
   - **Hero Card (`.home-card` / `.surface-card`)**:
     - Desktop: `bg-slate-800/50 border border-slate-700 rounded-2xl max-w-2xl w-full p-8 sm:p-12 text-center flex flex-col items-center gap-6 shadow-2xl backdrop-blur-sm`.
     - Mobile: `p-6 w-full flex flex-col items-center gap-5`.
   - **Dynamic Hero CTA Button (`.btn-launch` / `.btn-sign-in`)**:
     - **Authenticated State**:
       - Semantic link: `[routerLink]="['/dashboard']"` (or `routerLink="/dashboard"`).
       - Content: `"Launch Studio"` label accompanied by standalone `<app-arrow-right-icon>` (`aria-hidden="true"`) with hover translation (`group-hover:translate-x-1`).
       - Styling: `@apply btn-primary px-8 py-3.5 text-base font-semibold shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2;`.
     - **Unauthenticated State**:
       - Action button labeled **"Sign In"** (placeholder click or event stub).
       - Styling: `@apply btn-primary px-8 py-3.5 text-base font-semibold shadow-lg shadow-indigo-500/20 flex items-center justify-center;`.
       - Strictly NO right arrow icon on "Sign In".
   - **Strict Constraints**:
     - Strictly NO right arrow icon on the unauthenticated `"Sign In"` CTA button.
     - Strictly NO status pills, badges, or chips on metadata grid items.
     - Strictly NO isolated `min-h-screen` or independent background overrides.

2. **Stitch Screen Contracts**:
   - **Desktop Unauthenticated**: Screen `4ec85d5271ac45f7bf2f81163377a5cc`
   - **Desktop Authenticated**: Screen `214ae4ceea61404498cd8d132104fc84`
   - **Mobile Unauthenticated**: Screen `3eadfd2820e64b9fa38bd820a5ee5070`
   - **Mobile Authenticated**: Screen `a13f34ae98e741c8bca07ca50d315951`

## Implementation Requirements

1. **`HomeComponent` TypeScript**:
   - Inject `AuthService`.
   - Expose `readonly isAuthenticated = this.authService.isAuthenticated;`.
2. **`HomeComponent` Template**:
   - Dynamic CTA block:

     ```html
     @if (isAuthenticated()) {
     <a routerLink="/dashboard" class="btn-launch group">
       <span>Launch Studio</span>
       <app-arrow-right-icon class="transition-transform group-hover:translate-x-1" />
     </a>
     } @else {
     <button type="button" class="btn-sign-in">
       <span>Sign In</span>
     </button>
     }
     ```

3. **Unit Tests (`home.component.spec.ts`)**:
   - Verify unauthenticated state renders `"Sign In"` button without arrow icon.
   - Verify authenticated state renders `"Launch Studio"` link with `<app-arrow-right-icon>`.
   - Verify responsive layout classes and accessibility attributes.

## Acceptance Criteria

- [x] Hero CTA dynamically reflects authentication state.
- [x] Authenticated view displays "Launch Studio" button linking to `/dashboard` with arrow icon.
- [x] Unauthenticated view displays "Sign In" button without arrow icon.
- [x] Unit tests pass with 100% assertion coverage without lint errors.
