# 02: In-Memory Classifier Invalidation on Remote Config Model Switch and `DestroyRef` Teardown

**What to build:**
Mirror `AiModelFactory.getValidBackend()` inside `ImageClassifierService` (`src/app/core/vision/image-classifier.service.ts`) so that:

1. `ImageClassifierService` tracks `#cachedModelPath: string | null` alongside `#decisionMakerPromise: Promise<DecisionMaker> | null`.
2. When `getValidDecisionMaker(delegate)` is called and `this.#decisionMakerPromise` exists with `this.#cachedModelPath !== this.#configService.appConfig.decisionModelPath` (for example, after `ConfigService` updates `decisionModelPath` from Model `A` to Model `B` via Firebase Remote Config), it awaits `closeActiveDecisionMaker()` to call `.close()` on the previous `DecisionMaker` instance (wrapped in a `try / catch` so WASM teardown errors never block loading Model `B`), resets `#decisionMakerPromise = null` and `#cachedModelPath = null`, and initializes Model `B` (which automatically purges `A` from `window.caches` via Ticket `01` and downloads + caches `B`).
3. `ImageClassifierService` injects Angular's `DestroyRef` (`readonly #destroyRef = inject(DestroyRef)`) and registers `this.#destroyRef.onDestroy(() => this.closeActiveDecisionMaker())` in its constructor so destroying the Angular injector cleanly releases the active `DecisionMaker` WASM heap allocation.

**Blocked by:** `01: Persistent Browser Cache Storage, Single-Model Eviction, and Object URL Cleanup for On-Device Image Classification`

**Status:** ready-for-agent

## Target Files

- `src/app/core/vision/image-classifier.service.ts`
- `src/app/core/vision/image-classifier.service.spec.ts`

## Step-by-Step Implementation Instructions

### Step 1: Add Red -> Green Unit Tests in `src/app/core/vision/image-classifier.service.spec.ts`

- [ ] In `src/app/core/vision/image-classifier.service.spec.ts`, add `mockClose` to `vi.hoisted(...)` and include `close: mockClose` in the object resolved by `mockCreateFromOptions`:

  ```ts
  const { mockForDecisionTasks, mockCreateFromOptions, mockPrewarmChoice, mockEvaluateChoice, mockClose } = vi.hoisted(
    () => ({
      mockForDecisionTasks: vi.fn(),
      mockCreateFromOptions: vi.fn(),
      mockPrewarmChoice: vi.fn(),
      mockEvaluateChoice: vi.fn(),
      mockClose: vi.fn(),
    }),
  );
  ```

  Inside `beforeEach()`:

  ```ts
  mockClose.mockReset();
  mockCreateFromOptions.mockReset().mockResolvedValue({
    prewarmChoice: mockPrewarmChoice,
    evaluateChoice: mockEvaluateChoice,
    close: mockClose,
  });
  ```

