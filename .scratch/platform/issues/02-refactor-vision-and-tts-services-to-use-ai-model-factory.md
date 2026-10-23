# 02: Refactor `VisionService` and `TextToSpeechService` to Consume `AiModelFactory`

**What to build:**
Refactor `VisionService` (`src/app/core/vision/vision.service.ts`) and `TextToSpeechService` (`src/app/core/speech/text-to-speech.service.ts`) to lazily inject `AiModelFactory` via `injectAsync(() => import('@/core/firebase/ai-model-factory.service').then((m) => m.AiModelFactory))` instead of `ConfigService` and remove their local `getGenerativeAIModel()` / `createModel()` methods. In `VisionService`, retrieve the cached model via `await asyncAIModelFactory.getModel({ schema: ImageAnalysisSchema, tools: [{ googleSearch: {} }] })`. In `TextToSpeechService`, retrieve the single cached TTS model via `await asyncAIModelFactory.getTtsModel()` and pass per-call `speechConfig` inside `generateContent` and `generateContentStream` while spreading `...aiModel.generationConfig` so `responseModalities: [ResponseModality.AUDIO]` is preserved. Update `vision.service.spec.ts` and `text-to-speech.service.spec.ts` to mock `AiModelFactory` at the `TestBed` boundary.

**Blocked by:** 01: Create `AiModelFactory` with Configurable Model Map Cache, TTS Cache, and ADR-0013

**Status:** in_progress

## Acceptance Criteria & Implementation Checklist

### 1. Refactor `VisionService` to Use `AiModelFactory` (`src/app/core/vision/vision.service.ts`)

- [x] Replace `ConfigService` injection, `SAFETY_SETTINGS`, and `private getGenerativeAIModel(backend: AI)` in `src/app/core/vision/vision.service.ts` with `injectAsync` of `AiModelFactory` and `await asyncAIModelFactory.getModel({ schema: ImageAnalysisSchema, tools: [{ googleSearch: {} }] })`:

  ````ts
  import { WINDOW } from '@/core/constants/navigator.const';
  import { inject, injectAsync, Service } from '@angular/core';
  import type { GroundingMetadata, UsageMetadata, WebGroundingChunk } from 'firebase/ai';
  import type {
    ImageAnalysis,
    ImageAnalysisResponse,
    TokenUsage,
    VisionGroundingMetadata,
  } from './image-analysis.interface';
  import { ImageAnalysisSchema } from './image-analysis.schema';
  import { preprocessImageForVision } from './image.util';
  import { altTextPrompt } from './vision.prompt';

  @Service()
  export class VisionService {
    readonly #window = inject(WINDOW);
    readonly #aiModelFactory = injectAsync(() =>
      import('@/core/firebase/ai-model-factory.service').then((m) => m.AiModelFactory),
    );

    async analyzeImage(image: File): Promise<ImageAnalysisResponse> {
      if (!image) {
        throw Error('image is required to generate texts.');
      }

      const { data, mimeType, optimizationMetrics } = await preprocessImageForVision(image, this.#window);
      const imagePart = {
        inlineData: {
          data,
          mimeType,
        },
      };

      const asyncAIModelFactory = await this.#aiModelFactory();
      const aiModel = await asyncAIModelFactory.getModel({
        schema: ImageAnalysisSchema,
        tools: [{ googleSearch: {} }],
      });
      const result = await aiModel.generateContent([altTextPrompt, imagePart]);

      if (result?.response) {
        const response = result.response;
        const thought = response.thoughtSummary() || '';
        const text = response.text().replace(/```json\n?|```/g, '');
        const parsed: ImageAnalysis = JSON.parse(text);
        const tokenUsage = this.getTokenUsage(response.usageMetadata);
        const citations = this.constructCitations(response.candidates?.[0]?.groundingMetadata);

        return {
          parsed,
          thought,
          tokenUsage,
          metadata: citations,
          optimizationMetrics,
        };
      }
      throw Error('No text generated.');
    }

    private constructCitations(groundingMetadata?: GroundingMetadata): VisionGroundingMetadata {
      if (!groundingMetadata) {
        return {
          citations: [],
          renderedContent: '',
          searchQueries: [],
        };
      }

      const supports = groundingMetadata.groundingSupports || [];
      const chunks = groundingMetadata.groundingChunks || [];
      const citations = supports.flatMap((support) =>
        (support.groundingChunkIndices || [])
          .map((idx) => chunks[idx]?.web)
          .filter((web): web is WebGroundingChunk => !!web),
      );

      const renderedContent = groundingMetadata.searchEntryPoint?.renderedContent || '';
      const searchQueries = (groundingMetadata.webSearchQueries || []).filter((query) => !!query);

      return {
        citations,
        renderedContent,
        searchQueries,
      };
    }

    private getTokenUsage(usageMetadata?: UsageMetadata): TokenUsage {
      return {
        input: usageMetadata?.promptTokenCount || 0,
        output: usageMetadata?.candidatesTokenCount || 0,
        thought: usageMetadata?.thoughtsTokenCount || 0,
        total: usageMetadata?.totalTokenCount || 0,
      };
    }
  }
  ````

