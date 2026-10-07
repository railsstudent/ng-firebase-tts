# 06-integrate-header-sign-out

Type: task
Status: done
Blocked by: 01-update-design-contract-for-auth, 03-create-auth-service-and-session-listener, 05-create-sign-out-icon

## Description

Integrate the interactive Sign-Out button into the global application header (`HeaderComponent`), rendering conditionally when authenticated and executing sign-out with home redirection on click, adhering to Section 1 of `DESIGN.md` and the desktop and mobile Stitch design contracts.

## Target Files

- `src/app/shared/ui/layout/header/header.component.ts`
- `src/app/shared/ui/layout/header/header.component.html`
- `src/app/shared/ui/layout/header/header.component.spec.ts`

## Design & Visual Specifications

1. **Design System Reference (`DESIGN.md` Section 1: App Header)**:
   - **Container Layout**: Centered relative container (`relative flex items-center justify-center text-center mb-6 sm:mb-8 min-h-[4rem]`).
   - **Sign-Out Action Element (`.header-sign-out-btn`)**:
     - Right-anchored button: `absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all flex items-center justify-center`.
     - Element: `<button type="button" class="header-sign-out-btn" aria-label="Sign out" (click)="onSignOut()">` housing `<app-sign-out-icon />` (`@apply app-icon`).
     - Conditional Visibility: Wrapped strictly inside `@if (isAuthenticated())`.
   - **Constraints**: Strictly NO user avatars, breadcrumbs, search bars, or secondary menus.

2. **Desktop Viewport Contract (`Firebase AI Logic Obscure Fact Speech Generator Home Screen (Authenticated)` - Screen ID: `214ae4ceea61404498cd8d132104fc84`)**:
   - Header container with centered gradient title (`h1`) and right-anchored sign-out action button positioned symmetrically opposite the left-anchored home button.

3. **Mobile Viewport Contract (`Firebase AI Logic Obscure Fact Speech Generator - Mobile Home Screen (Authenticated)` - Screen ID: `a13f34ae98e741c8bca07ca50d315951`)**:
   - Bounded responsive layout (`min-h-[48px] w-full pt-1 pb-3 px-1`) with touch target sizing (`w-10 h-10` / `p-2`) and focus/active states (`active:scale-95`).

## Implementation Requirements

1. **`HeaderComponent` TypeScript (`src/app/shared/ui/layout/header/header.component.ts`)**:
   - Inject `AuthService` and `Router` via private native `#` backing variables:
     - `readonly #authService = inject(AuthService);`
     - `readonly #router = inject(Router);`
   - Expose `readonly isAuthenticated = this.#authService.isAuthenticated;`.
   - Method `async onSignOut(): Promise<void>`:
     - Calls `await this.#authService.signOut()`.
     - Calls `await this.#router.navigate(['/home'])`.

2. **`HeaderComponent` Template & Styles (`header.component.html`)**:
   - Render sign-out button inside `@if (isAuthenticated())`.
   - Use semantic button with `aria-label="Sign out"`, host `<app-sign-out-icon />`, and apply design token hover/focus classes.

3. **Unit Tests (`header.component.spec.ts`)**:
   - Verify button is not rendered when `isAuthenticated()` is `false`.
   - Verify button is rendered when `isAuthenticated()` is `true`.
   - Verify clicking the button triggers `AuthService.signOut()` and `Router.navigate()`.
   - Verify accessibility attributes (`aria-label="Sign out"`).

## Acceptance Criteria

- [x] Sign-out button is conditionally rendered only when `isAuthenticated()` is `true`.
- [x] Matches visual and layout specifications in `DESIGN.md` Section 1 and Stitch screens `214ae4ceea61404498cd8d132104fc84` (Desktop) & `a13f34ae98e741c8bca07ca50d315951` (Mobile).
- [x] Clicking sign-out calls `AuthService.signOut()` and `Router.navigate()`.
- [x] Header component spec tests pass with 100% assertion coverage without lint errors.
