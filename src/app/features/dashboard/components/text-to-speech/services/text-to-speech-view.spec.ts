import { AudioPlayerService } from '@/core/services/audio-player.service';
import { TextToSpeechService } from '@/core/services/text-to-speech.service';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TextToSpeechViewService } from './text-to-speech-view';

describe('TextToSpeechViewService', () => {
  let service: TextToSpeechViewService;
  let mockSpeechService: {
    synthesize: ReturnType<typeof vi.fn>;
    synthesizeStream: ReturnType<typeof vi.fn>;
    speak: ReturnType<typeof vi.fn>;
  };
  let mockAudioPlayerService: {
    playbackRate: ReturnType<typeof vi.fn>;
    initialize: ReturnType<typeof vi.fn>;
    processChunk: ReturnType<typeof vi.fn>;
    stopAll: ReturnType<typeof vi.fn>;
    awaitPlaybackComplete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockSpeechService = {
      synthesize: vi.fn(),
      synthesizeStream: vi.fn(),
      speak: vi.fn(),
    };
    mockAudioPlayerService = {
      playbackRate: vi.fn(),
      initialize: vi.fn(),
      processChunk: vi.fn(),
      stopAll: vi.fn(),
      awaitPlaybackComplete: vi.fn().mockResolvedValue(undefined),
    };

    const pbRateSignal = signal(1.25);
    Object.defineProperty(mockAudioPlayerService, 'playbackRate', {
      value: pbRateSignal.asReadonly(),
      writable: true,
    });

    TestBed.configureTestingModule({
      providers: [
        TextToSpeechViewService,
        { provide: TextToSpeechService, useValue: mockSpeechService },
        { provide: AudioPlayerService, useValue: mockAudioPlayerService },
      ],
    });

    service = TestBed.inject(TextToSpeechViewService);
    vi.clearAllMocks();
  });

  it('should be created and expose playbackRate', () => {
    expect(service).toBeTruthy();
    expect(service.playbackRate()).toBe(1.25);
    expect(service.audioUrl()).toBeUndefined();
    expect(service.loadingRate()).toBe('idle');
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
      expect(service.loadingRate()).toBe('idle');
    });

    it('should catch exceptions, clean up, and throw error', async () => {
      mockSpeechService.synthesize.mockRejectedValue(new Error('Sync failure'));
      vi.spyOn(URL, 'revokeObjectURL');

      const config = { prompt: 'Sync prompt', voice: 'Kore', fact: 'Interesting fact' };
      await expect(service.generateSpeech('sync', config)).rejects.toThrow(
        'Error generating speech (Sync).',
      );

      expect(mockAudioPlayerService.stopAll).toHaveBeenCalled();
      expect(service.audioUrl()).toBeUndefined();
    });
  });

  describe('generateSpeech - Stream Mode', () => {
    it('should generate speech in stream mode and set the audio URL from final Blob', async () => {
      const mockBlob = new Blob(['streamed pcm'], { type: 'audio/pcm' });
      const mockGenerator = {
        async *[Symbol.asyncIterator]() {
          yield { decodedData: new Uint8Array([1, 2]), sampleRate: 24000 };
          yield mockBlob;
        },
      };
      mockSpeechService.synthesizeStream.mockReturnValue(mockGenerator);
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stream-url');

      const config = { prompt: 'Stream prompt', voice: 'Kore', fact: 'Interesting fact' };
      await service.generateSpeech('stream', config);

      expect(mockSpeechService.synthesizeStream).toHaveBeenCalledWith('Stream prompt', 'Kore');
      expect(mockAudioPlayerService.initialize).toHaveBeenCalledWith(24000);
      expect(mockAudioPlayerService.processChunk).toHaveBeenCalledWith(new Uint8Array([1, 2]));
      expect(mockAudioPlayerService.awaitPlaybackComplete).toHaveBeenCalled();
      expect(service.audioUrl()).toBe('blob:stream-url');
    });

    it('should handle streaming exceptions, clean up, and throw error', async () => {
      const mockGenerator = {
        async *[Symbol.asyncIterator]() {
          yield { decodedData: new Uint8Array([1]), sampleRate: 24000 };
          throw new Error('Stream interrupted');
        },
      };
      mockSpeechService.synthesizeStream.mockReturnValue(mockGenerator);

      const config = { prompt: 'Stream prompt', voice: 'Kore', fact: 'Interesting fact' };
      await expect(service.generateSpeech('stream', config)).rejects.toThrow(
        'Error generating speech (Stream).',
      );

      expect(mockAudioPlayerService.stopAll).toHaveBeenCalled();
      expect(service.audioUrl()).toBeUndefined();
    });
  });

  describe('generateSpeech - Web Audio API Mode', () => {
    it('should stream zero-latency speaker chunks', async () => {
      const mockGenerator = {
        async *[Symbol.asyncIterator]() {
          yield { decodedData: new Uint8Array([3, 4]), sampleRate: 16000 };
        },
      };
      mockSpeechService.speak.mockReturnValue(mockGenerator);

      const config = { prompt: 'WebAudio prompt', voice: 'Puck', fact: 'Interesting fact' };
      await service.generateSpeech('web_audio_api', config);

      expect(mockSpeechService.speak).toHaveBeenCalledWith('WebAudio prompt', 'Puck');
      expect(mockAudioPlayerService.initialize).toHaveBeenCalledWith(16000);
      expect(mockAudioPlayerService.processChunk).toHaveBeenCalledWith(new Uint8Array([3, 4]));
      expect(service.audioUrl()).toBeUndefined();
    });

    it('should handle speak exceptions, clean up, and throw error', async () => {
      mockSpeechService.speak.mockImplementation(() => {
        throw new Error('Speak failed');
      });

      const config = { prompt: 'WebAudio prompt', voice: 'Puck', fact: 'Interesting fact' };
      await expect(service.generateSpeech('web_audio_api', config)).rejects.toThrow(
        'Error streaming speech using the Web Audio API.',
      );

      expect(mockAudioPlayerService.stopAll).toHaveBeenCalled();
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
