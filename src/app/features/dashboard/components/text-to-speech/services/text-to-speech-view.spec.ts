import { AI_BACKEND } from '@/core/constants/firebase.constant';
import { DEFAULT_PLAYBACK_RATE } from '@/core/constants/text-to-speech.constant';
import { RawAudioBinary } from '@/core/interfaces/text-to-speech.interface';
import { AudioPlayerService } from '@/core/services/audio-player.service';
import { ConfigService } from '@/core/services/config.service';
import { TextToSpeechService } from '@/core/services/text-to-speech.service';
import { TextToSpeechViewService } from '@/features/dashboard/components/text-to-speech/services/text-to-speech-view';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';

async function* createStreamGenerator(
  items: (Blob | RawAudioBinary | undefined)[],
): AsyncGenerator<Blob | RawAudioBinary | undefined, void, unknown> {
  for (const item of items) {
    yield item;
  }
}

async function* createErrorStreamGenerator(
  chunk: RawAudioBinary,
  error: Error,
): AsyncGenerator<Blob | RawAudioBinary | undefined, void, unknown> {
  yield chunk;
  throw error;
}

const mockSpeechService = {
  synthesize: vi.spyOn(TextToSpeechService.prototype, 'synthesize'),
  synthesizeStream: vi.spyOn(TextToSpeechService.prototype, 'synthesizeStream'),
};

const mockAudioPlayerService = {
  initialize: vi.spyOn(AudioPlayerService.prototype, 'initialize').mockImplementation(() => undefined),
  processChunk: vi.spyOn(AudioPlayerService.prototype, 'processChunk').mockImplementation(() => undefined),
  stopAll: vi.spyOn(AudioPlayerService.prototype, 'stopAll').mockImplementation(() => undefined),
  awaitPlaybackComplete: vi.spyOn(AudioPlayerService.prototype, 'awaitPlaybackComplete').mockResolvedValue(undefined),
};

