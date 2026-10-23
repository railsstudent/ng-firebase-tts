# 01: Create `AiModelFactory` with Configurable Model Map Cache, TTS Cache, and ADR-0013

**What to build:**
Create a dedicated interface file `src/app/core/firebase/ai-model-options.interface.ts` and a centralized `AiModelFactory` in `src/app/core/firebase/ai-model-factory.service.ts` that encapsulates lazy dynamic importing of `firebase/ai` (preserving ADR-0008 service-level code splitting), caches general/structured/tool-enabled generative models in a `Map<string, GenerativeModel>` keyed by `${model}_${thinkingLevel}_${instruction}_${schemaKey}_${toolsKey}`, caches a single TTS model instance configured with `responseModalities: [ResponseModality.AUDIO]`, and automatically evicts cached models whenever `ConfigService.getAiBackend()` emits a new `AI` reference after Remote Config activation. Export both `AiModelOptions` and `AiModelFactory` from `src/app/core/firebase/index.ts`, add `createMockAiModelFactory` to `src/testing/ai-model.mock.ts`, author unit tests in `src/app/core/firebase/ai-model-factory.service.spec.ts`, and record `docs/adr/0013-centralized-ai-model-factory-and-generation-config.md`.

**Blocked by:** None (can start immediately)

**Status:** done

## Acceptance Criteria & Implementation Checklist

### 1. Create `AiModelOptions` Interface (`src/app/core/firebase/ai-model-options.interface.ts`)

- [x] Create `src/app/core/firebase/ai-model-options.interface.ts` defining options for model overrides, system instructions, structured JSON outputs, and tools:

  ```ts
  import type { SchemaRequest, Tool, TypedSchema } from 'firebase/ai';

  export interface AiModelOptions {
    systemInstruction?: string;
    schema?: SchemaRequest | TypedSchema;
    tools?: Tool[];
  }
  ```

### 2. Implement `AiModelFactory` (`src/app/core/firebase/ai-model-factory.service.ts`)

- [ ] Create `src/app/core/firebase/ai-model-factory.service.ts` adhering to repository ESLint invariants (native `#` for private state/dependencies, `private` keyword for methods, max 3 parameters per method, max 40 lines per function, zero `!` assertions, zero `../` imports):

  ```ts
  import { inject, Service } from '@angular/core';
  import type { AI, GenerationConfig, GenerativeModel, ModelParams, SafetySetting } from 'firebase/ai';
  import { HarmBlockThreshold, HarmCategory } from 'firebase/ai';
  import type { AiModelOptions } from './ai-model-options.interface';
  import { ConfigService } from './config.service';

  const SAFETY_SETTINGS: SafetySetting[] = [
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
  ];

  @Service()
  export class AiModelFactory {
    readonly #configService = inject(ConfigService);
    readonly #models = new Map<string, GenerativeModel>();
    #ttsModel: GenerativeModel | null = null;
    #cachedBackend: AI | null = null;

    async getModel(options?: AiModelOptions): Promise<GenerativeModel> {
      const backend = await this.getValidBackend();
      const key = this.generateKey(options);

      let model = this.#models.get(key);
      if (!model) {
        model = await this.createModel(backend, options);
        this.#models.set(key, model);
      }
      return model;
    }

    async getTtsModel(): Promise<GenerativeModel> {
      const backend = await this.getValidBackend();
      if (!this.#ttsModel) {
        this.#ttsModel = await this.createTtsModel(backend);
      }
      return this.#ttsModel;
    }

    private generateKey(options?: AiModelOptions): string {
      const { geminiModelName, thinkingLevel } = this.#configService.appConfig;
      const instruction = options?.systemInstruction ?? '';
      const schemaKey = options?.schema ? JSON.stringify(options.schema) : '';
      const toolsKey = options?.tools?.length ? JSON.stringify(options.tools) : '';

      return `${geminiModelName}_${thinkingLevel}_${instruction}_${schemaKey}_${toolsKey}`;
    }

    private async createModel(backend: AI, options?: AiModelOptions): Promise<GenerativeModel> {
      const { getGenerativeModel } = await import('firebase/ai');
      const { geminiModelName, thinkingLevel } = this.#configService.appConfig;

      const generationConfig: GenerationConfig = {
        thinkingConfig: {
          thinkingLevel,
          includeThoughts: true,
        },
      };

      if (options?.schema) {
        generationConfig.responseSchema = options.schema;
        generationConfig.responseMimeType = 'application/json';
      }

      const modelParams: ModelParams = {
        model: geminiModelName,
        generationConfig,
        safetySettings: SAFETY_SETTINGS,
      };

      if (options?.tools?.length) {
        modelParams.tools = options.tools;
      }

      if (options?.systemInstruction) {
        modelParams.systemInstruction = options.systemInstruction;
      }

      return getGenerativeModel(backend, modelParams);
    }

    private async createTtsModel(backend: AI): Promise<GenerativeModel> {
      const { getGenerativeModel, ResponseModality } = await import('firebase/ai');

      return getGenerativeModel(backend, {
        model: this.#configService.appConfig.geminiTTSModelName,
        generationConfig: {
          responseModalities: [ResponseModality.AUDIO],
        },
      });
    }

    private async getValidBackend(): Promise<AI> {
      const backend = await this.#configService.getAiBackend();
      if (this.#cachedBackend !== backend) {
        this.#cachedBackend = backend;
        this.#models.clear();
        this.#ttsModel = null;
      }
      return backend;
    }
  }
  ```

