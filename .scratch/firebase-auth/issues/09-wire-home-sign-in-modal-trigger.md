# 09-wire-home-sign-in-modal-trigger

Type: task
Status: ready-for-agent
Blocked by: 07-create-sign-in-modal-dialog, 08-render-dynamic-home-auth-cta

## Description

Connect the unauthenticated "Sign In" button in `HomeComponent` to open the `SignInModalComponent` via Angular CDK Dialog with `@defer (on interaction)` optimization for optimal initial bundle performance.

## Target Files

- `src/app/features/home/home.component.ts`
- `src/app/features/home/home.component.html`
- `src/app/features/home/home.component.spec.ts`

## Design & Visual Specifications

1. **Design System & Interaction Contract (`DESIGN.md` Section 12 & 13)**:
   - When the user clicks the "Sign In" button on the Home screen, open the `SignInModalComponent` dialog.
   - Dialog configuration:
     - Backdrop: `backdropClass: 'backdrop-blur-sm bg-black/40'` (or styled via CDK dialog panel configuration).
     - Focus trapping and Escape key closing enabled by default via CDK Dialog.
   - Defer dialog loading using `@defer (on interaction)` to maintain minimal initial bundle overhead and zero cold start performance penalty.

## Implementation Requirements

1. **`HomeComponent` TypeScript**:
   - Inject `Dialog` from `@angular/cdk/dialog`.
   - Method `openSignInModal()`:
     - Calls `this.dialog.open(SignInModalComponent, { ... })`.
2. **`HomeComponent` Template**:
   - Bind `(click)="openSignInModal()"` to the unauthenticated "Sign In" button.
   - Wrap dialog trigger/component import in `@defer (on interaction)`.
3. **Unit Tests (`home.component.spec.ts`)**:
   - Verify clicking the "Sign In" button invokes `dialog.open(SignInModalComponent, ...)`.
   - Verify dialog options passed to CDK Dialog match specifications.

## Acceptance Criteria

- [ ] Clicking "Sign In" on the Home screen opens the `SignInModalComponent` dialog.
- [ ] Sign-in modal code is deferred with `@defer (on interaction)`.
- [ ] Unit tests pass with 100% assertion coverage without lint errors.