### 2. Update `VisionService` Unit Tests (`src/app/core/vision/vision.service.spec.ts`)

- [ ] Update `src/app/core/vision/vision.service.spec.ts` to provide `AiModelFactory` via `createMockAiModelFactory` and assert that `getModel` is called with `{ schema: ImageAnalysisSchema, tools: [{ googleSearch: {} }] }`:

  ```ts
  import { AiModelFactory } from '@/core/firebase';
  import {
    createMockAiModelFactory,
    createMockVisionModel,
    createMockVisionResponse,
    MockAiModelFactory,
  } from '@/testing/ai-model.mock';
  import { TestBed } from '@angular/core/testing';
  import { ImageAnalysisSchema } from './image-analysis.schema';
  import { VisionService } from './vision.service';

  describe('VisionService', () => {
    let service: VisionService;
    let mockAiModel: ReturnType<typeof createMockVisionModel>;
    let mockAiModelFactory: MockAiModelFactory;

    beforeEach(() => {
      mockAiModel = createMockVisionModel();
      mockAiModel.generateContent.mockClear();
      mockAiModel.generateContent.mockResolvedValue(createMockVisionResponse());

      mockAiModelFactory = createMockAiModelFactory({ model: mockAiModel });

      TestBed.configureTestingModule({
        providers: [
          VisionService,
          {
            provide: AiModelFactory,
            useValue: mockAiModelFactory,
          },
        ],
      });

      service = TestBed.inject(VisionService);
    });

    it('should throw an error if image file is not provided', async () => {
      await expect(service.analyzeImage(null as unknown as File)).rejects.toThrow(
        'image is required to generate texts.',
      );
    });

    it('should request the model with ImageAnalysisSchema and Google Search tool and parse complete response', async () => {
      const mockImageAnalysis = {
        altText: 'A beautiful sunset over the mountains',
        tags: ['sunset', 'mountains', 'scenery'],
        suggestions: [{ title: 'Add foreground interest', reason: 'To make composition stronger' }],
        obscureFact: 'Sunsets on Mars are actually blue because of fine dust particles.',
      };

      const fakeFile = new File(['hello-world'], 'test-image.png', { type: 'image/png' });
      const result = await service.analyzeImage(fakeFile);

      expect(mockAiModelFactory.getModel).toHaveBeenCalledWith({
        schema: ImageAnalysisSchema,
        tools: [{ googleSearch: {} }],
      });
      expect(mockAiModel.generateContent).toHaveBeenCalledTimes(1);
      expect(result.parsed).toEqual(mockImageAnalysis);
      expect(result.thought).toBe('Analyzing the uploaded landscape photo step-by-step.');
      expect(result.tokenUsage).toEqual({
        input: 150,
        output: 200,
        thought: 50,
        total: 400,
      });
      expect(result.metadata.citations).toEqual([
        {
          uri: 'https://nasa.gov/mars-blue-sunset',
          title: 'Why Sunsets on Mars are Blue',
        },
      ]);
      expect(result.metadata.searchQueries).toEqual(['blue sunset mars reason']);
      expect(result.metadata.renderedContent).toBe('Google Search for blue sunset Mars');
      expect(result.optimizationMetrics).toBeDefined();
    });

    it('should throw an error if generateContent returns an invalid or empty response', async () => {
      mockAiModel.generateContent.mockResolvedValue(null);

      const fakeFile = new File([''], 'test-image.png', { type: 'image/png' });
      await expect(service.analyzeImage(fakeFile)).rejects.toThrow('No text generated.');
    });
  });
  ```

### 3. Refactor `TextToSpeechService` to Use `AiModelFactory` & Request-Level `speechConfig` Spread (`src/app/core/speech/text-to-speech.service.ts`)

