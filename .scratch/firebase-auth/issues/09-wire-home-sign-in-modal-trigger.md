# 09-wire-home-sign-in-modal-trigger

Type: task
Status: done
Blocked by: 07-create-sign-in-modal-dialog, 08-render-dynamic-home-auth-cta

## Description

Connect the unauthenticated "Sign In" button in `HomeComponent` to open the `SignInModalComponent` via Angular CDK Dialog with dynamic `import()` for optimal code-splitting and initial bundle performance.

## Target Files

- `src/app/features/home/home.component.ts`
- `src/app/features/home/home.component.html`
- `src/app/features/home/home.component.spec.ts`

## Design & Visual Specifications

1. **Design System & Interaction Contract (`DESIGN.md` Section 12 & 13)**:
   - When the user clicks the "Sign In" button on the Home screen, open the `SignInModalComponent` dialog.
   - Dialog configuration:
     - Backdrop: `backdropClass: 'backdrop-blur-sm bg-black/40'`.
     - Focus trapping and Escape key closing enabled by default via CDK Dialog.
   - Defer dialog code loading dynamically via `await import(...)` inside `openSignInModal()` to maintain minimal initial bundle overhead.

## Implementation Requirements

1. **`HomeComponent` TypeScript**:
   - Dynamic import inside `async openSignInModal()`:
     `const [{ SignInModalComponent }, { Dialog }] = await Promise.all([import('@/shared/ui/sign-in-modal/sign-in-modal.component'), import('@angular/cdk/dialog')]);`
   - Opens the dialog via `runInInjectionContext(this.#injector, () => inject(Dialog).open(SignInModalComponent, { backdropClass: ['backdrop-blur-sm', 'bg-black/40'] }))`.
   - **Edge Case (Rapid Multi-Click Protection)**: Prevent duplicate dialogs when the user clicks the "Sign In" button multiple times rapidly before dynamic loading resolves (e.g., guarded via an opening lock / active dialog check).
2. **`HomeComponent` Template**:
   - Unauthenticated "Sign In" button binds directly to the click handler without template references or `@defer`:
     `<button type="button" class="btn-primary btn-sign-in" (click)="openSignInModal()">`
3. **Unit Tests (`home.component.spec.ts`)**:
   - Verify clicking the "Sign In" button invokes `dialog.open(SignInModalComponent, ...)`.
   - Verify dialog options passed to CDK Dialog match specifications (`backdropClass: ['backdrop-blur-sm', 'bg-black/40']`).
   - Verify clicking the "Sign In" button multiple times rapidly only opens a single dialog instance (prevents duplicate modals).

## Acceptance Criteria

- [x] Unauthenticated "Sign In" button has `(click)="openSignInModal()"`.
- [x] `SignInModalComponent` and `Dialog` are dynamically imported and opened via CDK `Dialog.open()`.
- [x] Rapid multi-click protection is implemented so only a single dialog instance is opened.
- [x] No inline `<app-sign-in-modal />` or `@defer` block in `home.component.html`.
- [x] Unit tests pass with 100% assertion coverage without lint errors.
