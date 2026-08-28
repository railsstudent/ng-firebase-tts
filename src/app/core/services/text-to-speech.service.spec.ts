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

// Mock firebase/remote-config to resolve the model name retrieval
vi.mock('firebase/remote-config', () => ({
  getValue: () => ({
    asString: () => 'gemini-2.0-flash-exp',
  }),
}));

interface MockAudioPlayer {
  initialize: ReturnType<typeof vi.fn>;
  processChunk: ReturnType<typeof vi.fn>;
  stopAll: ReturnType<typeof vi.fn>;
}

describe('TextToSpeechService', () => {
  let service: TextToSpeechService;
  let audioPlayerMock: MockAudioPlayer;
  let mockAI: Record<string, unknown>;
  let mockConfigService: { remoteConfig: Record<string, unknown> };

  beforeEach(() => {
    audioPlayerMock = {
      initialize: vi.fn(),
      processChunk: vi.fn(),
      stopAll: vi.fn(),
    };

    mockAI = {};
    mockConfigService = {
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
                    },
                  },
                ],
              },
            },
          ],
        },
      });

      const mockObjectURL = 'blob:http://localhost/mock-uuid';
      vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockObjectURL);

      const url = await service.synthesize('Hello Fact', 'Kore');

      expect(mockModel.generateContent).toHaveBeenCalledWith(['Hello Fact']);
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(url).toBe(mockObjectURL);
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

  describe('synthesizeStream (Use Case 2 - Pure Streaming)', () => {
    it('should stream chunks and trigger the custom callback with decoded Uint8Arrays', async () => {
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

      const onChunkSpy = vi.fn();

      await service.synthesizeStream('Dynamic Stream', 'Kore', onChunkSpy);

      expect(mockModel.generateContentStream).toHaveBeenCalledWith(['Dynamic Stream']);
      expect(onChunkSpy).toHaveBeenCalledTimes(2);

      const firstArg = onChunkSpy.mock.calls[0][0] as Uint8Array;
      expect(firstArg).toBeInstanceOf(Uint8Array);
      expect(Array.from(firstArg)).toEqual([72, 101, 108, 108, 111]);
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

      expect(audioPlayerMock.initialize).toHaveBeenCalledWith(24000);
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