- [x] Replace `ConfigService` injection and `private createModel(voiceName: string)` in `src/app/core/speech/text-to-speech.service.ts` with `injectAsync` of `AiModelFactory`, retrieve the cached model via `await asyncAIModelFactory.getTtsModel()`, and construct the `GenerateContentRequest` via `private createGenerationRequest(aiModel: GenerativeModel, text: string, voiceName: string): GenerateContentRequest` that spreads `...aiModel.generationConfig` alongside `speechConfig`:

  ```ts
  import { injectAsync, Service } from '@angular/core';
  import type {
    Content,
    GenerateContentRequest,
    GenerateContentResponse,
    GenerationConfig,
    GenerativeModel,
  } from 'firebase/ai';
  import { decodeAudioChunk, toWavBlob } from './audio.util';
  import { AudioStreamChunk, SpeechChunkData, SpeechPrompt } from './text-to-speech.interface';

  @Service()
  export class TextToSpeechService {
    readonly #aiModelFactory = injectAsync(() =>
      import('@/core/firebase/ai-model-factory.service').then((m) => m.AiModelFactory),
    );

    private extractValidChunkData(chunk: GenerateContentResponse): SpeechChunkData | null {
      const inlineData = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!inlineData?.data || !inlineData?.mimeType) {
        return null;
      }
      return { data: inlineData.data, mimeType: inlineData.mimeType };
    }

    /**
     * USE CASE 2 (Streamed Synthesis):
     * Yields decoded audio chunks as they arrive from the Gemini model.
     */
    async *synthesizeStream({ text, voice }: SpeechPrompt): AsyncGenerator<AudioStreamChunk> {
      const asyncAIModelFactory = await this.#aiModelFactory();
      const aiModel = await asyncAIModelFactory.getTtsModel();
      const generationRequest = this.createGenerationRequest(aiModel, text, voice);
      const responseStream = await aiModel.generateContentStream(generationRequest);

      for await (const chunk of responseStream.stream) {
        const chunkData = this.extractValidChunkData(chunk);
        if (chunkData) {
          const { data, mimeType } = chunkData;
          yield decodeAudioChunk(data, mimeType);
        }
      }
    }

    private createGenerationRequest(aiModel: GenerativeModel, text: string, voiceName: string): GenerateContentRequest {
      const contents: Content[] = [
        {
          role: 'user',
          parts: [
            {
              text,
            },
          ],
        },
      ];
      const generationConfig: GenerationConfig = {
        ...aiModel.generationConfig,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
          languageCode: 'en-US',
        },
      };

      return { contents, generationConfig };
    }

    /**
     * USE CASE 1 (Ad-hoc Single-shot):
     * Fetches the entire audio content at once, constructs a Blob, and returns it.
     */
    async synthesize({ text, voice }: SpeechPrompt): Promise<Blob> {
      try {
        const asyncAIModelFactory = await this.#aiModelFactory();
        const aiModel = await asyncAIModelFactory.getTtsModel();

        const generationRequest = this.createGenerationRequest(aiModel, text, voice);
        const result = await aiModel.generateContent(generationRequest);
        const chunk = this.extractValidChunkData(result.response);
        if (!chunk) {
          throw new Error('No audio data received in response.');
        }
        return toWavBlob(chunk.data, chunk.mimeType);
      } catch (e) {
        console.error('Ad-hoc single-shot synthesis failed:', e);
        throw e;
      }
    }
  }
  ```

### 4. Update `TextToSpeechService` Unit Tests (`src/app/core/speech/text-to-speech.service.spec.ts`)

