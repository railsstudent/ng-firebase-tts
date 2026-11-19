# 01: Persistent Browser Cache Storage, Single-Model Eviction, and Object URL Cleanup for On-Device Image Classification

**What to build:**
Persist the on-device decision model in the browser's native Cache Storage (`window.caches`, bucket `'decision-model-v1'`) inside `ImageClassifierService` (`src/app/core/vision/image-classifier.service.ts`) so that:

1. On a cache miss (first visit), the model at `decisionModelPath` is fetched once, cloned into `'decision-model-v1'`, converted into a temporary `blob:` object URL via `URL.createObjectURL()`, passed as `baseOptions.modelAssetPath` to `DecisionMaker.createFromOptions()`, and revoked via `URL.revokeObjectURL()` in a `finally` block.
2. On a cache hit (after refreshing the page or reopening the browser tab), the cached response in `'decision-model-v1'` is converted directly into a `blob:` object URL and passed to `DecisionMaker.createFromOptions()` with zero network `fetch()` calls, and revoked in `finally`.
3. Whenever `getCachedModelUrl(modelAssetPath)` runs, it enumerates `await cache.keys()` in `'decision-model-v1'` and deletes every cached `Request` whose `req.url !== modelAssetPath` via `cache.delete(req)`, ensuring outdated models never accumulate on disk.
4. `resolveDelegate()` continues checking `this.#configService.appConfig.decisionModelPath.endsWith('.litertlm')` **before** `getCachedModelUrl()` is called so non-WebGPU browsers still fast-fail to `'general'` without touching `window.caches` or the network, and WebGPU browsers still detect `.litertlm` even though `DecisionMaker.createFromOptions()` receives a `blob:` URL.
5. If `this.#window?.caches` is unavailable, throws a storage/quota error, or `fetch()` returns a non-OK response on a cache miss, `getCachedModelUrl()` safely falls back to returning the original `modelAssetPath` string, and `initializeDecisionMaker()` still revokes any generated `blob:` URL in `finally` even if `DecisionMaker.createFromOptions()` or `prewarmChoice()` rejects.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Target Files

- `src/app/core/vision/image-classifier.const.ts`
- `src/app/core/vision/image-classifier.service.ts`
- `src/app/core/vision/image-classifier.service.spec.ts`

## Step-by-Step Implementation Instructions

### Step 1: Export `DECISION_MODEL_CACHE_NAME` in `src/app/core/vision/image-classifier.const.ts`

- [ ] Add the dedicated Cache Storage bucket name constant at the top of `src/app/core/vision/image-classifier.const.ts`:

  ```ts
  export const WASM_PATH = '/wasm';
  export const MAX_NUM_TOKENS = 512;
  export const DECISION_MODEL_CACHE_NAME = 'decision-model-v1';
  ```

### Step 2: Add Red -> Green Unit Tests in `src/app/core/vision/image-classifier.service.spec.ts`

- [ ] In `src/app/core/vision/image-classifier.service.spec.ts`, widen `mockWindow`'s type so tests can optionally supply `caches?: Partial<CacheStorage>`:

  ```ts
  let mockWindow: { navigator: Record<string, unknown>; caches?: Partial<CacheStorage> } | null;
  ```

