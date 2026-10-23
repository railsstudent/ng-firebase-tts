# 02: Refactor `VisionService` and `TextToSpeechService` to Consume `AiModelFactory`

**What to build:**
Refactor `VisionService` (`src/app/core/vision/vision.service.ts`) and `TextToSpeechService` (`src/app/core/speech/text-to-speech.service.ts`) to inject `AiModelFactory` instead of `ConfigService` and remove their local `getGenerativeAIModel()` / `createModel()` methods. In `VisionService`, retrieve the cached model via `await this.#aiModelFactory.getModel({ schema: ImageAnalysisSchema, tools: [{ googleSearch: {} }] })`. In `TextToSpeechService`, retrieve the single cached TTS model via `await this.#aiModelFactory.getTtsModel()` and pass per-call `speechConfig` inside `generateContent` and `generateContentStream` while spreading `...model.generationConfig` so `responseModalities: [ResponseModality.AUDIO]` is preserved. Update `vision.service.spec.ts` and `text-to-speech.service.spec.ts` to mock `AiModelFactory` at the `TestBed` boundary.

**Blocked by:** 01: Create `AiModelFactory` with Configurable Model Map Cache, TTS Cache, and ADR-0013

**Status:** ready-for-agent

## Acceptance Criteria & Implementation Checklist

### 1. Refactor `VisionService` to Use `AiModelFactory` (`src/app/core/vision/vision.service.ts`)

