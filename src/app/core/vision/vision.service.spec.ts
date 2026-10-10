import { ConfigService } from '@/core/services/config.service';
import { TestBed } from '@angular/core/testing';
import { getGenerativeModel, ThinkingLevel } from 'firebase/ai';
import { VisionService } from './vision.service';

const { mockAiModel, mockSchema } = vi.hoisted(() => {
  const mockAiModel = {
    generateContent: vi.fn().mockResolvedValue({ response: undefined }),
  };
  const mockSchema = {
    object: vi.fn((def: unknown) => def),
    array: vi.fn((def: unknown) => def),
    string: vi.fn(() => ({ type: 'string' })),
    integer: vi.fn(() => ({ type: 'integer' })),
    number: vi.fn(() => ({ type: 'number' })),
    boolean: vi.fn(() => ({ type: 'boolean' })),
  };
  return { mockAiModel, mockSchema };
});

vi.mock('firebase/ai', () => ({
  Schema: mockSchema,
  getGenerativeModel: vi.fn(() => mockAiModel),
  ThinkingLevel: { MINIMAL: 'MINIMAL', LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
  HarmCategory: {
    HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
  },
  HarmBlockThreshold: {
    BLOCK_LOW_AND_ABOVE: 'BLOCK_LOW_AND_ABOVE',
    BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE',
    BLOCK_ONLY_HIGH: 'BLOCK_ONLY_HIGH',
    BLOCK_NONE: 'BLOCK_NONE',
    OFF: 'OFF',
  },
  ResponseModality: { TEXT: 'TEXT', IMAGE: 'IMAGE', AUDIO: 'AUDIO' },
  SchemaType: {
    STRING: 'string',
    NUMBER: 'number',
    INTEGER: 'integer',
    BOOLEAN: 'boolean',
    ARRAY: 'array',
    OBJECT: 'object',
  },
}));

vi.mock('@firebase/ai', () => ({
  Schema: mockSchema,
  getGenerativeModel: vi.fn(() => mockAiModel),
  ThinkingLevel: { MINIMAL: 'MINIMAL', LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
  HarmCategory: {
    HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
  },
  HarmBlockThreshold: {
    BLOCK_LOW_AND_ABOVE: 'BLOCK_LOW_AND_ABOVE',
    BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE',
    BLOCK_ONLY_HIGH: 'BLOCK_ONLY_HIGH',
    BLOCK_NONE: 'BLOCK_NONE',
    OFF: 'OFF',
  },
  ResponseModality: { TEXT: 'TEXT', IMAGE: 'IMAGE', AUDIO: 'AUDIO' },
  SchemaType: {
    STRING: 'string',
    NUMBER: 'number',
    INTEGER: 'integer',
    BOOLEAN: 'boolean',
    ARRAY: 'array',
    OBJECT: 'object',
  },
}));

describe('VisionService', () => {
  let service: VisionService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGenerativeModel).mockReturnValue(mockAiModel as unknown as ReturnType<typeof getGenerativeModel>);
    mockAiModel.generateContent.mockResolvedValue({ response: undefined });

    TestBed.configureTestingModule({
      providers: [
        VisionService,
        {
          provide: ConfigService,
          useValue: {
            appConfig: {
              geminiModelName: 'gemini-2.5-flash',
              thinkingLevel: ThinkingLevel.LOW,
            },
            getAiBackend: vi.fn().mockResolvedValue({
              backendType: 'VERTEX',
              app: {
                options: {
                  apiKey: 'test-api-key',
                  projectId: 'test-project-id',
                  appId: 'test-app-id',
                },
              },
            }),
          },
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

    const mockResponse = {
      thoughtSummary: () => 'Analyzing the uploaded landscape photo step-by-step.',
      text: () => '```json\n' + JSON.stringify(mockImageAnalysis) + '\n```',
      usageMetadata: {
        promptTokenCount: 150,
        candidatesTokenCount: 200,
        thoughtsTokenCount: 50,
        totalTokenCount: 400,
      },
      candidates: [
        {
          groundingMetadata: {
            webSearchQueries: ['blue sunset mars reason'],
            searchEntryPoint: {
              renderedContent: 'Google Search for blue sunset Mars',
            },
            groundingChunks: [
              {
                web: {
                  uri: 'https://nasa.gov/mars-blue-sunset',
                  title: 'Why Sunsets on Mars are Blue',
                },
              },
            ],
            groundingSupports: [
              {
                groundingChunkIndices: [0],
              },
            ],
          },
        },
      ],
    };

    let generateContentCalled = false;
    let generateContentArgs: unknown = null;

    mockAiModel.generateContent.mockImplementation((args: unknown) => {
      generateContentCalled = true;
      generateContentArgs = args;
      return Promise.resolve({ response: mockResponse });
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
