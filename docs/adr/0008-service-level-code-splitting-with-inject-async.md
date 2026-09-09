# 0008: Service-Level Code Splitting with `injectAsync` and `@defer` Strategy

- **Status**: Accepted
- **Date**: 2026-09-08

## Context

The application bundles several heavy third-party SDKs and browser APIs, including Angular Service Worker (`@angular/service-worker`), Firebase AI & Vertex AI modalities (`firebase/ai`), and the Web Audio API (`AudioContext`).

During initial bundle analysis (`npm run build`):

1. The **initial startup bundle** (`main.js` + framework shared chunks) totaled **404.31 kB raw (109.47 kB transfer)**.
2. Background PWA update checking was eagerly bundled into root `App` bootstrap through `PwaUpdateBanner` and `PwaUpdateService`.
3. Heavy Text-to-Speech (TTS) audio synthesis (WAV conversion, Base64 decoding, PCM normalization, and Web Audio pipelines) was eagerly included in the dashboard chunk, even though many visitors only upload images to read generated textual descriptions and tags without listening to audio.
4. Eager instantiation of browser-only APIs like `AudioContext` causes fatal `ReferenceError` crashes during Server-Side Rendering (SSR) and triggers browser autoplay policy warnings.

## Decision

We adopt a tiered code-splitting and lazy-loading architecture utilizing Angular 22's native `injectAsync()` and template-level `@defer` syntax:

### 1. Template-Level Component Deferral (`@defer (on idle)`)

- **PWA Update Banner (`PwaUpdateBanner`)**:
  - Encapsulated at the template boundary in `src/app/app.html` using `@defer (on idle) { <app-pwa-update-banner /> }`.
  - **Rationale**: Removes `@angular/service-worker`, `SwUpdate` streams, and `pwa-update-banner.css` entirely from the initial critical rendering path.
  - Keeps the component and `PwaUpdateService` purely synchronous, declarative, and signal-driven (`updateAvailable()` signal) without introducing custom asynchronous lifecycle wrappers.

### 2. Service-Level Code Splitting with `injectAsync()`

- **Text-To-Speech (`TextToSpeechService` & `AudioPlayerService`) — Pure On-Demand**:
  - Injected asynchronously in presentation view helpers (`TextToSpeechViewService`) using `injectAsync(() => import(...).then(m => m.TextToSpeechService))` **without prefetching**.
  - **Rationale**: Audio generation is an optional, secondary feature. TTS and Web Audio chunk bytes are only downloaded over the network if the user explicitly triggers audio playback.
- **Image Analysis (`VisionService`) — Idle Prefetched**:
  - Injected asynchronously in `AnalyzerPanelComponent` using `injectAsync(() => import(...).then(m => m.VisionService), { prefetch: onIdle })`.
  - **Rationale**: Image analysis is the primary user goal. Using `prefetch: onIdle` prevents initial render blocking (LCP protection) while eliminating click latency by fetching the chunk during the user's natural 2–5 second file-selection dwell time.

### 3. Web Audio & SSR Safe Initialization (`AudioPlayerService`)

- Direct instantiation of `AudioContext` in field declarations or constructors is strictly prohibited.
- `AudioContext` must remain lazily instantiated within explicit action methods (`initialize()`), guarded by platform/window checks (`this.#window?.AudioContext`).

### 4. Architectural Rules for Code Reviews & Maintenance

- **No Middle Man Smells**: Asynchronous getters or loader functions returned by `injectAsync()` are authorized architectural code-splitting seams. They MUST NOT be flagged by code review tooling as superfluous indirection or "Middle Man" code smells.
- **No Speculative Generality**: Code splitting is strictly reserved for modules identified through static bundle analysis (PWA, TTS, Vision). Generic services or lightweight domain utilities must remain standard synchronous `inject()`.
- **Encapsulation & Private State**: All internal service references and backing state MUST use JavaScript native private `#` prefixes (e.g. `readonly #getTtsService = injectAsync(...)`).

## Consequences

### Positive

- **Initial Bundle Reduction**: Moves PWA update polling out of critical startup, saving ~10 kB raw (~2.8 kB wire) and eliminating startup CPU contention.
- **Bandwidth Savings for Text Users**: Users who only read analysis text avoid downloading ~35 kB raw (~8.5 kB wire) of TTS and Web Audio processing code.
- **Preserved DI & Reactivity**: `injectAsync()` retains full Angular Dependency Injection context, singleton caching, and compatibility with Angular Signals.
- **SSR Resilience**: Prevents server-side rendering crashes caused by un-guarded Web Audio initialization.

### Negative / Trade-offs

- **Chunk Proliferation**: Increases total build output chunks from 4 to 6.
- **First-Click Audio Latency**: The very first time a user clicks "Play", there is a one-time ~15–30ms network fetch for the TTS chunk before stream initialization (mitigated by HTTP/2 and ServiceWorker disk caching on repeat visits).