- [ ] Replace `ConfigService` injection, `SAFETY_SETTINGS`, and `private getGenerativeAIModel(backend: AI)` in `src/app/core/vision/vision.service.ts` with `AiModelFactory` and `await this.#aiModelFactory.getModel({ schema: ImageAnalysisSchema, tools: [{ googleSearch: {} }] })`:

  ````ts
  import { WINDOW } from '@/core/constants/navigator.const';
  import { AiModelFactory } from '@/core/firebase';
  import { inject, Service } from '@angular/core';
  import type { GroundingMetadata, UsageMetadata, WebGroundingChunk } from 'firebase/ai';
  import {
    ImageAnalysis,
    ImageAnalysisResponse,
    TokenUsage,
    VisionGroundingMetadata,
  } from './image-analysis.interface';
  import { ImageAnalysisSchema } from './image-analysis.schema';
  import { preprocessImageForVision } from './image.util';

  @Service()
  export class VisionService {
    readonly #window = inject(WINDOW);
    readonly #aiModelFactory = inject(AiModelFactory);

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

      const altTextPrompt = `
  You are asked to perform four tasks:
  Task 1: Generate 1 - 3 sentences of alternative texts for the image provided, max 300 words.
  Task 2: Generate at least 3 tags to describe the image.
  Task 3: Based on the alternative text and tags, provide some suggestions to make the image more interesting and the reason to support them.
  Task 4: Search for a surprising or obscure fact that interconnects the following tags. If a direct link doesn't exist, find a conceptual link between them.
  `;
      const aiModel = await this.#aiModelFactory.getModel({
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

- [ ] Replace `ConfigService` injection and `private createModel(voiceName: string)` in `src/app/core/speech/text-to-speech.service.ts` with `AiModelFactory`, retrieve the cached model via `await this.#aiModelFactory.getTtsModel()`, and construct the `GenerateContentRequest` via `private buildSpeechRequest(model: GenerativeModel, text: string, voiceName: string): GenerateContentRequest` that spreads `...model.generationConfig` alongside `speechConfig`:

  ```ts
  import { AiModelFactory } from '@/core/firebase';
  import { inject, Service } from '@angular/core';
  import type { GenerateContentRequest, GenerateContentResponse, GenerativeModel } from 'firebase/ai';
  import { decodeAudioChunk, toWavBlob } from './audio.util';
  import { AudioStreamChunk, SpeechChunkData, SpeechPrompt } from './text-to-speech.interface';

  @Service()
  export class TextToSpeechService {
    readonly #aiModelFactory = inject(AiModelFactory);

    private extractValidChunkData(chunk: GenerateContentResponse): SpeechChunkData | null {
      const inlineData = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!inlineData?.data || !inlineData?.mimeType) {
        return null;
      }
      return { data: inlineData.data, mimeType: inlineData.mimeType };
    }

    private buildSpeechRequest(model: GenerativeModel, text: string, voiceName: string): GenerateContentRequest {
      return {
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
          ...model.generationConfig,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
            languageCode: 'en-US',
          },
        },
      };
    }

    /**
     * USE CASE 2 (Streamed Synthesis):
     * Yields decoded audio chunks as they arrive from the Gemini model.
     */
    async *synthesizeStream({ text, voice }: SpeechPrompt): AsyncGenerator<AudioStreamChunk> {
      const model = await this.#aiModelFactory.getTtsModel();
      const responseStream = await model.generateContentStream(this.buildSpeechRequest(model, text, voice));

      for await (const chunk of responseStream.stream) {
        const chunkData = this.extractValidChunkData(chunk);
        if (chunkData) {
          const { data, mimeType } = chunkData;
          yield decodeAudioChunk(data, mimeType);
        }
      }
    }

    /**
     * USE CASE 1 (Non-Streamed Synthesis):
     * Generates the entire speech audio and returns a playable WAV Blob.
     */
    async synthesize({ text, voice }: SpeechPrompt): Promise<Blob> {
      const model = await this.#aiModelFactory.getTtsModel();
      const response = await model.generateContent(this.buildSpeechRequest(model, text, voice));
      const chunkData = this.extractValidChunkData(response.response);

      if (chunkData) {
        const { data, mimeType } = chunkData;
        const decoded = decodeAudioChunk(data, mimeType);
        return toWavBlob(decoded.samples, decoded.sampleRate);
      }
      throw Error('TTS response missing candidate content parts');
    }
  }
  ```

### 4. Update `TextToSpeechService` Unit Tests (`src/app/core/speech/text-to-speech.service.spec.ts`)

- [ ] Update `src/app/core/speech/text-to-speech.service.spec.ts` to provide `AiModelFactory` via `createMockAiModelFactory` and assert that `generateContent` and `generateContentStream` receive the preserved `responseModalities: ['AUDIO']` along with dynamic `speechConfig`:

  ```ts
  import { AiModelFactory } from '@/core/firebase';
  import { createMockAiModelFactory, createMockTtsModel, MockAiModelFactory } from '@/testing/ai-model.mock';
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

    describe('synthesize', () => {
      it('should pass speechConfig while preserving responseModalities from model.generationConfig', async () => {
        const result = await service.synthesize({ text: 'Hello', voice: 'Puck' });

        expect(mockAiModelFactory.getTtsModel).toHaveBeenCalledTimes(1);
        expect(mockAiModel.generateContent).toHaveBeenCalledWith({
          contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Puck' },
              },
              languageCode: 'en-US',
            },
          },
        });
        expect(result).toBeInstanceOf(Blob);
      });

      it('should throw an error if TTS candidate content is missing', async () => {
        mockAiModel.generateContent.mockResolvedValueOnce({
          response: { candidates: [] },
        });

        await expect(service.synthesize({ text: 'Hello', voice: 'Puck' })).rejects.toThrow(
          'TTS response missing candidate content parts',
        );
      });
    });

    describe('synthesizeStream', () => {
      it('should stream audio chunks while preserving responseModalities in generationConfig', async () => {
        const generator = service.synthesizeStream({ text: 'Hello stream', voice: 'Aoede' });
        const chunks = [];

        for await (const chunk of generator) {
          chunks.push(chunk);
        }

        expect(mockAiModelFactory.getTtsModel).toHaveBeenCalledTimes(1);
        expect(mockAiModel.generateContentStream).toHaveBeenCalledWith({
          contents: [{ role: 'user', parts: [{ text: 'Hello stream' }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Aoede' },
              },
              languageCode: 'en-US',
            },
          },
        });
        expect(chunks.length).toBeGreaterThan(0);
      });
    });
  });
  ```

### 5. Verification

- [ ] Run targeted unit tests:

  ```bash
  npm run test:spec src/app/core/vision/vision.service.spec.ts
  npm run test:spec src/app/core/speech/text-to-speech.service.spec.ts
  ```

- [ ] Run complete linting and testing suite:

  ```bash
  npm run lint && npm run test:once
  ```
