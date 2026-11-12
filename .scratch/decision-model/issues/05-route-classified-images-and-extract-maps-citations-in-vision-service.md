# 05: Route Classified Images to Specialized Models and Extract Maps Citations in `VisionService`

**What to build:**
Integrate `ImageClassifierService` into `VisionService.analyzeImage()` to classify the preprocessed `imageBytes` into an **Image Subject Category** (`'people' | 'place' | 'general'`) and route each category to its corresponding cached `GenerativeModel` via `AiModelFactory.getModel()`:

- `'people'` → `peopleSystemInstruction`, `peopleAltTextPrompt`, `tools: [{ googleSearch: {} }]`
- `'place'` → `placeSystemInstruction`, `placeAltTextPrompt`, `tools: [{ googleMaps: {} }, { googleSearch: {} }]` (without browser geolocation bias)
- `'general'` → no `systemInstruction`, `altTextPrompt`, `tools: [{ googleSearch: {} }]`

Attach `category` to `ImageAnalysisResponse` and update `VisionService.constructCitations()` to extract `GoogleMapsGroundingChunk` entries (`chunks[idx]?.maps`) into `VisionGroundingMetadata.mapsCitations` alongside web `citations`.

**Blocked by:** 03: Implement `ImageClassifierService` Using `@mediapipe/tasks-decision` and EmbeddingGemma 2, 04: Define System Instructions and Prompts for People (`people`) and Place (`place`) Models

**Status:** ready-for-agent

## Target Files

- `src/app/core/vision/vision.service.ts`
- `src/app/core/vision/vision.service.spec.ts`
- `src/testing/ai-model.mock.ts`

## Acceptance Criteria & Implementation Checklist

### 1. Route by `ImageSubjectCategory` and Extract `mapsCitations` in `VisionService` (`src/app/core/vision/vision.service.ts`)

