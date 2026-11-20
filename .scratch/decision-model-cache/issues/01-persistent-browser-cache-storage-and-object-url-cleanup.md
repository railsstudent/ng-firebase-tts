# 01: Persistent Browser Cache Storage, Single-Model Eviction, and Object URL Cleanup for On-Device Image Classification

**What to build:**
Persist the on-device decision model in the browser's native Cache Storage (`window.caches`, bucket `'decision-model-v1'`) inside `ImageClassifierService` (`src/app/core/vision/image-classifier.service.ts`) so that:

1. On a cache miss (first visit), the model at `decisionModelPath` is downloaded once via Angular `HttpClient` (`responseType: 'blob'`, `observe: 'response'`), wrapped in a Fetch `Response`, cloned into `'decision-model-v1'`, converted into a temporary `blob:` object URL via `URL.createObjectURL()`, passed as `baseOptions.modelAssetPath` to `DecisionMaker.createFromOptions()`, and revoked via `URL.revokeObjectURL()` in a `finally` block.
2. On a cache hit (after refreshing the page or reopening the browser tab), the cached response in `'decision-model-v1'` is converted directly into a `blob:` object URL and passed to `DecisionMaker.createFromOptions()` with zero `HttpClient.get()` calls, and revoked in `finally`.
3. Whenever `getCachedModelUrl(modelAssetPath)` runs, it enumerates `await cache.keys()` in `'decision-model-v1'` and deletes every cached `Request` whose `req.url !== modelAssetPath` via `cache.delete(req)`, ensuring outdated models never accumulate on disk.
4. `resolveDelegate()` continues checking `this.#configService.appConfig.decisionModelPath.endsWith('.litertlm')` **before** `getCachedModelUrl()` is called so non-WebGPU browsers still fast-fail to `'general'` without touching `window.caches` or the network, and WebGPU browsers still detect `.litertlm` even though `DecisionMaker.createFromOptions()` receives a `blob:` URL.
5. If `this.#window?.caches` is unavailable, throws a storage/quota error, or `HttpClient.get()` errors / returns an empty body on a cache miss, `getCachedModelUrl()` safely falls back to returning the original `modelAssetPath` string, and `initializeDecisionMaker()` still revokes any generated `blob:` URL in `finally` even if `DecisionMaker.createFromOptions()` or `prewarmChoice()` rejects.

**Blocked by:** None (can start immediately)

**Status:** done

## Target Files

- `src/app/core/vision/image-classifier.const.ts`
- `src/app/core/vision/image-classifier.service.ts`
- `src/app/core/vision/image-classifier.service.spec.ts`

## Step-by-Step Implementation Instructions

### Step 1: Export `DECISION_MODEL_CACHE_NAME` in `src/app/core/vision/image-classifier.const.ts`

- [x] Add the dedicated Cache Storage bucket name constant at the top of `src/app/core/vision/image-classifier.const.ts`:

  ```ts
  export const WASM_PATH = '/wasm';
  export const MAX_NUM_TOKENS = 512;
  export const DECISION_MODEL_CACHE_NAME = 'decision-model-v1';
  ```

### Step 2: Add Red -> Green Unit Tests in `src/app/core/vision/image-classifier.service.spec.ts`

- [x] In `src/app/core/vision/image-classifier.service.spec.ts`, widen `mockWindow`'s type so tests can optionally supply `caches?: Partial<CacheStorage>`:

  ```ts
  let mockWindow: { navigator: Record<string, unknown>; caches?: Partial<CacheStorage> } | null;
  ```

- [x] In `src/app/core/vision/image-classifier.service.spec.ts`, import `HttpClient`, `HttpErrorResponse`, `HttpResponse` from `@angular/common/http` and `of`, `throwError` from `rxjs`, then provide a mocked `HttpClient` at the `TestBed` DI boundary:

  ```ts
  let mockHttpClient: { get: ReturnType<typeof vi.fn> };

  // In beforeEach:
  mockHttpClient = {
    get: vi.fn(),
  };

  // In configureService() providers:
  {
    provide: HttpClient,
    useValue: mockHttpClient,
  },
  ```