- [ ] Add unit tests covering cache miss persistence, cache hit zero-network reload, stale model eviction (`req.url !== modelAssetPath`), non-WebGPU fast-fail without touching `window.caches`, fallback when `window.caches` or `fetch` fails, and `URL.revokeObjectURL` cleanup when `DecisionMaker.createFromOptions` or `prewarmChoice` rejects:

  ```ts
  it('should fetch and cache the model on cache miss, pass the blob URL to DecisionMaker, and revoke the blob URL after initialization', async () => {
    const modelUrl = mockConfigService.appConfig.decisionModelPath;
    const mockBlob = new Blob(['model-bytes']);
    const clonedResponse = { blob: vi.fn().mockResolvedValue(mockBlob) } as unknown as Response;
    const networkResponse = {
      ok: true,
      clone: vi.fn().mockReturnValue(clonedResponse),
      blob: vi.fn().mockResolvedValue(mockBlob),
    } as unknown as Response;
    const mockCache = {
      keys: vi.fn().mockResolvedValue([]),
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(true),
    };
    mockWindow = {
      navigator: { gpu: {} },
      caches: {
        open: vi.fn().mockResolvedValue(mockCache),
      },
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(networkResponse);
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/model-1');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    service = configureService();

    await service.classifyImage(sampleBytes);

    expect(mockWindow.caches?.open).toHaveBeenCalledWith('decision-model-v1');
    expect(mockCache.match).toHaveBeenCalledWith(modelUrl);
    expect(fetchSpy).toHaveBeenCalledWith(modelUrl);
    expect(mockCache.put).toHaveBeenCalledWith(modelUrl, clonedResponse);
    expect(mockCreateFromOptions).toHaveBeenCalledWith(mockWasmFileset, {
      baseOptions: {
        modelAssetPath: 'blob:http://localhost/model-1',
        delegate: 'GPU',
      },
      backendType: 3,
      maxNumTokens: 512,
    });
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:http://localhost/model-1');

    fetchSpy.mockRestore();
    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
  });

  it('should load the model from Cache Storage without calling fetch on cache hit and evict stale cached model URLs', async () => {
    const activeModelUrl = mockConfigService.appConfig.decisionModelPath;
    const staleRequest = { url: 'https://example.com/old-model.litertlm' } as Request;
    const activeRequest = { url: activeModelUrl } as Request;
    const mockBlob = new Blob(['cached-bytes']);
    const cachedResponse = {
      blob: vi.fn().mockResolvedValue(mockBlob),
    } as unknown as Response;
    const mockCache = {
      keys: vi.fn().mockResolvedValue([staleRequest, activeRequest]),
      match: vi.fn().mockResolvedValue(cachedResponse),
      put: vi.fn(),
      delete: vi.fn().mockResolvedValue(true),
    };
    mockWindow = {
      navigator: { gpu: {} },
      caches: {
        open: vi.fn().mockResolvedValue(mockCache),
      },
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/cached-model');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    service = configureService();

    await service.classifyImage(sampleBytes);

    expect(mockCache.delete).toHaveBeenCalledTimes(1);
    expect(mockCache.delete).toHaveBeenCalledWith(staleRequest);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockCache.put).not.toHaveBeenCalled();
    expect(mockCreateFromOptions).toHaveBeenCalledWith(mockWasmFileset, {
      baseOptions: {
        modelAssetPath: 'blob:http://localhost/cached-model',
        delegate: 'GPU',
      },
      backendType: 3,
      maxNumTokens: 512,
    });
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:http://localhost/cached-model');

    fetchSpy.mockRestore();
    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
  });

  it('should fall back to original modelAssetPath when fetch returns non-ok on cache miss or Cache Storage throws', async () => {
    const modelUrl = mockConfigService.appConfig.decisionModelPath;
    const mockCache = {
      keys: vi.fn().mockResolvedValue([]),
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn(),
      delete: vi.fn(),
    };
    mockWindow = {
      navigator: { gpu: {} },
      caches: {
        open: vi.fn().mockResolvedValue(mockCache),
      },
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 503 } as Response);
    service = configureService();

    await service.classifyImage(sampleBytes);

    expect(mockCache.put).not.toHaveBeenCalled();
    expect(mockCreateFromOptions).toHaveBeenCalledWith(mockWasmFileset, {
      baseOptions: {
        modelAssetPath: modelUrl,
        delegate: 'GPU',
      },
      backendType: 3,
      maxNumTokens: 512,
    });

    fetchSpy.mockRestore();
  });

  it('should still revoke the temporary blob URL in finally when DecisionMaker.createFromOptions rejects', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const mockBlob = new Blob(['cached-bytes']);
    const cachedResponse = {
      blob: vi.fn().mockResolvedValue(mockBlob),
    } as unknown as Response;
    const mockCache = {
      keys: vi.fn().mockResolvedValue([]),
      match: vi.fn().mockResolvedValue(cachedResponse),
      put: vi.fn(),
      delete: vi.fn(),
    };
    mockWindow = {
      navigator: { gpu: {} },
      caches: {
        open: vi.fn().mockResolvedValue(mockCache),
      },
    };
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/fail-model');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    mockCreateFromOptions.mockRejectedValueOnce(new Error('WASM init failed'));
    service = configureService();

    const category = await service.classifyImage(sampleBytes);

    expect(category).toBe('general');
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:http://localhost/fail-model');

    warnSpy.mockRestore();
    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
  });
  ```

### Step 3: Implement `getCachedModelUrl` and `try / finally` Cleanup in `src/app/core/vision/image-classifier.service.ts`

- [ ] Import `DECISION_MODEL_CACHE_NAME` from `./image-classifier.const` in `src/app/core/vision/image-classifier.service.ts`.
- [ ] Update `initializeDecisionMaker(modelAssetPath, delegate)` to resolve `const resolvedModelPath = await this.getCachedModelUrl(modelAssetPath)` and wrap `DecisionMaker.createFromOptions()` + `decisionMaker.prewarmChoice()` in a `try / finally` block that calls `URL.revokeObjectURL(resolvedModelPath)` whenever `resolvedModelPath.startsWith('blob:')`:

  ```ts
  private async initializeDecisionMaker(modelAssetPath: string, delegate: 'GPU' | 'CPU'): Promise<DecisionMaker> {
    const { DecisionMaker, FilesetResolver } = await import('@mediapipe/tasks-decision');
    const wasmFileset = await FilesetResolver.forDecisionTasks(WASM_PATH);
    const resolvedModelPath = await this.getCachedModelUrl(modelAssetPath);

    try {
      const decisionMaker = await DecisionMaker.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath: resolvedModelPath,
          delegate,
        },
        backendType: 3,
        maxNumTokens: MAX_NUM_TOKENS,
      });

      await decisionMaker.prewarmChoice(IMAGE_CATEGORY_QUESTION);

      return decisionMaker;
    } finally {
      if (resolvedModelPath.startsWith('blob:')) {
        URL.revokeObjectURL(resolvedModelPath);
      }
    }
  }

  private async getCachedModelUrl(modelAssetPath: string): Promise<string> {
    const cacheStorage = this.#window?.caches;
    if (!cacheStorage) {
      return modelAssetPath;
    }

    try {
      const cache = await cacheStorage.open(DECISION_MODEL_CACHE_NAME);
      const keys = await cache.keys();
      await Promise.all(
        keys.filter((req) => req.url !== modelAssetPath).map((req) => cache.delete(req)),
      );

      let response = await cache.match(modelAssetPath);
      if (!response) {
        const networkResponse = await fetch(modelAssetPath);
        if (!networkResponse.ok) {
          return modelAssetPath;
        }
        await cache.put(modelAssetPath, networkResponse.clone());
        response = networkResponse;
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch {
      return modelAssetPath;
    }
  }
  ```

### Step 4: Verify

- [ ] Run targeted unit tests for `src/app/core/vision/image-classifier.service.spec.ts` and ensure all tests pass.
- [ ] Run linter (`ng lint`) and ensure zero warnings or errors.
