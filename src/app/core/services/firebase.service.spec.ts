import { AI_MODEL } from '@/core/constants/firebase.constant';
import { TestBed } from '@angular/core/testing';
import { FirebaseService } from './firebase.service';

describe('FirebaseService', () => {
  let service: FirebaseService;
  let aiModelMock: { generateContent: (args: unknown) => Promise<unknown> };

  beforeEach(() => {
    aiModelMock = {
      generateContent: () => Promise.resolve({ response: undefined }),
    };

    TestBed.configureTestingModule({
      providers: [FirebaseService, { provide: AI_MODEL, useValue: aiModelMock }],
    });

    service = TestBed.inject(FirebaseService);
  });

  it('should throw an error if image file is not provided', async () => {
    await expect(service.generateAltText(null as unknown as File)).rejects.toThrow(
      'image is required to generate texts.',
    );
  });

  it('should successfully parse complete response including thoughts, structured JSON, citations, and token usage', async () => {
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

    aiModelMock.generateContent = (args: unknown) => {
      generateContentCalled = true;
      generateContentArgs = args;
      return Promise.resolve({ response: mockResponse });
    };

    const fakeFile = new File([''], 'test-image.png', { type: 'image/png' });
    const result = await service.generateAltText(fakeFile);

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
  });

  it('should throw an error if generateContent returns an invalid or empty response', async () => {
    aiModelMock.generateContent = () => Promise.resolve(null);

    const fakeFile = new File([''], 'test-image.png', { type: 'image/png' });
    await expect(service.generateAltText(fakeFile)).rejects.toThrow('No text generated.');
  });
});
