import { AudioPlayerService } from '@/core/speech/audio-player.service';
import { AudioStreamChunk } from '@/core/speech/text-to-speech.interface';
import { TextToSpeechService } from '@/core/speech/text-to-speech.service';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SpeechStudioViewService } from './speech-studio-view';

async function* createStreamGenerator(chunks: AudioStreamChunk[]): AsyncGenerator<AudioStreamChunk, void, unknown> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

async function* createErrorStreamGenerator(
  chunks: AudioStreamChunk[],
  errorToThrow: Error,
): AsyncGenerator<AudioStreamChunk, void, unknown> {
  for (const chunk of chunks) {
    yield chunk;
  }
  throw errorToThrow;
}

describe('SpeechStudioViewService', () => {
  let service: SpeechStudioViewService;

  let mockSpeechService: {
    synthesize: ReturnType<typeof vi.fn>;
    synthesizeStream: ReturnType<typeof vi.fn>;
  };

  let mockAudioPlayerService: {
    playStream: ReturnType<typeof vi.fn>;
    stopAll: ReturnType<typeof vi.fn>;
  };
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockSpeechService = {
      synthesize: vi.fn(),
      synthesizeStream: vi.fn(),
    };

    mockAudioPlayerService = {
      playStream: vi.fn().mockResolvedValue(undefined),
      stopAll: vi.fn().mockResolvedValue(undefined),
    };

    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    TestBed.configureTestingModule({
      providers: [
        SpeechStudioViewService,
        { provide: TextToSpeechService, useValue: mockSpeechService },
        { provide: AudioPlayerService, useValue: mockAudioPlayerService },
      ],
    });

    service = TestBed.inject(SpeechStudioViewService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  describe('Initial State', () => {
    it('should initialize with default state values', () => {
      expect(service.activeAudio()).toBeUndefined();
      expect(service.playbackRate()).toBe(1);
      expect(service.loadingMode()).toBe('idle');
    });
  });

  describe('generateSpeech - Sync Mode', () => {
    it('should synthesize audio and set activeAudio in sync mode', async () => {
      const mockBlob = new Blob(['wav-data'], { type: 'audio/wav' });
      mockSpeechService.synthesize.mockResolvedValue(mockBlob);

      const config = { prompt: 'Test prompt', voice: 'Kore', fact: 'Interesting fact' };
      await service.generateSpeech('sync', config);

      expect(mockSpeechService.synthesize).toHaveBeenCalledWith({
        text: 'Test prompt',
        voice: 'Kore',
      });
      expect(service.activeAudio()).toEqual({
        url: 'blob:mock-url',
        prompt: 'Test prompt',
        voice: 'Kore',
      });
      expect(service.loadingMode()).toBe('idle');
    });

    it('should revoke previous blob URL when setting a new activeAudio record', async () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
      vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:url-1').mockReturnValueOnce('blob:url-2');

      const mockBlob = new Blob(['data'], { type: 'audio/wav' });
      mockSpeechService.synthesize.mockResolvedValue(mockBlob);

      const config1 = { prompt: 'Prompt 1', voice: 'Kore', fact: 'Fact 1' };
      await service.generateSpeech('sync', config1);
      expect(service.activeAudio()?.url).toBe('blob:url-1');

      const config2 = { prompt: 'Prompt 2', voice: 'Aoede', fact: 'Fact 2' };
      await service.generateSpeech('sync', config2);

      expect(revokeSpy).toHaveBeenCalledWith('blob:url-1');
      expect(service.activeAudio()?.url).toBe('blob:url-2');
    });

    it('should handle synthesis errors in sync mode, clean up player, and throw error', async () => {
      mockSpeechService.synthesize.mockRejectedValue(new Error('Network error'));

      const config = { prompt: 'Test prompt', voice: 'Kore', fact: 'Interesting fact' };
      await expect(service.generateSpeech('sync', config)).rejects.toThrow('Error generating speech (Sync).');

      expect(mockAudioPlayerService.stopAll).toHaveBeenCalled();
      expect(service.activeAudio()).toBeUndefined();
      expect(service.loadingMode()).toBe('idle');
    });
  });

  describe('generateSpeech - Stream Mode', () => {
    it('should collect stream chunks, convert to WAV Blob, and set activeAudio in stream mode', async () => {
      mockSpeechService.synthesizeStream.mockReturnValue(
        createStreamGenerator([
          {
            decodedData: new Uint8Array([1, 2]),
            sampleRate: 24000,
            mimeType: 'audio/l16; rate=24000; channels=1',
          },
        ]),
      );
      mockAudioPlayerService.playStream.mockImplementation(async (stream) => {
        for await (const chunk of stream) {
          void chunk;
        }
      });
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stream-url');

      const config = { prompt: 'Stream prompt', voice: 'Kore', fact: 'Interesting fact' };
      await service.generateSpeech('stream', config);

      expect(mockSpeechService.synthesizeStream).toHaveBeenCalledWith({
        text: 'Stream prompt',
        voice: 'Kore',
      });
      expect(mockAudioPlayerService.playStream).toHaveBeenCalledWith(expect.anything(), {
        playbackRate: 1,
        signal: expect.any(AbortSignal),
      });
      expect(service.activeAudio()).toEqual({
        url: 'blob:stream-url',
        prompt: 'Stream prompt',
        voice: 'Kore',
      });
    });

    it('should handle empty stream gracefully without setting audioUrl', async () => {
      mockSpeechService.synthesizeStream.mockReturnValue(createStreamGenerator([]));

      const config = { prompt: 'Stream prompt', voice: 'Aoede', fact: 'Interesting fact' };
      await service.generateSpeech('stream', config);

      expect(mockAudioPlayerService.playStream).toHaveBeenCalled();
      expect(service.activeAudio()).toBeUndefined();
    });

    it('should handle streaming exceptions, clean up, and throw error', async () => {
      mockSpeechService.synthesizeStream.mockReturnValue(
        createErrorStreamGenerator(
          [
            {
              decodedData: new Uint8Array([1, 2]),
              sampleRate: 24000,
              mimeType: 'audio/l16; rate=24000; channels=1',
            },
          ],
          new Error('Stream interrupted'),
        ),
      );
      mockAudioPlayerService.playStream.mockImplementation(async (stream) => {
        for await (const chunk of stream) {
          void chunk;
        }
      });

      const config = { prompt: 'Stream prompt', voice: 'Kore', fact: 'Interesting fact' };
      await expect(service.generateSpeech('stream', config)).rejects.toThrow('Error generating speech (Stream).');

      expect(mockAudioPlayerService.stopAll).toHaveBeenCalled();
      expect(service.activeAudio()).toBeUndefined();
    });
  });

  describe('generateSpeech - Web Audio API Mode', () => {
    it('should stream zero-latency speaker chunks without collecting Blob', async () => {
      mockSpeechService.synthesizeStream.mockReturnValue(
        createStreamGenerator([
          {
            decodedData: new Uint8Array([3, 4]),
            sampleRate: 16000,
            mimeType: 'audio/l16; rate=16000; channels=1',
          },
        ]),
      );

      const config = { prompt: 'WebAudio prompt', voice: 'Puck', fact: 'Interesting fact' };
      await service.generateSpeech('web_audio_api', config);

      expect(mockSpeechService.synthesizeStream).toHaveBeenCalledWith({
        text: 'WebAudio prompt',
        voice: 'Puck',
      });
      expect(mockAudioPlayerService.playStream).toHaveBeenCalledWith(expect.anything(), {
        playbackRate: expect.any(Number),
        signal: expect.any(AbortSignal),
      });
      expect(service.activeAudio()).toBeUndefined();
    });

    it('should clear activeAudio when generating in Web Audio API mode to prevent ghost player', async () => {
      const mockBlob = new Blob(['wav-bytes'], { type: 'audio/wav' });
      mockSpeechService.synthesize.mockResolvedValue(mockBlob);

      const syncConfig = { prompt: 'Sync prompt', voice: 'Aoede', fact: 'Fact 1' };
      await service.generateSpeech('sync', syncConfig);
      expect(service.activeAudio()).toBeDefined();

      mockSpeechService.synthesizeStream.mockReturnValue(
        createStreamGenerator([
          {
            decodedData: new Uint8Array([3, 4]),
            sampleRate: 16000,
            mimeType: 'audio/l16; rate=16000; channels=1',
          },
        ]),
      );

      const webAudioConfig = { prompt: 'WebAudio prompt', voice: 'Puck', fact: 'Fact 2' };
      await service.generateSpeech('web_audio_api', webAudioConfig);

      expect(service.activeAudio()).toBeUndefined();
    });

    it('should handle speak exceptions, clean up, and throw error', async () => {
      mockSpeechService.synthesizeStream.mockImplementation(() => {
        throw new Error('Speak failed');
      });

      const config = { prompt: 'WebAudio prompt', voice: 'Puck', fact: 'Interesting fact' };
      await expect(service.generateSpeech('web_audio_api', config)).rejects.toThrow(
        'Error streaming speech using the Web Audio API.',
      );

      expect(mockAudioPlayerService.stopAll).toHaveBeenCalled();
    });
  });

  describe('Validation and Edge Cases', () => {
    it('should return early and not trigger generation if promptArgs.fact is empty', async () => {
      const config = { prompt: 'Prompt', voice: 'Aoede', fact: '' };
      await service.generateSpeech('sync', config);

      expect(mockSpeechService.synthesize).not.toHaveBeenCalled();
      expect(service.loadingMode()).toBe('idle');
    });

    it('should return early and not trigger generation if loadingMode is not idle', async () => {
      mockSpeechService.synthesizeStream.mockReturnValue(
        createStreamGenerator([
          {
            decodedData: new Uint8Array([1]),
            sampleRate: 24000,
            mimeType: 'audio/l16; rate=24000; channels=1',
          },
        ]),
      );

      const config1 = { prompt: 'Prompt 1', voice: 'Aoede', fact: 'Fact 1' };
      const config2 = { prompt: 'Prompt 2', voice: 'Kore', fact: 'Fact 2' };

      const firstCallPromise = service.generateSpeech('stream', config1);
      expect(service.loadingMode()).toBe('stream');

      await service.generateSpeech('stream', config2);

      await firstCallPromise;

      expect(mockSpeechService.synthesizeStream).toHaveBeenCalledTimes(1);
      expect(mockSpeechService.synthesizeStream).toHaveBeenCalledWith({
        text: 'Prompt 1',
        voice: 'Aoede',
      });
      expect(service.loadingMode()).toBe('idle');
    });

    it('should throw error if an unsupported generation mode is provided', async () => {
      const config = { prompt: 'Prompt', voice: 'Aoede', fact: 'Fact' };
      const invalidMode = 'invalid_mode' as unknown as Parameters<typeof service.generateSpeech>[0];

      await expect(service.generateSpeech(invalidMode, config)).rejects.toThrow('Error generating speech (Sync).');
    });
  });

  describe('Dynamic Service Resolution on Demand', () => {
    it('should not synchronously resolve TextToSpeechService or AudioPlayerService from injector during construction', () => {
      const injector = TestBed.inject(Injector);
      const getSpy = vi.spyOn(injector, 'get');

      TestBed.runInInjectionContext(() => new SpeechStudioViewService());

      expect(getSpy).not.toHaveBeenCalledWith(TextToSpeechService);
      expect(getSpy).not.toHaveBeenCalledWith(AudioPlayerService);
    });
  });

  describe('Lifecycle Cleanup (DestroyRef)', () => {
    it('should revoke previous audioUrl when destroyed', async () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:destroy-url');

      mockSpeechService.synthesize.mockResolvedValue(new Blob([]));
      const config = { prompt: 'Prompt', voice: 'Kore', fact: 'Fact' };

      await service.generateSpeech('sync', config);
      expect(service.activeAudio()?.url).toBe('blob:destroy-url');

      TestBed.resetTestingModule();
      expect(revokeSpy).toHaveBeenCalledWith('blob:destroy-url');
    });
  });
});