describe('TextToSpeechViewService', () => {
  let service: TextToSpeechViewService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAudioPlayerService.awaitPlaybackComplete.mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        TextToSpeechViewService,
        { provide: AI_BACKEND, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            appConfig: { geminiTTSModelName: 'gemini-2.0-flash-exp' },
          },
        },
      ],
    });

    service = TestBed.inject(TextToSpeechViewService);
  });

  it('should be created and expose initial state with default playbackRate independently of AudioPlayerService', () => {
    expect(service).toBeTruthy();
    expect(service.playbackRate()).toBe(DEFAULT_PLAYBACK_RATE);
    expect(service.audioUrl()).toBeUndefined();
    expect(service.loadingMode()).toBe('idle');
  });

  describe('generateSpeech - Sync Mode', () => {
    it('should generate speech in sync mode and set the audio URL', async () => {
      const mockBlob = new Blob(['pcm bytes'], { type: 'audio/pcm' });
      mockSpeechService.synthesize.mockResolvedValue(mockBlob);
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:sync-url');

      const config = { prompt: 'Sync prompt', voice: 'Kore', fact: 'Interesting fact' };
      await service.generateSpeech('sync', config);

      expect(mockSpeechService.synthesize).toHaveBeenCalledWith('Sync prompt', 'Kore');
      expect(service.audioUrl()).toBe('blob:sync-url');
      expect(service.loadingMode()).toBe('idle');
    });

    it('should catch exceptions, clean up, and throw error', async () => {
      mockSpeechService.synthesize.mockRejectedValue(new Error('Sync failure'));
      vi.spyOn(URL, 'revokeObjectURL');

      const config = { prompt: 'Sync prompt', voice: 'Kore', fact: 'Interesting fact' };
      await expect(service.generateSpeech('sync', config)).rejects.toThrow('Error generating speech (Sync).');

      expect(mockAudioPlayerService.stopAll).toHaveBeenCalled();
      expect(service.audioUrl()).toBeUndefined();
    });
  });

  describe('generateSpeech - Stream Mode', () => {
    it('should generate speech in stream mode and set the audio URL from final Blob', async () => {
      const mockBlob = new Blob(['streamed pcm'], { type: 'audio/pcm' });
      mockSpeechService.synthesizeStream.mockReturnValue(
        createStreamGenerator([{ decodedData: new Uint8Array([1, 2]), sampleRate: 24000 }, mockBlob]),
      );
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stream-url');

      const config = { prompt: 'Stream prompt', voice: 'Kore', fact: 'Interesting fact' };
      await service.generateSpeech('stream', config);

      expect(mockSpeechService.synthesizeStream).toHaveBeenCalledWith('Stream prompt', 'Kore', true);
      expect(mockAudioPlayerService.initialize).toHaveBeenCalledWith(24000, 1);
      expect(mockAudioPlayerService.processChunk).toHaveBeenCalledWith(new Uint8Array([1, 2]));
      expect(mockAudioPlayerService.awaitPlaybackComplete).toHaveBeenCalled();
      expect(service.audioUrl()).toBe('blob:stream-url');
    });

    it('should handle stream ending without a Blob payload gracefully without setting audioUrl', async () => {
      mockSpeechService.synthesizeStream.mockReturnValue(
        createStreamGenerator([{ decodedData: new Uint8Array([1, 2]), sampleRate: 24000 }]),
      );

      const config = { prompt: 'Stream prompt', voice: 'Aoede', fact: 'Interesting fact' };
      await service.generateSpeech('stream', config);

      expect(mockAudioPlayerService.awaitPlaybackComplete).toHaveBeenCalled();
      expect(service.audioUrl()).toBeUndefined();
    });

    it('should handle streaming exceptions, clean up, and throw error', async () => {
      mockSpeechService.synthesizeStream.mockReturnValue(
        createErrorStreamGenerator(
          { decodedData: new Uint8Array([1, 2]), sampleRate: 24000 },
          new Error('Stream interrupted'),
        ),
      );

      const config = { prompt: 'Stream prompt', voice: 'Kore', fact: 'Interesting fact' };
      await expect(service.generateSpeech('stream', config)).rejects.toThrow('Error generating speech (Stream).');

      expect(mockAudioPlayerService.stopAll).toHaveBeenCalled();
      expect(service.audioUrl()).toBeUndefined();
    });
  });

  describe('generateSpeech - Web Audio API Mode', () => {
    it('should stream zero-latency speaker chunks with shouldWait: false', async () => {
      mockSpeechService.synthesizeStream.mockReturnValue(
        createStreamGenerator([{ decodedData: new Uint8Array([3, 4]), sampleRate: 16000 }, undefined]),
      );

      const config = { prompt: 'WebAudio prompt', voice: 'Puck', fact: 'Interesting fact' };
      await service.generateSpeech('web_audio_api', config);

      expect(mockSpeechService.synthesizeStream).toHaveBeenCalledWith('WebAudio prompt', 'Puck', false);
      expect(mockAudioPlayerService.initialize).toHaveBeenCalledWith(16000, expect.any(Number));
      expect(mockAudioPlayerService.processChunk).toHaveBeenCalledWith(new Uint8Array([3, 4]));
      expect(mockAudioPlayerService.awaitPlaybackComplete).not.toHaveBeenCalled();
      expect(service.audioUrl()).toBeUndefined();
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

      TestBed.runInInjectionContext(() => new TextToSpeechViewService());

      expect(getSpy).not.toHaveBeenCalledWith(TextToSpeechService);
      expect(getSpy).not.toHaveBeenCalledWith(AudioPlayerService);
    });
  });

  describe('Lifecycle Cleanup (DestroyRef)', () => {
    it('should revoke previous audioUrl when destroyed', async () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:destroy-url');

      // Set internal state by simulating a successful sync speak
      mockSpeechService.synthesize.mockResolvedValue(new Blob([]));
      const config = { prompt: 'Prompt', voice: 'Kore', fact: 'Fact' };

      await service.generateSpeech('sync', config);
      expect(service.audioUrl()).toBe('blob:destroy-url');

      // Resetting/destroying the testing module triggers DestroyRef.onDestroy
      TestBed.resetTestingModule();
      expect(revokeSpy).toHaveBeenCalledWith('blob:destroy-url');
    });
  });
});
