# 05-create-sign-out-icon

Type: task
Status: ready-for-agent
Blocked by: 01-update-design-contract-for-auth

## Description

Create a standalone SVG icon component for the sign-out action adhering to the zero-dependency icon standard and design tokens.

## Target Files

- `src/app/shared/ui/icons/sign-out-icon.component.ts` (New)
- `src/app/shared/ui/icons/sign-out-icon.component.spec.ts` (New)

## Specifications & Requirements

1. **Component Definition**:
   - Selector: `app-sign-out-icon`
   - Standalone component with `changeDetection: ChangeDetectionStrategy.OnPush`.
   - Stylesheet: `styleUrl: './icon.css'` (`@apply app-icon`).
   - Template: Clean SVG logout glyph (door/arrow) with `fill="currentColor"` and `aria-hidden="true"`.
2. **Unit Tests**:
   - Verify SVG element rendering and host class presence.

## Acceptance Criteria

- [ ] Implemented as zero-dependency SVG standalone component.
- [ ] Uses `@apply app-icon` and inherits text color.