### 3. Export `AiModelFactory` from Firebase Barrel (`src/app/core/firebase/index.ts`)

- [x] Export `ai-model-options.interface` and `ai-model-factory.service` in `src/app/core/firebase/index.ts`:

  ```ts
  export * from './ai-model-factory.service';
  export * from './app-remote-config.interface';
  export * from './config.service';
  export * from './host.util';
  ```

### 4. Update Global AI Mocks & Add `createMockAiModelFactory` (`src/testing/firebase.mock.ts` & `src/testing/ai-model.mock.ts`)

- [x] Update `createVisionAiModel()`, `createTtsAiModel()`, and `mockGetGenerativeModel` in `src/testing/firebase.mock.ts` so returned mock models expose `generationConfig` (needed when callers spread `...model.generationConfig`) and return fresh wrapper instances per `getGenerativeModel` call while delegating to shared spy functions:

  ```ts
  interface MockAiModelMock {
    generationConfig?: Record<string, unknown>;
    generateContent: ReturnType<typeof vi.fn>;
    generateContentStream: ReturnType<typeof vi.fn>;
    startChat: ReturnType<typeof vi.fn>;
  }
  ```

  In `createVisionAiModel()`:

  ```ts
  function createVisionAiModel(): MockAiModelMock {
    return {
      generationConfig: {},
      generateContent: vi.fn().mockImplementation(async () => ({
        response: {
          text: () => '{"altText":"Test alt text","tags":["tag1"],"suggestions":[],"obscureFact":"Fact"}',
          thoughtSummary: () => 'Analysis thought summary',
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, thoughtsTokenCount: 0, totalTokenCount: 20 },
          candidates: [],
        },
      })),
      generateContentStream: vi.fn(),
      startChat: vi.fn(),
    };
  }
  ```

  In `createTtsAiModel()`:

  ```ts
  function createTtsAiModel(): MockAiModelMock {
    const parts = [{ inlineData: { data: 'SGVsbG8=', mimeType: 'audio/l16; rate=24000; channels=1' } }];
    return {
      generationConfig: { responseModalities: ['AUDIO'] },
      generateContent: vi.fn().mockImplementation(async () => ({
        response: { candidates: [{ content: { parts } }] },
      })),
      generateContentStream: vi.fn().mockImplementation(async () => ({
        stream: (async function* () {
          yield { candidates: [{ content: { parts } }] };
        })(),
      })),
      startChat: vi.fn(),
    };
  }
  ```

- [x] Update `src/testing/ai-model.mock.ts` to include `generationConfig` on `MockGenerativeModel` and export `createMockAiModelFactory`:

  ```ts
  import type { AiModelFactory } from '@/core/firebase';
  import { GenerationConfig, getGenerativeModel, GroundingMetadata, UsageMetadata } from 'firebase/ai';
  import { vi } from 'vitest';
  ```

  ```ts
  export interface MockGenerativeModel {
    generationConfig?: GenerationConfig;
    generateContent: ReturnType<typeof vi.fn>;
    generateContentStream: ReturnType<typeof vi.fn>;
  }

  export interface MockAiModelFactory {
    getModel: ReturnType<typeof vi.fn>;
    getTtsModel: ReturnType<typeof vi.fn>;
  }
  ```

  ```ts
  export function createMockAiModelFactory(options?: {
    model?: MockGenerativeModel;
    ttsModel?: MockGenerativeModel;
  }): MockAiModelFactory {
    const defaultModel = options?.model ?? createMockVisionModel();
    const defaultTtsModel = options?.ttsModel ?? createMockTtsModel();

    return {
      getModel: vi.fn().mockResolvedValue(defaultModel),
      getTtsModel: vi.fn().mockResolvedValue(defaultTtsModel),
    } satisfies Partial<AiModelFactory>;
  }
  ```

### 5. Add Unit Tests for `AiModelFactory` (`src/app/core/firebase/ai-model-factory.service.spec.ts`)