- [ ] Update `src/app/core/vision/vision.service.ts` to inject `ImageClassifierService`, route `'people'`, `'place'`, and `'general'` to their respective model options and prompts, attach `category` to `ImageAnalysisResponse`, and populate `mapsCitations` in `constructCitations()`:

  ````ts
  import { WINDOW } from '@/core/constants/navigator.const';
  import type { AiModelOptions } from '@/core/firebase/ai-model-options.interface';
  import { AiModelFactory } from '@/core/firebase/ai-model-factory.service';
  import { inject, Service } from '@angular/core';
  import type {
    GoogleMapsGroundingChunk,
    GroundingMetadata,
    InlineDataPart,
    UsageMetadata,
    WebGroundingChunk,
  } from 'firebase/ai';
  import type {
    ImageAnalysis,
    ImageAnalysisResponse,
    ImageSubjectCategory,
    TokenUsage,
    VisionGroundingMetadata,
  } from './image-analysis.interface';
  import { ImageAnalysisSchema } from './image-analysis.schema';
  import { ImageClassifierService } from './image-classifier.service';
  import { preprocessImageForVision } from './image.util';
  import {
    altTextPrompt,
    peopleAltTextPrompt,
    peopleSystemInstruction,
    placeAltTextPrompt,
    placeSystemInstruction,
  } from './vision.prompt';

  interface CategoryModelConfig {
    options: AiModelOptions;
    prompt: string;
  }

  @Service()
  export class VisionService {
    readonly #window = inject(WINDOW);
    readonly #aiModelFactory = inject(AiModelFactory);
    readonly #imageClassifier = inject(ImageClassifierService);

    async analyzeImage(image: File): Promise<ImageAnalysisResponse> {
      if (!image) {
        throw Error('image is required to generate texts.');
      }

      const { data, mimeType, imageBytes, optimizationMetrics } = await preprocessImageForVision(image, this.#window);
      const category = await this.#imageClassifier.classifyImage(imageBytes);
      const { options, prompt } = this.getCategoryModelConfig(category);

      const imagePart: InlineDataPart = {
        type: 'inlineData',
        inlineData: {
          data,
          mimeType,
        },
      };

      const aiModel = await this.#aiModelFactory.getModel(options);
      const result = await aiModel.generateContent([prompt, imagePart]);

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
          category,
        };
      }
      throw Error('No text generated.');
    }

    private getCategoryModelConfig(category: ImageSubjectCategory): CategoryModelConfig {
      switch (category) {
        case 'people':
          return {
            options: {
              systemInstruction: peopleSystemInstruction,
              schema: ImageAnalysisSchema,
              tools: [{ googleSearch: {} }],
            },
            prompt: peopleAltTextPrompt,
          };
        case 'place':
          return {
            options: {
              systemInstruction: placeSystemInstruction,
              schema: ImageAnalysisSchema,
              tools: [{ googleMaps: {} }, { googleSearch: {} }],
            },
            prompt: placeAltTextPrompt,
          };
        default:
          return {
            options: {
              schema: ImageAnalysisSchema,
              tools: [{ googleSearch: {} }],
            },
            prompt: altTextPrompt,
          };
      }
    }

    private constructCitations(groundingMetadata?: GroundingMetadata): VisionGroundingMetadata {
      if (!groundingMetadata) {
        return {
          citations: [],
          mapsCitations: [],
          renderedContent: '',
          searchQueries: [],
        };
      }

      const supports = groundingMetadata.groundingSupports || [];
      const chunks = groundingMetadata.groundingChunks || [];
      const supportIndices = supports.flatMap((support) => support.groundingChunkIndices || []);
      const citations = supportIndices.map((idx) => chunks[idx]?.web).filter((web): web is WebGroundingChunk => !!web);
      const mapsCitations = supportIndices
        .map((idx) => chunks[idx]?.maps)
        .filter((maps): maps is GoogleMapsGroundingChunk => !!maps);

      const renderedContent = groundingMetadata.searchEntryPoint?.renderedContent || '';
      const searchQueries = (groundingMetadata.webSearchQueries || []).filter((query) => !!query);

      return {
        citations,
        mapsCitations,
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

### 2. Update `vision.service.spec.ts` with Routing and Maps Grounding Test Cases

- [ ] Update `src/app/core/vision/vision.service.spec.ts` to provide `ImageClassifierService` via `createMockImageClassifierService()` at the `TestBed` boundary and implement all routing and `mapsCitations` Red -> Green test cases:

  ```ts
  import { AiModelFactory } from '@/core/firebase/ai-model-factory.service';
  import type { MockAiModelFactory } from '@/testing/ai-model.mock';
  import { createMockAiModelFactory, createMockVisionModel, createMockVisionResponse } from '@/testing/ai-model.mock';
  import type { MockImageClassifierService } from '@/testing/image-classifier.mock';
  import { createMockImageClassifierService } from '@/testing/image-classifier.mock';
  import { TestBed } from '@angular/core/testing';
  import { ImageAnalysisSchema } from './image-analysis.schema';
  import { ImageClassifierService } from './image-classifier.service';
  import {
    altTextPrompt,
    peopleAltTextPrompt,
    peopleSystemInstruction,
    placeAltTextPrompt,
    placeSystemInstruction,
  } from './vision.prompt';
  import { VisionService } from './vision.service';

  describe('VisionService', () => {
    let service: VisionService;
    let mockAiModel: ReturnType<typeof createMockVisionModel>;
    let mockAiModelFactory: MockAiModelFactory;
    let mockImageClassifier: MockImageClassifierService;

    beforeEach(() => {
      mockAiModel = createMockVisionModel();
      mockAiModel.generateContent.mockClear();
      mockAiModel.generateContent.mockResolvedValue(createMockVisionResponse());
      mockAiModelFactory = createMockAiModelFactory({ model: mockAiModel });
      mockImageClassifier = createMockImageClassifierService('general');

      TestBed.configureTestingModule({
        providers: [
          VisionService,
          {
            provide: AiModelFactory,
            useValue: mockAiModelFactory,
          },
          {
            provide: ImageClassifierService,
            useValue: mockImageClassifier,
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

    it('should route "general" classification to general model options, altTextPrompt, and return category: "general"', async () => {
      const mockImageAnalysis = {
        altText: 'A beautiful sunset over the mountains',
        tags: ['sunset', 'mountains', 'scenery'],
        suggestions: [{ title: 'Add foreground interest', reason: 'To make composition stronger' }],
        obscureFact: 'Sunsets on Mars are actually blue because of fine dust particles.',
      };

      const fakeFile = new File(['hello-world'], 'test-image.png', { type: 'image/png' });
      const result = await service.analyzeImage(fakeFile);

      expect(mockImageClassifier.classifyImage).toHaveBeenCalledWith(expect.any(Uint8Array));
      expect(mockAiModelFactory.getModel).toHaveBeenCalledWith({
        schema: ImageAnalysisSchema,
        tools: [{ googleSearch: {} }],
      });
      expect(mockAiModel.generateContent).toHaveBeenCalledWith([
        altTextPrompt,
        expect.objectContaining({ type: 'inlineData' }),
      ]);
      expect(result.parsed).toEqual(mockImageAnalysis);
      expect(result.category).toBe('general');
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
      expect(result.metadata.mapsCitations).toEqual([]);
      expect(result.metadata.searchQueries).toEqual(['blue sunset mars reason']);
      expect(result.metadata.renderedContent).toBe('Google Search for blue sunset Mars');
      expect(result.optimizationMetrics).toBeDefined();
    });

    it('should route "people" classification to peopleSystemInstruction and peopleAltTextPrompt with googleSearch tool', async () => {
      mockImageClassifier.classifyImage.mockResolvedValueOnce('people');

      const fakeFile = new File(['portrait-bytes'], 'portrait.jpg', { type: 'image/jpeg' });
      const result = await service.analyzeImage(fakeFile);

      expect(mockAiModelFactory.getModel).toHaveBeenCalledWith({
        systemInstruction: peopleSystemInstruction,
        schema: ImageAnalysisSchema,
        tools: [{ googleSearch: {} }],
      });
      expect(mockAiModel.generateContent).toHaveBeenCalledWith([
        peopleAltTextPrompt,
        expect.objectContaining({ type: 'inlineData' }),
      ]);
      expect(result.category).toBe('people');
    });

    it('should route "place" classification to placeSystemInstruction, placeAltTextPrompt, and googleMaps + googleSearch tools, and extract mapsCitations', async () => {
      mockImageClassifier.classifyImage.mockResolvedValueOnce('place');

      const baseResponse = createMockVisionResponse();
      baseResponse.response.candidates = [
        {
          groundingMetadata: {
            webSearchQueries: ['Eiffel Tower coordinates'],
            searchEntryPoint: { renderedContent: '<div>Eiffel Tower</div>' },
            groundingChunks: [
              {
                web: {
                  uri: 'https://toureiffel.paris',
                  title: 'Official Eiffel Tower Website',
                },
              },
              {
                maps: {
                  uri: 'https://maps.google.com/?cid=123456',
                  title: 'Eiffel Tower',
                  placeId: 'places/ChIJLU7jZClu5kcR4PcOOO6p3I0',
                },
              },
            ],
            groundingSupports: [{ groundingChunkIndices: [0, 1] }],
          },
        },
      ];
      mockAiModel.generateContent.mockResolvedValueOnce(baseResponse);

      const fakeFile = new File(['landmark-bytes'], 'eiffel.jpg', { type: 'image/jpeg' });
      const result = await service.analyzeImage(fakeFile);

      expect(mockAiModelFactory.getModel).toHaveBeenCalledWith({
        systemInstruction: placeSystemInstruction,
        schema: ImageAnalysisSchema,
        tools: [{ googleMaps: {} }, { googleSearch: {} }],
      });
      expect(mockAiModel.generateContent).toHaveBeenCalledWith([
        placeAltTextPrompt,
        expect.objectContaining({ type: 'inlineData' }),
      ]);
      expect(result.category).toBe('place');
      expect(result.metadata.citations).toEqual([
        {
          uri: 'https://toureiffel.paris',
          title: 'Official Eiffel Tower Website',
        },
      ]);
      expect(result.metadata.mapsCitations).toEqual([
        {
          uri: 'https://maps.google.com/?cid=123456',
          title: 'Eiffel Tower',
          placeId: 'places/ChIJLU7jZClu5kcR4PcOOO6p3I0',
        },
      ]);
    });

    it('should throw an error if generateContent returns an invalid or empty response', async () => {
      mockAiModel.generateContent.mockResolvedValue(null);

      const fakeFile = new File([''], 'test-image.png', { type: 'image/png' });
      await expect(service.analyzeImage(fakeFile)).rejects.toThrow('No text generated.');
    });
  });
  ```

### 3. Verification

- [ ] Run targeted unit tests:

  ```bash
  npm run test:spec src/app/core/vision/vision.service.spec.ts
  ```
