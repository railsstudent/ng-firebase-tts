# 0015: Persistent Browser Cache Storage and Automatic Eviction for On-Device Decision Model

- **Status**: Accepted
- **Date**: 2026-11-18

## Context

In [ADR-0014](0014-on-device-image-classification-and-specialized-vision-routing.md), `ImageClassifierService` initializes `@mediapipe/tasks-decision` (`DecisionMaker.createFromOptions`) by passing `decisionModelPath` (defaulting to the ~388 MB `embeddinggemma-2-text-vision-440m.litertlm` hosted on Hugging Face) into `baseOptions.modelAssetPath`.

Because standard browser HTTP caches routinely evict or bypass single assets weighing hundreds of megabytes, refreshing the page or reopening the application in a new browser tab causes `DecisionMaker.createFromOptions()` to re-download the entire `.litertlm` model over the network on the first image analysis.

We evaluated three alternatives for persistent client-side model caching:

1. **Angular Service Worker (`ngsw-config.json` `dataGroups`)**: Couples third-party model host URLs to static service worker configuration, does not run during `ng serve` development, and does not proactively purge orphaned multi-hundred-megabyte entries when `decisionModelPath` changes in Firebase Remote Config.
2. **`web-ai-model-proxy-cache` (`FileProxyCache`)**: A standalone utility script without published TypeScript declarations or an eviction API. If `decisionModelPath` is updated in Firebase Remote Config, previously cached 128 MB shards remain orphaned in Cache Storage indefinitely unless custom `window.caches` cleanup logic is written alongside it anyway.
3. **Native Browser Cache Storage API (`window.caches`) inside `ImageClassifierService`**: Uses standard browser `CacheStorage` directly with zero third-party dependencies, full TypeScript safety, deterministic single-model eviction whenever `decisionModelPath` changes, and immediate `URL.revokeObjectURL()` memory cleanup.

## Decision

We implement persistent model caching and automatic stale-model eviction directly inside `ImageClassifierService` (`src/app/core/vision/image-classifier.service.ts`) using the browser's native `window.caches` API:

1. **Hardware Delegate Resolution Before Cache Access**:
   - `resolveDelegate(modelAssetPath)` inspects the original configured `decisionModelPath` string (e.g., `.endsWith('.litertlm')`) **before** resolving or converting the cached response into a `blob:` URL (since `blob:` URLs do not preserve the `.litertlm` extension).
   - When WebGPU is unavailable and `decisionModelPath` ends with `.litertlm`, `classifyImage()` fast-fails to `'general'` before opening `window.caches` or issuing a network request.

2. **In-Memory Cache Invalidation (`getValidDecisionMaker`) & `DestroyRef` Teardown**:
   - Mirroring `AiModelFactory.getValidBackend()`, `ImageClassifierService` tracks `#cachedModelPath: string | null` alongside `#decisionMakerPromise: Promise<DecisionMaker> | null`.
   - When `getValidDecisionMaker(modelAssetPath, delegate)` is called and `this.#decisionMakerPromise` exists with `this.#cachedModelPath !== modelAssetPath` (for example, after `ConfigService` activates a new `decisionModelPath` from Firebase Remote Config), it awaits `closeActiveDecisionMaker()` to invoke `.close()` on the previous `DecisionMaker` instance (wrapped in a `try / catch` so WASM teardown errors never block loading the new model), resets `#decisionMakerPromise = null` and `#cachedModelPath = null`, and initializes the new model.
   - `ImageClassifierService` also injects Angular's `DestroyRef` and registers `this.#destroyRef.onDestroy(() => void this.closeActiveDecisionMaker())` so injector teardown releases the active `DecisionMaker` WASM heap allocation through the same helper.

3. **Dedicated Cache Bucket & Single-Model Auto-Eviction (`DECISION_MODEL_CACHE_NAME`)**:
   - `ImageClassifierService` opens a dedicated cache bucket (`'decision-model-v1'`) via `this.#window?.caches?.open(...)`.
   - On initialization, it enumerates `await cache.keys()` and deletes every cached `Request` whose `req.url !== modelAssetPath` via `cache.delete(req)`. Updating the model in Firebase Remote Config uses a distinct `decisionModelPath` URL string, guaranteeing that at most one model ever occupies disk storage on the user's device without exposing manual cache-management buttons in the UI.

4. **Cache Hit, Cache Miss, and `URL.createObjectURL` Lifecycle**:
   - **Cache Hit**: When `await cache.match(modelAssetPath)` returns a cached `Response`, it converts the response via `await response.blob()` into a local `blob:` URL using `URL.createObjectURL(blob)` and passes that URL as `baseOptions.modelAssetPath` to `DecisionMaker.createFromOptions()`.
   - **Cache Miss**: When `cache.match(modelAssetPath)` returns `undefined`, it fetches `modelAssetPath` via `fetch(modelAssetPath)`. Only when `networkResponse.ok` is `true` does it persist `await cache.put(modelAssetPath, networkResponse.clone())` and create the `blob:` object URL from `await networkResponse.blob()`.
   - **Deterministic Memory Reclamation**: Because `DecisionMaker.createFromOptions()` copies the model into WebAssembly/WebGPU memory during initialization, `initializeDecisionMaker()` wraps `DecisionMaker.createFromOptions()` and `decisionMaker.prewarmChoice()` in a `try / finally` block that always calls `URL.revokeObjectURL(resolvedModelPath)` whenever `resolvedModelPath.startsWith('blob:')`, preventing duplicate model buffers from lingering in RAM even if initialization or prewarming rejects.

5. **Graceful Fallback**:
   - If `this.#window?.caches` is unavailable, throws a storage/quota error, or `fetch(modelAssetPath)` returns a non-OK response on a cache miss, cache resolution catches the error and returns the original `modelAssetPath` string so `DecisionMaker.createFromOptions()` can attempt standard loading (falling back to `'general'` via the existing `classifyImage()` error boundary if loading fails).

## Consequences

- **Positive**: Eliminates multi-hundred-megabyte network re-downloads on page refreshes and newly opened browser tabs, reducing post-refresh cold start to local disk read + WebGPU initialization (~1–2 seconds).
- **Positive**: Automatically reclaims both WASM/GPU memory (`DecisionMaker.close()`) and disk space (`cache.delete()`) when `decisionModelPath` changes via Firebase Remote Config or when the Angular injector is destroyed (`DestroyRef`), and immediately reclaims temporary `blob:` URL memory via `URL.revokeObjectURL()`.
- **Positive**: Zero new npm dependencies and zero bytes added to the initial `main.js` bundle (lives entirely behind the existing lazy `VisionService` boundary).