- [x] Create `src/app/core/firebase/ai-model-factory.service.spec.ts` verifying composite key ordering (`${model}_${thinkingLevel}_${instruction}_${schemaKey}_${toolsKey}`), general/structured/tool-enabled model Map caching, conditional `responseSchema` / `responseMimeType`, optional `tools` handling, TTS model caching with `ResponseModality.AUDIO`, and cache invalidation when `ConfigService.getAiBackend()` returns a new backend reference:

  ```ts
  import { createMockAiBackend, createMockConfigService, MockConfigService } from '@/testing/config.mock';
  import { mockGetGenerativeModel } from '@/testing/firebase.mock';
  import { TestBed } from '@angular/core/testing';
  import { HarmBlockThreshold, HarmCategory, ResponseModality, Schema, ThinkingLevel } from 'firebase/ai';
  import { AiModelFactory } from './ai-model-factory.service';
  import { ConfigService } from './config.service';

  describe('AiModelFactory', () => {
    let factory: AiModelFactory;
    let mockConfigService: MockConfigService;

    beforeEach(() => {
      mockGetGenerativeModel.mockClear();
      mockConfigService = createMockConfigService({
        appConfig: {
          geminiModelName: 'gemini-2.5-flash',
          geminiTTSModelName: 'gemini-2.5-flash-preview-tts',
          thinkingLevel: ThinkingLevel.LOW,
        },
      });

      TestBed.configureTestingModule({
        providers: [AiModelFactory, { provide: ConfigService, useValue: mockConfigService }],
      });

      factory = TestBed.inject(AiModelFactory);
    });

    describe('getModel', () => {
      it('should create a model with default model and thinking level without tools or schema when none are provided', async () => {
        const model = await factory.getModel();

        expect(model).toBeDefined();
        expect(mockGetGenerativeModel).toHaveBeenCalledTimes(1);
        expect(mockGetGenerativeModel).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            model: 'gemini-2.5-flash',
            generationConfig: {
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.LOW,
                includeThoughts: true,
              },
            },
            safetySettings: [
              {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
              {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
              {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
              {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
            ],
          }),
        );
        expect(mockGetGenerativeModel).not.toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ tools: expect.anything() }),
        );
      });

      it('should attach custom model, tools, responseSchema, responseMimeType: application/json, and systemInstruction when provided', async () => {
        const testSchema = Schema.object({ properties: { label: Schema.string() } });

        await factory.getModel({
          schema: testSchema,
          systemInstruction: 'Analyze carefully',
          tools: [{ googleMaps: {} }],
        });

        expect(mockGetGenerativeModel).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            model: 'gemini-2.5-pro',
            systemInstruction: 'Analyze carefully',
            tools: [{ googleMaps: {} }],
            generationConfig: {
              responseSchema: testSchema,
              responseMimeType: 'application/json',
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.LOW,
                includeThoughts: true,
              },
            },
          }),
        );
      });

      it('should return the cached model when called with identical model, tools, systemInstruction, and schema', async () => {
        const schemaA = Schema.object({ properties: { tag: Schema.string() } });
        const schemaB = Schema.object({ properties: { tag: Schema.string() } });

        const first = await factory.getModel({
          schema: schemaA,
          systemInstruction: 'Prompt 1',
          tools: [{ googleSearch: {} }],
        });
        const second = await factory.getModel({
          schema: schemaB,
          systemInstruction: 'Prompt 1',
          tools: [{ googleSearch: {} }],
        });

        expect(first).toBe(second);
        expect(mockGetGenerativeModel).toHaveBeenCalledTimes(1);
      });

      it('should create distinct cached instances when model, tools, schema, or systemInstruction differs', async () => {
        const schema = Schema.object({ properties: { a: Schema.string() } });

        await factory.getModel({ schema, systemInstruction: 'Inst A', tools: [{ googleSearch: {} }] });
        await factory.getModel({ schema, systemInstruction: 'Inst A', tools: [{ googleMaps: {} }] });
        await factory.getModel({ schema, systemInstruction: 'Inst B', tools: [{ googleSearch: {} }] });

        expect(mockGetGenerativeModel).toHaveBeenCalledTimes(3);
      });
    });

    describe('getTtsModel', () => {
      it('should create and cache a single TTS model configured with ResponseModality.AUDIO', async () => {
        const first = await factory.getTtsModel();
        const second = await factory.getTtsModel();

        expect(first).toBe(second);
        expect(mockGetGenerativeModel).toHaveBeenCalledTimes(1);
        expect(mockGetGenerativeModel).toHaveBeenCalledWith(expect.anything(), {
          model: 'gemini-2.5-flash-preview-tts',
          generationConfig: {
            responseModalities: [ResponseModality.AUDIO],
          },
        });
      });
    });

    describe('Backend Invalidation on Remote Config Update', () => {
      it('should clear cached models when ConfigService.getAiBackend returns a new backend instance', async () => {
        await factory.getModel();
        await factory.getTtsModel();
        expect(mockGetGenerativeModel).toHaveBeenCalledTimes(2);

        // Simulate Remote Config update returning a new AI backend instance
        const refreshedBackend = createMockAiBackend({ options: { projectId: 'refreshed-project' } });
        mockConfigService.getAiBackend.mockResolvedValue(refreshedBackend);

        await factory.getModel();
        await factory.getTtsModel();

        expect(mockGetGenerativeModel).toHaveBeenCalledTimes(4);
      });
    });
  });
  ```