- [ ] Add unit tests verifying:
  1. When `ConfigService.appConfig.decisionModelPath` changes from Model `A` to Model `B` between `classifyImage()` calls, the service closes the previous `DecisionMaker` for `A`, evicts `A` from `window.caches`, and initializes a new `DecisionMaker` for `B`.
  2. If `.close()` on the previous `DecisionMaker` throws an error during a model switch (`A → B`), the error is caught and ignored so Model `B` still initializes and classifies the image.
  3. When the Angular injector is destroyed (`TestBed.resetTestingModule()`), the `DestroyRef.onDestroy()` callback invokes `.close()` on the active `DecisionMaker`:

  ```ts
  it('should close the previous DecisionMaker, purge stale cache, and initialize the new model when decisionModelPath changes from A to B', async () => {
    const modelA = 'https://example.com/models/model-a.litertlm';
    const modelB = 'https://example.com/models/model-b.litertlm';
    mockConfigService = createMockConfigService({
      appConfig: createMockAppRemoteConfig({ decisionModelPath: modelA }),
    });
    const mockCache = {
      keys: vi.fn().mockResolvedValue([{ url: modelA } as Request]),
      match: vi.fn().mockResolvedValue({
        blob: vi.fn().mockResolvedValue(new Blob(['bytes'])),
      } as unknown as Response),
      put: vi.fn(),
      delete: vi.fn().mockResolvedValue(true),
    };
    mockWindow = {
      navigator: { gpu: {} },
      caches: {
        open: vi.fn().mockResolvedValue(mockCache),
      },
    };
    const createObjectUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:http://localhost/model-a')
      .mockReturnValueOnce('blob:http://localhost/model-b');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    service = configureService();

    await service.classifyImage(sampleBytes);
    expect(mockCreateFromOptions).toHaveBeenCalledTimes(1);
    expect(mockClose).not.toHaveBeenCalled();

    // Update Remote Config decisionModelPath from A to B
    mockConfigService.appConfig.decisionModelPath = modelB;

    await service.classifyImage(sampleBytes);

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockCache.delete).toHaveBeenCalledWith({ url: modelA });
    expect(mockCreateFromOptions).toHaveBeenCalledTimes(2);
    expect(mockCreateFromOptions).toHaveBeenLastCalledWith(mockWasmFileset, {
      baseOptions: {
        modelAssetPath: 'blob:http://localhost/model-b',
        delegate: 'GPU',
      },
      backendType: 3,
      maxNumTokens: 512,
    });

    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
  });

  it('should ignore errors thrown by close() when switching from model A to model B', async () => {
    mockClose.mockImplementationOnce(() => {
      throw new Error('WASM free error');
    });
    await service.classifyImage(sampleBytes);

    mockConfigService.appConfig.decisionModelPath = 'https://example.com/models/model-b.litertlm';
    mockEvaluateChoice.mockResolvedValueOnce({
      selectedKey: 'place',
      confidence: 0.9,
      probabilities: { place: 0.9, people: 0.05, general: 0.05 },
    });

    const category = await service.classifyImage(sampleBytes);

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockCreateFromOptions).toHaveBeenCalledTimes(2);
    expect(category).toBe('place');
  });

  it('should close the active DecisionMaker when DestroyRef destroys the service', async () => {
    await service.classifyImage(sampleBytes);
    expect(mockClose).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    await Promise.resolve();

    expect(mockClose).toHaveBeenCalledTimes(1);
  });
  ```

### Step 2: Implement `getValidDecisionMaker`, `closeActiveDecisionMaker`, and `DestroyRef` in `src/app/core/vision/image-classifier.service.ts`

- [ ] Import `DestroyRef` from `@angular/core` in `src/app/core/vision/image-classifier.service.ts`:

  ```ts
  import { DestroyRef, inject, Service } from '@angular/core';
  ```

- [ ] Inject `DestroyRef`, add `#cachedModelPath: string | null = null`, and register `this.#destroyRef.onDestroy(() => this.closeActiveDecisionMaker())` in the `constructor`:

  ```ts
  readonly #window = inject(WINDOW);
  readonly #configService = inject(ConfigService);
  readonly #destroyRef = inject(DestroyRef);
  #decisionMakerPromise: Promise<DecisionMaker> | null = null;
  #cachedModelPath: string | null = null;

  constructor() {
    this.#destroyRef.onDestroy(() => this.closeActiveDecisionMaker());
  }
  ```

- [ ] Replace `getDecisionMaker(delegate)` with `getValidDecisionMaker(delegate)` and `closeActiveDecisionMaker()`, and update `classifyImage()` to call `await this.getValidDecisionMaker(delegate)`:

  ```ts
  private async getValidDecisionMaker(delegate: 'GPU' | 'CPU'): Promise<DecisionMaker> {
    const modelAssetPath = this.#configService.appConfig.decisionModelPath;

    if (this.#decisionMakerPromise && this.#cachedModelPath !== modelAssetPath) {
      await this.closeActiveDecisionMaker();
    }

    if (!this.#decisionMakerPromise) {
      this.#cachedModelPath = modelAssetPath;
      this.#decisionMakerPromise = this.initializeDecisionMaker(modelAssetPath, delegate).catch((error) => {
        this.#decisionMakerPromise = null;
        this.#cachedModelPath = null;
        throw error;
      });
    }

    return this.#decisionMakerPromise;
  }

  private async closeActiveDecisionMaker(): Promise<void> {
    if (!this.#decisionMakerPromise) {
      return;
    }

    try {
      const decisionMaker = await this.#decisionMakerPromise;
      decisionMaker.close();
    } catch {
      // Ignore initialization or WASM teardown errors during cleanup
    } finally {
      this.#decisionMakerPromise = null;
      this.#cachedModelPath = null;
    }
  }
  ```

### Step 3: Verify

- [ ] Run targeted unit tests for `src/app/core/vision/image-classifier.service.spec.ts` and ensure all tests pass.
- [ ] Run `npm run lint` and `npm run test:once` to confirm zero violations across the workspace.