- [ ] Update/add unit tests in `src/app/core/vision/image-classifier.service.spec.ts` covering cache miss persistence via `HttpClient`, cache hit zero-network reload, stale model eviction (`req.url !== modelAssetPath`), non-WebGPU fast-fail without touching `window.caches`, fallback when `window.caches` or `HttpClient.get()` fails, and `URL.revokeObjectURL` cleanup when `DecisionMaker.createFromOptions` or `prewarmChoice` rejects:

  ```ts
  it('should download and cache the model via HttpClient on cache miss, pass the blob URL to DecisionMaker, and revoke the blob URL after initialization', async () => {
    const modelUrl = mockConfigService.appConfig.decisionModelPath;
    const mockBlob = new Blob(['model-bytes']);
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
    mockHttpClient.get.mockReturnValue(of(new HttpResponse({ body: mockBlob, status: 200 })));
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/model-1');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    service = configureService();

    await service.classifyImage(sampleBytes);

    expect(mockWindow.caches?.open).toHaveBeenCalledWith('decision-model-v1');
    expect(mockCache.match).toHaveBeenCalledWith(modelUrl);
    expect(mockHttpClient.get).toHaveBeenCalledWith(modelUrl, {
      observe: 'response',
      responseType: 'blob',
    });
    expect(mockCache.put).toHaveBeenCalledWith(modelUrl, expect.any(Response));
    expect(mockCreateFromOptions).toHaveBeenCalledWith(mockWasmFileset, {
      baseOptions: {
        modelAssetPath: 'blob:http://localhost/model-1',
        delegate: 'GPU',
      },
      backendType: 3,
      maxNumTokens: 512,
    });
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:http://localhost/model-1');

    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
  });

  it('should load the model from Cache Storage without calling HttpClient on cache hit and evict stale cached model URLs', async () => {
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
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/cached-model');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    service = configureService();

    await service.classifyImage(sampleBytes);

    expect(mockCache.delete).toHaveBeenCalledTimes(1);
    expect(mockCache.delete).toHaveBeenCalledWith(staleRequest);
    expect(mockHttpClient.get).not.toHaveBeenCalled();
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

    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
  });

  it('should not touch window.caches when WebGPU is unavailable for a .litertlm model', async () => {
    const openSpy = vi.fn();
    mockWindow = {
      navigator: {},
      caches: {
        open: openSpy,
      },
    };
    service = configureService();

    const category = await service.classifyImage(sampleBytes);

    expect(category).toBe('general');
    expect(openSpy).not.toHaveBeenCalled();
    expect(mockHttpClient.get).not.toHaveBeenCalled();
    expect(mockForDecisionTasks).not.toHaveBeenCalled();
  });

  it('should fall back to original modelAssetPath when HttpClient.get errors on cache miss', async () => {
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
    mockHttpClient.get.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' })),
    );
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
  });

  it('should fall back to original modelAssetPath when Cache Storage throws', async () => {
    const modelUrl = mockConfigService.appConfig.decisionModelPath;
    mockWindow = {
      navigator: { gpu: {} },
      caches: {
        open: vi.fn().mockRejectedValue(new Error('QuotaExceededError')),
      },
    };
    service = configureService();

    await service.classifyImage(sampleBytes);

    expect(mockHttpClient.get).not.toHaveBeenCalled();
    expect(mockCreateFromOptions).toHaveBeenCalledWith(mockWasmFileset, {
      baseOptions: {
        modelAssetPath: modelUrl,
        delegate: 'GPU',
      },
      backendType: 3,
      maxNumTokens: 512,
    });
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

  it('should still revoke the temporary blob URL in finally when prewarmChoice rejects', async () => {
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
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/prewarm-fail');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    mockPrewarmChoice.mockRejectedValueOnce(new Error('Prewarm failed'));
    service = configureService();

    const category = await service.classifyImage(sampleBytes);

    expect(category).toBe('general');
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:http://localhost/prewarm-fail');

    warnSpy.mockRestore();
    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
  });
  ```

### Step 3: Implement `getCachedModelUrl` and `try / finally` Cleanup in `src/app/core/vision/image-classifier.service.ts`

- [x] In `src/app/core/vision/image-classifier.service.ts`:
  - Import `HttpClient` from `@angular/common/http`, `firstValueFrom` from `rxjs`, and `DECISION_MODEL_CACHE_NAME` from `./image-classifier.const`.
  - Inject `readonly #http = inject(HttpClient);` (`HttpClient` is provided in root by default in Angular v21+, with `FetchBackend` as the default).
  - Update `initializeDecisionMaker(modelAssetPath, delegate)` to resolve `const resolvedModelPath = await this.getCachedModelUrl(modelAssetPath)` and wrap `DecisionMaker.createFromOptions()` + `decisionMaker.prewarmChoice()` in a `try / finally` block that calls `URL.revokeObjectURL(resolvedModelPath)` whenever `resolvedModelPath.startsWith('blob:')`:

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
        const httpResponse = await firstValueFrom(
          this.#http.get(modelAssetPath, { observe: 'response', responseType: 'blob' }),
        );
        const downloadedBlob = httpResponse.body;
        if (!downloadedBlob) {
          return modelAssetPath;
        }
        response = new Response(downloadedBlob, {
          status: httpResponse.status,
          headers: {
            'Content-Type': httpResponse.headers.get('Content-Type') ?? 'application/octet-stream',
          },
        });
        await cache.put(modelAssetPath, response.clone());
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch {
      return modelAssetPath;
    }
  }
  ```

### Step 4: Verify

- [x] Run targeted unit tests for `src/app/core/vision/image-classifier.service.spec.ts` and ensure all tests pass.
- [x] Run linter (`ng lint`) and ensure zero warnings or errors.
