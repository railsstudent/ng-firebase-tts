import { ConfigService } from '@/core/services/config.service';
import { createVisionResponseMock, getMockVisionModel } from '@/testing/ai-model.mock';
import { createMockConfigService } from '@/testing/config.mock';
import { TestBed } from '@angular/core/testing';
import { VisionService } from './vision.service';

describe('VisionService', () => {
  let service: VisionService;
  let mockAiModel: ReturnType<typeof getMockVisionModel>;

  beforeEach(() => {
    mockAiModel = getMockVisionModel();
    mockAiModel.generateContent.mockClear();
    mockAiModel.generateContent.mockResolvedValue(createVisionResponseMock());

    TestBed.configureTestingModule({
      providers: [
        VisionService,
        {
          provide: ConfigService,
          useValue: createMockConfigService(),
        },
      ],
    });

    service = TestBed.inject(VisionService);
  });

  it('should throw an error if image file is not provided', async () => {
    await expect(service.analyzeImage(null as unknown as File)).rejects.toThrow('image is required to generate texts.');
  });

  it('should successfully parse complete response including thoughts, structured JSON, citations, token usage, and optimization metrics', async () => {
    const mockImageAnalysis = {
      altText: 'A beautiful sunset over the mountains',
      tags: ['sunset', 'mountains', 'scenery'],
      suggestions: [{ title: 'Add foreground interest', reason: 'To make composition stronger' }],
      obscureFact: 'Sunsets on Mars are actually blue because of fine dust particles.',
    };

    let generateContentCalled = false;
    let generateContentArgs: unknown = null;

    mockAiModel.generateContent.mockImplementation((args: unknown) => {
      generateContentCalled = true;
      generateContentArgs = args;
      return Promise.resolve(createVisionResponseMock());
    });

    const fakeFile = new File(['hello-world'], 'test-image.png', { type: 'image/png' });
    const result = await service.analyzeImage(fakeFile);

    expect(generateContentCalled).toBe(true);
    expect(generateContentArgs).toBeDefined();
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
