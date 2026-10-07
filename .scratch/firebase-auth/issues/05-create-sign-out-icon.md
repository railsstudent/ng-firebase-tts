# 05-create-sign-out-icon

Type: task
Status: done
Blocked by: 01-update-design-contract-for-auth

## Description

Create a standalone SVG icon component for the sign-out action adhering to the zero-dependency icon standard and design tokens specified in `DESIGN.md` and the Stitch screen "Firebase AI Logic Obscure Fact Speech Generator Home Screen (Authenticated)" (Screen ID: `214ae4ceea61404498cd8d132104fc84`).

## Target Files

- `src/app/shared/ui/icons/sign-out-icon.component.ts` (New)
- `src/app/shared/ui/icons/sign-out-icon.component.spec.ts` (New)

## Specifications & Requirements

1. **Design System & Visual Contract (`DESIGN.md` & Stitch Screen `214ae4ceea61404498cd8d132104fc84`)**:
   - Selector: `app-sign-out-icon`
   - Stylesheet: `styleUrl: './icon.css'` (`@apply app-icon`).
   - SVG Blueprint:
     - `viewBox="0 0 24 24"`
     - `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`
     - Path: `d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"`
     - Attributes: `aria-hidden="true" class="w-full h-full"`
2. **Unit Tests**:
   - Verify SVG element rendering, `aria-hidden="true"`, and path geometry.

## Acceptance Criteria

- [x] Implemented as zero-dependency SVG standalone component matching `DESIGN.md` and Stitch screen `214ae4ceea61404498cd8d132104fc84`.
- [x] Uses `@apply app-icon` and inherits text color via `stroke="currentColor"`.
