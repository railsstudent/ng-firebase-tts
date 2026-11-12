# 03: Implement `ImageClassifierService` Using `@mediapipe/tasks-decision` and EmbeddingGemma 2

**What to build:**
Implement `ImageClassifierService` in `src/app/core/vision/image-classifier.service.ts` to perform **On-Device Image Classification** using `@mediapipe/tasks-decision` (`FilesetResolver.forDecisionTasks('/wasm')` and `DecisionMaker.createFromOptions`) and the multimodal EmbeddingGemma 2 model (`decisionModelPath` on WebGPU). Prewarm the mutually exclusive `ChoiceQuestion` (`place`, `people`, `general`, with `place` taking precedence when a recognizable landmark is visible behind a person) once per session, and gracefully fall back to `'general'` whenever `confidence < decisionConfidenceThreshold` (`0.4`) or when WebGPU / model initialization / evaluation fails.

**Blocked by:** 01: Configure Local `/wasm` Asset Serving and Remote Config Decision Parameters (`ConfigService`), 02: Extend Vision Preprocessing with `imageBytes` and Update Vision Domain Interfaces

**Status:** ready-for-agent

## Target Files

- `src/app/core/vision/image-classifier.service.ts` (New)
- `src/app/core/vision/image-classifier.service.spec.ts` (New)
- `src/testing/image-classifier.mock.ts` (New)
- `knip.json`

## Acceptance Criteria & Implementation Checklist

### 1. Implement `ImageClassifierService` (`src/app/core/vision/image-classifier.service.ts`)

- [ ] Create `src/app/core/vision/image-classifier.service.ts` adhering to repository ESLint rules (native `#` for private state/deps, `private` keyword for methods, max 40 lines per function, zero `!` assertions, zero `../` imports). Do **not** export `ImageClassifierService` from `src/app/core/vision/index.ts` so it stays isolated behind the lazy `VisionService` boundary:

  ```ts
  import { WINDOW } from '@/core/constants/navigator.const';
  import { ConfigService } from '@/core/firebase';
  import { inject, Service } from '@angular/core';
  import type { ChoiceQuestion, DecisionMaker } from '@mediapipe/tasks-decision';
  import type { ImageSubjectCategory } from './image-analysis.interface';

  const WASM_PATH = '/wasm';
  const MAX_NUM_TOKENS = 512;

  export const IMAGE_CATEGORY_QUESTION: ChoiceQuestion = {
    criteria: {
      place:
        'A recognizable landmark, monument, building, streetscape, or geographic location, even if people or faces appear in the foreground.',
      people:
        'A portrait, close-up face, solo person, or group of people where human subjects are the primary focus without a recognizable landmark.',
      general:
        'Objects, animals, food, documents, nature close-ups, abstract scenes, or any image that is neither a recognizable place nor focused on people.',
    },
    normalizePrior: true,
  };

  @Service()
  export class ImageClassifierService {
    readonly #window = inject(WINDOW);
    readonly #configService = inject(ConfigService);
    #decisionMakerPromise: Promise<DecisionMaker> | null = null;

    async classifyImage(imageBytes: Uint8Array): Promise<ImageSubjectCategory> {
      const { decisionModelPath, decisionConfidenceThreshold } = this.#configService.appConfig;
      const delegate = this.resolveDelegate(decisionModelPath);
      if (!delegate) {
        return 'general';
      }

      try {
        const decisionMaker = await this.getDecisionMaker(decisionModelPath, delegate);
        const result = await decisionMaker.evaluateChoice({ imageBytes }, IMAGE_CATEGORY_QUESTION);

        if (result.confidence < decisionConfidenceThreshold) {
          return 'general';
        }

        if (result.selectedKey === 'place' || result.selectedKey === 'people') {
          return result.selectedKey;
        }

        return 'general';
      } catch (error: unknown) {
        console.warn('[ImageClassifierService] On-device classification failed, falling back to general:', error);
        return 'general';
      }
    }

    private resolveDelegate(modelAssetPath: string): 'GPU' | 'CPU' | null {
      const hasWebGpu = Boolean(this.#window?.navigator && 'gpu' in this.#window.navigator);
      if (hasWebGpu) {
        return 'GPU';
      }
      if (modelAssetPath.endsWith('.litertlm')) {
        return null;
      }
      return 'CPU';
    }

    private getDecisionMaker(modelAssetPath: string, delegate: 'GPU' | 'CPU'): Promise<DecisionMaker> {
      if (!this.#decisionMakerPromise) {
        this.#decisionMakerPromise = this.initializeDecisionMaker(modelAssetPath, delegate).catch((error: unknown) => {
          this.#decisionMakerPromise = null;
          throw error;
        });
      }
      return this.#decisionMakerPromise;
    }

    private async initializeDecisionMaker(modelAssetPath: string, delegate: 'GPU' | 'CPU'): Promise<DecisionMaker> {
      const { DecisionMaker, FilesetResolver } = await import('@mediapipe/tasks-decision');
      const wasmFileset = await FilesetResolver.forDecisionTasks(WASM_PATH);
      const decisionMaker = await DecisionMaker.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath,
          delegate,
        },
        maxNumTokens: MAX_NUM_TOKENS,
      });

      await decisionMaker.prewarm({
        questions: [
          {
            id: 'category',
            type: 'choice',
            prompt: 'Classify the primary subject category of this image.',
            options: Object.entries(IMAGE_CATEGORY_QUESTION.criteria ?? {}).map(([label, description]) => ({
              label,
              description,
            })),
            normalizePrior: true,
          },
        ],
      });

      return decisionMaker;
    }
  }
  ```

