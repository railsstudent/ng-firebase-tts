import { AiModelFactory } from '@/core/firebase/ai-model-factory.service';
import type { MockAiModelFactory } from '@/testing/ai-model.mock';
import { createMockAiModelFactory, createMockVisionModel, createMockVisionResponse } from '@/testing/ai-model.mock';
import type { MockImageClassifierService } from '@/testing/image-classifier.mock';
import { createMockImageClassifierService } from '@/testing/image-classifier.mock';
import { TestBed } from '@angular/core/testing';
import { ImageAnalysisSchema } from './image-analysis.schema';
import { ImageClassifierService } from './image-classifier.service';
import { CATEGORY_MODEL_CONFIGS } from './vision.const';
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
    mockImageClassifier = createMockImageClassifierService();

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
    await expect(service.analyzeImage(null as unknown as File)).rejects.toThrow('image is required to generate texts.');
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
      CATEGORY_MODEL_CONFIGS['general'].prompt,
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
      systemInstruction: CATEGORY_MODEL_CONFIGS['people'].options.systemInstruction,
      schema: ImageAnalysisSchema,
      tools: [{ googleSearch: {} }],
    });
    expect(mockAiModel.generateContent).toHaveBeenCalledWith([
      CATEGORY_MODEL_CONFIGS['people'].prompt,
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
      systemInstruction: CATEGORY_MODEL_CONFIGS['place'].options.systemInstruction,
      schema: ImageAnalysisSchema,
      tools: [{ googleMaps: {} }, { googleSearch: {} }],
    });
    expect(mockAiModel.generateContent).toHaveBeenCalledWith([
      CATEGORY_MODEL_CONFIGS['place'].prompt,
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