### 6. Author ADR-0013 (`docs/adr/0013-centralized-ai-model-factory-and-generation-config.md`)

- [ ] Create `docs/adr/0013-centralized-ai-model-factory-and-generation-config.md` documenting the architectural context, trade-offs, composite key design, and shallow-spread mitigation:

  ```markdown
  # 0013: Centralized Generative Model Factory, Lifecycle Caching, and Request-Level GenerationConfig Protocol

  - **Status**: Accepted
  - **Date**: 2026-10-23

  ## Context

  Previously, `VisionService` and `TextToSpeechService` each invoked `getGenerativeModel()` directly on every inference call:

  1. **Redundant Instantiation**: Every `analyzeImage()`, `synthesize()`, or `synthesizeStream()` call constructed a brand-new `GenerativeModel` instance even when the underlying `AI` backend and model configuration had not changed.
  2. **Duplicated Model Setup**: Safety settings, thinking configuration, and `firebase/ai` imports were scattered across individual domain services.
  3. **SDK Shallow-Spread Pitfall in `generateContent`**: In the `@firebase/ai` Web SDK, `GenerativeModel.generateContent(request)` and `generateContentStream(request)` combine model defaults with per-request parameters via shallow object spread (`{ generationConfig: this.generationConfig, ...formattedParams }`). Passing `generationConfig: { speechConfig }` in a request completely overwrites `this.generationConfig`, dropping `responseModalities: [ResponseModality.AUDIO]` unless `...model.generationConfig` is spread into the request's `generationConfig`.

  ## Decision

  We introduce a centralized `AiModelFactory` (`src/app/core/firebase/ai-model-factory.service.ts`) governed by four invariants:

  1. **Lazy Dynamic SDK Import**: `AiModelFactory` loads `firebase/ai` via dynamic `await import('firebase/ai')` inside its private `createModel()` and `createTtsModel()` methods, preserving ADR-0008 service-level code splitting so `firebase/ai` never enters the initial critical bundle.
  2. **Deterministic Generative Model Map Cache**: Models are cached in a private `Map<string, GenerativeModel>` (`#models`) keyed by `${model}_${thinkingLevel}_${instruction}_${schemaKey}_${toolsKey}` in that exact order, separated by underscores (`_`). `model` defaults to `ConfigService.appConfig.geminiModelName`, `thinkingLevel` is resolved from `ConfigService.appConfig.thinkingLevel`, `tools` are attached only when explicitly provided in `options.tools`, and `responseSchema` and `responseMimeType: 'application/json'` are attached conditionally and cleanly only when a schema is provided.
  3. **Single Cached TTS Model with Request-Level Spread**: `AiModelFactory` caches a single `#ttsModel` configured with `generationConfig: { responseModalities: [ResponseModality.AUDIO] }`. Callers (`TextToSpeechService`) pass dynamic voice configurations per request by spreading `...model.generationConfig` alongside `speechConfig` inside `generateContent` and `generateContentStream`.
  4. **Automatic Eviction on Backend Rotation**: `AiModelFactory` tracks `#cachedBackend: AI | null`. Whenever `ConfigService.getAiBackend()` returns a new `AI` reference (such as after Remote Config activation resets `#ai = null`), `AiModelFactory` flushes `#models.clear()` and resets `#ttsModel = null`.

  ## Consequences

  - **Positive**: Eliminates per-request `GenerativeModel` allocation overhead across general multimodal, structured output, and TTS workflows while supporting multiple structured schemas, tool combinations (Search, Maps, custom functions), and dynamic TTS voices on cached model instances.
  - **Positive**: Centralizes safety settings, thinking config, and Remote Config cache invalidation in `@/core/firebase`.
  - **Guardrail**: Any service passing request-level `generationConfig` overrides to a cached `GenerativeModel` must spread `...model.generationConfig` so baseline model properties (such as `responseModalities`) are preserved.
  ```

### 7. Verification

- [x] Run targeted unit tests:

  ```bash
  npm run test:spec src/app/core/firebase/ai-model-factory.service.spec.ts
  ```

- [x] Run linter:

  ```bash
  npm run lint
  ```