- [ ] Remove `"@mediapipe/tasks-decision"` from `ignoreDependencies` in `knip.json` once `ImageClassifierService` imports `@mediapipe/tasks-decision`.

### 2. Create Shared Test Mock Factory (`src/testing/image-classifier.mock.ts`)

- [ ] Create `src/testing/image-classifier.mock.ts` for downstream `VisionService` unit tests:

  ```ts
  import type { ImageSubjectCategory } from '@/core/vision';
  import type { ImageClassifierService } from '@/core/vision/image-classifier.service';
  import { vi } from 'vitest';

  export interface MockImageClassifierService {
    classifyImage: ReturnType<typeof vi.fn>;
  }

  export function createMockImageClassifierService(
    defaultCategory: ImageSubjectCategory = 'general',
  ): MockImageClassifierService {
    return {
      classifyImage: vi.fn().mockResolvedValue(defaultCategory),
    } satisfies Partial<ImageClassifierService>;
  }
  ```

### 3. Add Unit Tests (`src/app/core/vision/image-classifier.service.spec.ts`)

- [ ] Create `src/app/core/vision/image-classifier.service.spec.ts` implementing all behavioral cases (including `.litertlm` WebGPU fast-fail, `.task` CPU fallback, `console.warn`, initialization retry, and per-call inference error isolation) for the Red -> Green TDD loop:

  ```ts
  import { WINDOW } from '@/core/constants/navigator.const';
  import { ConfigService } from '@/core/firebase';
  import { createMockAppRemoteConfig, createMockConfigService } from '@/testing/config.mock';
  import { TestBed } from '@angular/core/testing';
  import { IMAGE_CATEGORY_QUESTION, ImageClassifierService } from './image-classifier.service';

  const { mockForDecisionTasks, mockCreateFromOptions, mockPrewarm, mockEvaluateChoice } = vi.hoisted(() => ({
    mockForDecisionTasks: vi.fn(),
    mockCreateFromOptions: vi.fn(),
    mockPrewarm: vi.fn(),
    mockEvaluateChoice: vi.fn(),
  }));

  vi.mock('@mediapipe/tasks-decision', () => ({
    FilesetResolver: {
      forDecisionTasks: mockForDecisionTasks,
    },
    DecisionMaker: {
      createFromOptions: mockCreateFromOptions,
    },
  }));

  describe('ImageClassifierService', () => {
    let service: ImageClassifierService;
    let mockConfigService: ReturnType<typeof createMockConfigService>;
    let mockWindow: { navigator: Record<string, unknown> } | null;
    const sampleBytes = new Uint8Array([1, 2, 3, 4]);
    const mockWasmFileset = { wasmLoaderPath: '/wasm/decision_wasm_internal.js' };

    function configureService(): ImageClassifierService {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          ImageClassifierService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
          {
            provide: WINDOW,
            useValue: mockWindow,
          },
        ],
      });
      return TestBed.inject(ImageClassifierService);
    }

    beforeEach(() => {
      mockForDecisionTasks.mockReset().mockResolvedValue(mockWasmFileset);
      mockPrewarm.mockReset().mockResolvedValue(undefined);
      mockEvaluateChoice.mockReset().mockResolvedValue({
        selectedKey: 'general',
        confidence: 0.75,
        probabilities: { general: 0.75, people: 0.15, place: 0.1 },
      });
      mockCreateFromOptions.mockReset().mockResolvedValue({
        prewarm: mockPrewarm,
        evaluateChoice: mockEvaluateChoice,
      });

      mockWindow = {
        navigator: {
          gpu: {},
        },
      };
      mockConfigService = createMockConfigService();
      service = configureService();
    });

    it('should initialize DecisionMaker with /wasm and GPU delegate and prewarm only once across multiple classifyImage calls', async () => {
      await service.classifyImage(sampleBytes);
      await service.classifyImage(sampleBytes);

      expect(mockForDecisionTasks).toHaveBeenCalledTimes(1);
      expect(mockForDecisionTasks).toHaveBeenCalledWith('/wasm');
      expect(mockCreateFromOptions).toHaveBeenCalledTimes(1);
      expect(mockCreateFromOptions).toHaveBeenCalledWith(mockWasmFileset, {
        baseOptions: {
          modelAssetPath: mockConfigService.appConfig.decisionModelPath,
          delegate: 'GPU',
        },
        maxNumTokens: 512,
      });
      expect(mockPrewarm).toHaveBeenCalledTimes(1);
      expect(mockEvaluateChoice).toHaveBeenCalledTimes(2);
      expect(mockEvaluateChoice).toHaveBeenCalledWith({ imageBytes: sampleBytes }, IMAGE_CATEGORY_QUESTION);
    });

    it('should fast-fail to "general" without loading WASM or downloading model when WebGPU is unavailable for a .litertlm model', async () => {
      mockWindow = { navigator: {} };
      service = configureService();

      const category = await service.classifyImage(sampleBytes);

      expect(category).toBe('general');
      expect(mockForDecisionTasks).not.toHaveBeenCalled();
      expect(mockCreateFromOptions).not.toHaveBeenCalled();
    });

    it('should fall back to CPU delegate when WebGPU is unavailable and decisionModelPath is a .task model', async () => {
      mockWindow = { navigator: {} };
      mockConfigService = createMockConfigService({
        appConfig: createMockAppRemoteConfig({
          decisionModelPath: 'https://example.com/models/laya.task',
        }),
      });
      service = configureService();

      await service.classifyImage(sampleBytes);

      expect(mockCreateFromOptions).toHaveBeenCalledWith(mockWasmFileset, {
        baseOptions: {
          modelAssetPath: 'https://example.com/models/laya.task',
          delegate: 'CPU',
        },
        maxNumTokens: 512,
      });
    });

    it('should return "people" when evaluateChoice selects "people" above the confidence threshold', async () => {
      mockEvaluateChoice.mockResolvedValueOnce({
        selectedKey: 'people',
        confidence: 0.85,
        probabilities: { people: 0.85, place: 0.1, general: 0.05 },
      });

      const category = await service.classifyImage(sampleBytes);
      expect(category).toBe('people');
    });

    it('should return "place" when evaluateChoice selects "place" above the confidence threshold', async () => {
      mockEvaluateChoice.mockResolvedValueOnce({
        selectedKey: 'place',
        confidence: 0.72,
        probabilities: { place: 0.72, people: 0.2, general: 0.08 },
      });

      const category = await service.classifyImage(sampleBytes);
      expect(category).toBe('place');
    });

    it('should return "general" when evaluateChoice selects "general" or an unrecognized key', async () => {
      mockEvaluateChoice.mockResolvedValueOnce({
        selectedKey: 'general',
        confidence: 0.6,
        probabilities: { general: 0.6, people: 0.2, place: 0.2 },
      });

      const category = await service.classifyImage(sampleBytes);
      expect(category).toBe('general');
    });

    it('should fall back to "general" when confidence is below decisionConfidenceThreshold (0.4)', async () => {
      mockEvaluateChoice.mockResolvedValueOnce({
        selectedKey: 'place',
        confidence: 0.39,
        probabilities: { place: 0.39, people: 0.31, general: 0.3 },
      });

      const category = await service.classifyImage(sampleBytes);
      expect(category).toBe('general');
    });

    it('should log console.warn, fall back to "general" when initialization rejects, and retry initialization on the next call', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      mockCreateFromOptions.mockRejectedValueOnce(new Error('Network timeout'));

      const firstAttempt = await service.classifyImage(sampleBytes);
      expect(firstAttempt).toBe('general');
      expect(warnSpy).toHaveBeenCalledTimes(1);

      mockEvaluateChoice.mockResolvedValueOnce({
        selectedKey: 'people',
        confidence: 0.9,
        probabilities: { people: 0.9, place: 0.05, general: 0.05 },
      });

      const secondAttempt = await service.classifyImage(sampleBytes);
      expect(secondAttempt).toBe('people');
      expect(mockCreateFromOptions).toHaveBeenCalledTimes(2);
      warnSpy.mockRestore();
    });

    it('should log console.warn and return "general" when evaluateChoice rejects while keeping DecisionMaker cached', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      mockEvaluateChoice.mockRejectedValueOnce(new Error('Corrupt image bytes'));

      const firstAttempt = await service.classifyImage(sampleBytes);
      expect(firstAttempt).toBe('general');
      expect(warnSpy).toHaveBeenCalledTimes(1);

      mockEvaluateChoice.mockResolvedValueOnce({
        selectedKey: 'place',
        confidence: 0.88,
        probabilities: { place: 0.88, people: 0.06, general: 0.06 },
      });

      const secondAttempt = await service.classifyImage(sampleBytes);
      expect(secondAttempt).toBe('place');
      expect(mockCreateFromOptions).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });
  });
  ```

### 4. Verification

- [ ] Run targeted unit tests:

  ```bash
  npm run test:spec src/app/core/vision/image-classifier.service.spec.ts
  ```
