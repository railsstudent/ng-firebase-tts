# Testing & Mocking Guide

This document defines testing conventions, DI mocking contracts, and verification workflows for `ng-firebase-tts`.

## Mocking Strategy & DI Providers

1. **TestBed Boundary Mocking**:
   - Always mock external dependencies and services at the Angular `TestBed` DI boundary.
   - Use `mock<ServiceName>` objects typed with `Partial<ServiceName>` and verified via `satisfies Partial<ServiceName>`:

     ```typescript
     const mockSpeechService = {
       activeAudio: signal(undefined),
       generateSpeech: vi.fn(),
     } satisfies Partial<SpeechService>;

     await TestBed.configureTestingModule({
       providers: [{ provide: SpeechService, useValue: mockSpeechService }],
     }).compileComponents();
     ```

2. **Preserve Class Encapsulation**:
   - Never widen `private` or `#` member visibility on production classes to facilitate testing.
   - Test components and services strictly through their public API surface (signals, inputs, outputs, public methods, and DOM behaviors).

3. **Isolated Mock Factories**:
   - Reusable or complex mocks across multiple spec files belong in `src/testing/` (e.g. `createMockConfigService`, `createMockAiModel`).
   - Never mutate shared mock instances across tests; instantiate fresh mock objects inside `beforeEach`.

4. **ESLint Compliance in Spec Files**:
   - Spec files (`*.spec.ts`) must adhere to ESLint config: no parent relative imports (`../`) in TypeScript (use sibling `./` or absolute `@/` path aliases), no missing curly braces, no legacy reactive forms, and no custom test classes expanding private member visibility.

5. **Firebase Global Mock Setup vs Spec Imports**:
   - `src/testing/firebase.mock.ts` is registered as a global `setupFiles` entry in `angular.json` / Vitest configuration.
   - Never import mock objects or helpers directly from `@/testing/firebase.mock` inside spec files. Doing so causes Vite/esbuild to code-split the setup file into a shared chunk, breaking `vi.mock` hoisting across worker threads in multi-file test runs.
   - Instead, import the SDK function directly from the Firebase module (e.g., `'firebase/ai'`) and wrap it with `vi.mocked(...)` (e.g., `const mockGetGenerativeModel = vi.mocked(getGenerativeModel)`).

## Test Execution Workflow

1. **Targeted Testing during Iterations**:
   - Use the `angular-cli` MCP server `run_target` tool with `target: "test"` to run tests against specific files:

     ```json
     {
       "coverage": true,
       "include": ["src/app/features/dashboard/components/tags-display/tags-display.component.spec.ts"]
     }
     ```

2. **Defer Full-Suite Verification to End-of-Task**:
   - Do NOT run full repo-wide commands (`npm run lint`, `npm test`, `npm run test:once`, `npm run build`) recursively after every individual edit.
   - Apply all contiguous edits first, then run full validation commands (`npm run lint`, `npm run test:once`) EXACTLY ONCE at the end of the complete task milestone.