- [x] Update `src/app/core/speech/text-to-speech.service.spec.ts` to provide `AiModelFactory` via `createMockAiModelFactory` and assert that `generateContent` and `generateContentStream` receive the preserved `responseModalities: ['AUDIO']` along with dynamic `speechConfig`:

  ```ts
  import { AiModelFactory } from '@/core/firebase';
  import {
    createMockAiModelFactory,
    createMockTtsModel,
    createMockTtsResponse,
    createMockTtsStream,
    MockAiModelFactory,
  } from '@/testing/ai-model.mock';
  import { TestBed } from '@angular/core/testing';
  import { TextToSpeechService } from './text-to-speech.service';

  describe('TextToSpeechService', () => {
    let service: TextToSpeechService;
    let mockAiModel: ReturnType<typeof createMockTtsModel>;
    let mockAiModelFactory: MockAiModelFactory;

    beforeEach(() => {
      mockAiModel = createMockTtsModel();
      mockAiModel.generateContent.mockClear();
      mockAiModel.generateContentStream.mockClear();

      mockAiModelFactory = createMockAiModelFactory({ ttsModel: mockAiModel });

      TestBed.configureTestingModule({
        providers: [
          TextToSpeechService,
          {
            provide: AiModelFactory,
            useValue: mockAiModelFactory,
          },
        ],
      });

      service = TestBed.inject(TextToSpeechService);
    });

    describe('On-demand Model Resolution', () => {
      it('should resolve TTS model via AiModelFactory only on demand during synthesis', async () => {
        let testService!: TextToSpeechService;
        TestBed.runInInjectionContext(() => {
          testService = new TextToSpeechService();
        });

        expect(mockAiModelFactory.getTtsModel).not.toHaveBeenCalled();

        mockAiModel.generateContent.mockResolvedValue(createMockTtsResponse());

        await testService.synthesize({ text: 'Test 1', voice: 'Kore' });
        expect(mockAiModelFactory.getTtsModel).toHaveBeenCalledTimes(1);

        await testService.synthesize({ text: 'Test 2', voice: 'Puck' });
        expect(mockAiModelFactory.getTtsModel).toHaveBeenCalledTimes(2);
      });
    });

    describe('synthesize (Use Case 1 - Ad-hoc Single-shot)', () => {
      it('should pass speechConfig while preserving responseModalities from model.generationConfig and return WAV Blob', async () => {
        const mockBase64 = 'SGVsbG8=';
        mockAiModel.generateContent.mockResolvedValue(createMockTtsResponse({ base64Data: mockBase64 }));
        const blob = await service.synthesize({ text: 'Hello Fact', voice: 'Kore' });

        expect(mockAiModelFactory.getTtsModel).toHaveBeenCalledTimes(1);
        expect(mockAiModel.generateContent).toHaveBeenCalledWith({
          contents: [{ role: 'user', parts: [{ text: 'Hello Fact' }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
              languageCode: 'en-US',
            },
          },
        });
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('audio/wav');
      });

      it('should throw an error if generateContent returns empty candidates or data', async () => {
        mockAiModel.generateContent.mockResolvedValue({
          response: {},
        });

        await expect(service.synthesize({ text: 'Empty Fact', voice: 'Puck' })).rejects.toThrow(
          'No audio data received in response.',
        );
      });
    });

    describe('synthesizeStream (Use Case 2 - Streamed Synthesis)', () => {
      it('should stream chunks while preserving responseModalities in generationConfig and yield AudioStreamChunk objects', async () => {
        mockAiModel.generateContentStream.mockResolvedValue(
          createMockTtsStream([
            { data: 'SGVsbG8=', mimeType: 'audio/l16; rate=24000; channels=1' },
            { data: 'V29ybGQ=', mimeType: 'audio/l16; rate=24000; channels=1' },
          ]),
        );

        const generator = service.synthesizeStream({ text: 'Dynamic Stream', voice: 'Kore' });
        const emissions = [];
        for await (const chunk of generator) {
          emissions.push(chunk);
        }

        expect(mockAiModelFactory.getTtsModel).toHaveBeenCalledTimes(1);
        expect(mockAiModel.generateContentStream).toHaveBeenCalledWith({
          contents: [{ role: 'user', parts: [{ text: 'Dynamic Stream' }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
              languageCode: 'en-US',
            },
          },
        });
        expect(emissions.length).toBe(2);
        expect(emissions[0]).toEqual({
          decodedData: expect.any(Uint8Array),
          sampleRate: 24000,
          mimeType: 'audio/l16; rate=24000; channels=1',
        });
        expect(emissions[1]).toEqual({
          decodedData: expect.any(Uint8Array),
          sampleRate: 24000,
          mimeType: 'audio/l16; rate=24000; channels=1',
        });
      });

      it('should rethrow on stream errors', async () => {
        mockAiModel.generateContentStream.mockRejectedValue(new Error('Vertex AI stream error'));

        const generator = service.synthesizeStream({ text: 'Failing stream', voice: 'Puck' });
        await expect(generator.next()).rejects.toThrow('Vertex AI stream error');
      });
    });
  });
  ```

### 5. Verification

- [x] Run targeted unit tests:

  ```bash
  npm run test:spec src/app/core/vision/vision.service.spec.ts
  npm run test:spec src/app/core/speech/text-to-speech.service.spec.ts
  ```

- [x] Run complete linting and testing suite:

  ```bash
  npm run lint && npm run test:once
  ```
