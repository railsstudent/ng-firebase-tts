import { AI_BACKEND } from '@/core/constants/firebase.constant';
import { TestBed } from '@angular/core/testing';
import { AudioPlayerService } from './audio-player.service';
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

interface MockAudioPlayer {
  initialize: ReturnType<typeof vi.fn>;
  processChunk: ReturnType<typeof vi.fn>;
  stopAll: ReturnType<typeof vi.fn>;
  awaitPlaybackComplete: ReturnType<typeof vi.fn>;
}

describe('TextToSpeechService', () => {
  let service: TextToSpeechService;
  let audioPlayerMock: MockAudioPlayer;
  let mockAI: Record<string, unknown>;
  let mockConfigService: {
    readonly appConfig: Record<string, unknown>;
    remoteConfig: Record<string, unknown>;
  };
  let appConfigSpy: ReturnType<typeof vi.fn> & (() => Record<string, unknown>);

  beforeEach(() => {
    audioPlayerMock = {
      initialize: vi.fn(),
      processChunk: vi.fn(),
      stopAll: vi.fn(),
      awaitPlaybackComplete: vi.fn().mockResolvedValue(undefined),
    };

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
        { provide: AudioPlayerService, useValue: audioPlayerMock },
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

      await expect(service.synthesize('Empty Fact', 'Puck')).rejects.toThrow(
        'No audio data received in response.',
      );
    });
  });

  describe('synthesizeStream (Use Case 2 - Hybrid Stream-and-Play)', () => {
    it('should stream chunks, feed decoded chunks to audio player, and return complete WAV blob', async () => {
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

      const blob = await service.synthesizeStream('Dynamic Stream', 'Kore');

      expect(mockModel.generateContentStream).toHaveBeenCalledWith(['Dynamic Stream']);
      expect(audioPlayerMock.initialize).toHaveBeenCalledWith(24000);
      expect(audioPlayerMock.processChunk).toHaveBeenCalledTimes(2);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/wav');
    });

    it('should stop player and rethrow on stream errors', async () => {
      mockModel.generateContentStream.mockRejectedValue(new Error('Vertex AI stream error'));

      await expect(service.synthesizeStream('Failing stream', 'Puck')).rejects.toThrow(
        'Vertex AI stream error',
      );
      expect(audioPlayerMock.stopAll).toHaveBeenCalled();
    });
  });

  describe('speak (Use Case 3 - Zero-Latency Playback)', () => {
    it('should initialize player, fetch stream, decode base64, and feed decoded chunks directly to player', async () => {
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

      await service.speak('Hello interactive player', 'Puck');

      expect(audioPlayerMock.initialize).toHaveBeenCalledWith(16000);
      expect(mockModel.generateContentStream).toHaveBeenCalledWith(['Hello interactive player']);
      expect(audioPlayerMock.processChunk).toHaveBeenCalled();

      const decodedBytes = audioPlayerMock.processChunk.mock.calls[0][0] as Uint8Array;
      expect(Array.from(decodedBytes)).toEqual([72, 101, 108, 108, 111]);
    });

    it('should stop player and rethrow on stream errors', async () => {
      mockModel.generateContentStream.mockRejectedValue(new Error('Vertex AI stream error'));

      await expect(service.speak('Failing stream', 'Puck')).rejects.toThrow(
        'Vertex AI stream error',
      );
      expect(audioPlayerMock.stopAll).toHaveBeenCalled();
    });
  });
});
