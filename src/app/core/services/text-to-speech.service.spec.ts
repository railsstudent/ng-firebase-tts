import { AI_BACKEND } from '@/core/constants/firebase.constant';
import { TestBed } from '@angular/core/testing';
import { ConfigService } from './config.service';
import { TextToSpeechService } from './text-to-speech.service';

interface MockGenerativeModel {
  generateContent: ReturnType<typeof vi.fn>;
  generateContentStream: ReturnType<typeof vi.fn>;
}

const mockModel: MockGenerativeModel = {
  generateContent: vi.fn(),
  generateContentStream: vi.fn(),
};

// Mock getGenerativeModel while preserving original exports of 'firebase/ai'
vi.mock('firebase/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/ai')>();
  return Object.assign({}, actual, {
    getGenerativeModel: () => mockModel,
  });
});

describe('TextToSpeechService', () => {
  let service: TextToSpeechService;
  let mockAI: Record<string, unknown>;
  let mockConfigService: {
    readonly appConfig: Record<string, unknown>;
    remoteConfig: Record<string, unknown>;
  };
  let appConfigSpy: ReturnType<typeof vi.fn> & (() => Record<string, unknown>);

  beforeEach(() => {
    mockAI = {};

    // Standard mock configuration data matching the expected AppRemoteConfig type
    const configData = {
      geminiTTSModelName: 'gemini-2.0-flash-exp',
      vertexAILocation: 'us-central1',
      geminiModelName: 'gemini-1.5-flash',
      thinkingLevel: 'LOW',
      useLimitedUseAppCheckTokens: true,
    };

    appConfigSpy = vi.fn().mockReturnValue(configData);

    mockConfigService = {
      get appConfig() {
        return appConfigSpy();
      },
      remoteConfig: {},
    };

    TestBed.configureTestingModule({
      providers: [
        TextToSpeechService,
        { provide: AI_BACKEND, useValue: mockAI },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    });

    service = TestBed.inject(TextToSpeechService);
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Model Caching', () => {
    it('should read modelName from ConfigService appConfig exactly once during initialization', async () => {
      appConfigSpy.mockClear();

      let testService!: TextToSpeechService;
      TestBed.runInInjectionContext(() => {
        testService = new TextToSpeechService();
      });

      // Verify it accessed the appConfig signal exactly once on instantiation
      expect(appConfigSpy).toHaveBeenCalledTimes(1);

      // Mock generative response
      mockModel.generateContent.mockResolvedValue({
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: { data: 'SGVsbG8=', mimeType: 'audio/l16; rate=24000; channels=1' },
                  },
                ],
              },
            },
          ],
        },
      });

      // Call public methods multiple times
      await testService.synthesize('Test 1', 'Kore');
      await testService.synthesize('Test 2', 'Puck');

      // The count of appConfig signal reads should STILL be exactly 1!
      expect(appConfigSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('synthesize (Use Case 1 - Ad-hoc Single-shot)', () => {
    it('should fetch complete content, decode base64, create a blob and return Object URL', async () => {
      const mockBase64 = 'SGVsbG8=';
      mockModel.generateContent.mockResolvedValue({
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      data: mockBase64,
                      mimeType: 'audio/l16; rate=24000; channels=1',
                    },
                  },
                ],
              },
            },
          ],
        },
      });
      const blob = await service.synthesize('Hello Fact', 'Kore');

      expect(mockModel.generateContent).toHaveBeenCalledWith(['Hello Fact']);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/wav');
    });

    it('should throw an error if generateContent returns empty candidates or data', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: {},
      });

      await expect(service.synthesize('Empty Fact', 'Puck')).rejects.toThrow('No audio data received in response.');
    });
  });

  describe('synthesizeStream (Use Case 2 - Hybrid Stream-and-Play & Zero-Latency Stream)', () => {
    it('should stream chunks, yield them, and yield complete WAV blob when shouldWait is true', async () => {
      const mockStreamIterator = {
        async *[Symbol.asyncIterator]() {
          yield {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        data: 'SGVsbG8=',
                        mimeType: 'audio/l16; rate=24000; channels=1',
                      },
                    },
                  ],
                },
              },
            ],
          };
          yield {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        data: 'V29ybGQ=',
                        mimeType: 'audio/l16; rate=24000; channels=1',
                      },
                    },
                  ],
                },
              },
            ],
          };
        },
      };

      mockModel.generateContentStream.mockResolvedValue({
        stream: mockStreamIterator,
      });

      const generator = service.synthesizeStream('Dynamic Stream', 'Kore', true);
      const emissions = [];
      for await (const chunk of generator) {
        emissions.push(chunk);
      }

      expect(mockModel.generateContentStream).toHaveBeenCalledWith(['Dynamic Stream']);
      expect(emissions.length).toBe(3); // 2 chunks, 1 final Blob
      expect(emissions[0]).toEqual({
        decodedData: expect.any(Uint8Array),
        sampleRate: 24000,
      });
      expect(emissions[2]).toBeInstanceOf(Blob);
      const finalBlob = emissions[2] as Blob;
      expect(finalBlob.type).toBe('audio/wav');
    });

    it('should yield chunks and yield undefined as final emission when shouldWait is false', async () => {
      const mockStreamIterator = {
        async *[Symbol.asyncIterator]() {
          yield {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        data: 'SGVsbG8=',
                        mimeType: 'audio/l16; rate=16000; channels=1',
                      },
                    },
                  ],
                },
              },
            ],
          };
        },
      };

      mockModel.generateContentStream.mockResolvedValue({
        stream: mockStreamIterator,
      });

      const generator = service.synthesizeStream('Hello interactive player', 'Puck', false);
      const emissions = [];
      for await (const chunk of generator) {
        emissions.push(chunk);
      }

      expect(mockModel.generateContentStream).toHaveBeenCalledWith(['Hello interactive player']);
      expect(emissions.length).toBe(2); // 1 chunk, 1 undefined final emission
      const firstChunk = emissions[0] as { decodedData: Uint8Array; sampleRate: number };
      expect(firstChunk.sampleRate).toBe(16000);
      expect(Array.from(firstChunk.decodedData)).toEqual([72, 101, 108, 108, 111]);
      expect(emissions[1]).toBeUndefined();
    });

    it('should rethrow on stream errors', async () => {
      mockModel.generateContentStream.mockRejectedValue(new Error('Vertex AI stream error'));

      const generator = service.synthesizeStream('Failing stream', 'Puck');
      await expect(generator.next()).rejects.toThrow('Vertex AI stream error');
    });
  });
});
