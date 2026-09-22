import { DEFAULT_PLAYBACK_RATE } from '@/core/constants/text-to-speech.constant';
import { AudioStreamChunk } from '@/core/interfaces/text-to-speech.interface';
import { AudioPlayerService } from '@/core/services/audio-player.service';
import { TestBed } from '@angular/core/testing';

interface MockSourceNode {
  buffer: unknown;
  playbackRate: { value: number };
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
}

interface MockBuffer {
  duration: number;
  copyToChannel: ReturnType<typeof vi.fn>;
}

interface MockAudioContext {
  currentTime: number;
  sampleRate: number;
  createBuffer: ReturnType<typeof vi.fn>;
  createBufferSource: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  destination: Record<string, unknown>;
}

describe('AudioPlayerService', () => {
  let service: AudioPlayerService;
  let mockAudioContext: MockAudioContext;
  let mockSourceNode: MockSourceNode;
  let mockBuffer: MockBuffer;

  beforeEach(() => {
    mockSourceNode = {
      buffer: null,
      playbackRate: { value: 1 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: null,
    };

    mockBuffer = {
      duration: 1,
      copyToChannel: vi.fn(),
    };

    mockAudioContext = {
      currentTime: 10,
      sampleRate: 24000,
      createBuffer: vi.fn().mockReturnValue(mockBuffer),
      createBufferSource: vi.fn().mockReturnValue(mockSourceNode),
      close: vi.fn().mockResolvedValue(undefined),
      destination: {},
    };

    // Use constructible ES5 function for the AudioContext constructor mock
    const audioContextConstructorMock = vi.fn().mockImplementation(function (this: unknown) {
      return mockAudioContext;
    });

    vi.stubGlobal('AudioContext', audioContextConstructorMock);

    TestBed.configureTestingModule({
      providers: [AudioPlayerService],
    });

    service = TestBed.inject(AudioPlayerService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should initialize AudioContext correctly on initialize()', () => {
    service.initialize(24000);
    expect(globalThis.AudioContext).toHaveBeenCalledWith({ sampleRate: 24000 });
  });

  describe('SSR Safety', () => {
    it('should instantiate safely and no-op without crashing when AudioContext is undefined in global scope', () => {
      vi.stubGlobal('AudioContext', undefined);

      const ssrService = TestBed.runInInjectionContext(() => new AudioPlayerService());
      expect(ssrService).toBeDefined();
      expect(() => ssrService.stopAll()).not.toThrow();
    });
  });

  it('should not process chunk if AudioContext is not initialized', () => {
    const rawBytes = new Uint8Array([0, 0, 100, 100]);
    service.processChunk(rawBytes);
    expect(mockAudioContext.createBuffer).not.toHaveBeenCalled();
  });

  it('should convert 16-bit PCM bytes to Float32 [-1.0, 1.0] and play it via createBuffer', () => {
    service.initialize(24000);

    const int16Array = new Int16Array([0, 32767]);
    const rawBytes = new Uint8Array(int16Array.buffer);

    service.processChunk(rawBytes);

    expect(mockAudioContext.createBuffer).toHaveBeenCalledWith(1, 2, 24000);
    expect(mockBuffer.copyToChannel).toHaveBeenCalled();

    const copiedFloatArray = mockBuffer.copyToChannel.mock.calls[0][0] as Float32Array;
    expect(copiedFloatArray[0]).toBeCloseTo(0, 5);
    expect(copiedFloatArray[1]).toBeCloseTo(32767 / 32768.0, 5);

    expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    expect(mockSourceNode.connect).toHaveBeenCalledWith(mockAudioContext.destination);
    expect(mockSourceNode.start).toHaveBeenCalled();
  });

  it('should stop and clean up active sources on stopAll()', () => {
    service.initialize(24000);

    const int16Array = new Int16Array([0, 1000]);
    const rawBytes = new Uint8Array(int16Array.buffer);

    service.processChunk(rawBytes); // Adds source node
    service.stopAll();

    expect(mockSourceNode.stop).toHaveBeenCalled();
    expect(mockSourceNode.disconnect).toHaveBeenCalled();
    expect(mockAudioContext.close).toHaveBeenCalled();
  });

  it('should automatically remove source node from list when it ends playing', () => {
    service.initialize(24000);

    const int16Array = new Int16Array([0, 1000]);
    const rawBytes = new Uint8Array(int16Array.buffer);

    service.processChunk(rawBytes);

    expect(mockSourceNode.onended).toBeTypeOf('function');
    if (mockSourceNode.onended) {
      mockSourceNode.onended(); // Simulate completion callback
    }

    mockSourceNode.stop.mockClear();
    service.stopAll();
    expect(mockSourceNode.stop).not.toHaveBeenCalled();
  });

  describe('awaitPlaybackComplete', () => {
    let testService: AudioPlayerService;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(Math, 'random').mockReturnValue(1 / 3);
      testService = TestBed.runInInjectionContext(() => new AudioPlayerService());
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('should resolve instantly if not initialized', async () => {
      await expect(testService.awaitPlaybackComplete()).resolves.toBeUndefined();
    });

    it('should resolve instantly if initialized but no audio is scheduled', async () => {
      testService.initialize(24000);
      const promise = testService.awaitPlaybackComplete();
      await vi.advanceTimersByTimeAsync(100);
      await expect(promise).resolves.toBeUndefined();
    });

    it('should block until all scheduled audio is finished playing', async () => {
      testService.initialize(24000);

      mockAudioContext.currentTime = 10;

      // Process two chunks (each takes 1 second to play, total 2 seconds, nextStartTime = 12)
      const int16Array = new Int16Array([0, 1000]);
      const rawBytes = new Uint8Array(int16Array.buffer);
      testService.processChunk(rawBytes);
      testService.processChunk(rawBytes);

      let resolved = false;
      const promise = testService.awaitPlaybackComplete().then(() => {
        resolved = true;
      });

      // Advance by 100ms - remainingTime is still 1.9s, so shouldn't resolve
      await vi.advanceTimersByTimeAsync(100);
      expect(resolved).toBe(false);

      // Advance by 1800ms more - still 100ms left
      await vi.advanceTimersByTimeAsync(1800);
      expect(resolved).toBe(false);

      // Update mock currentTime to be past the playback end time (12)
      mockAudioContext.currentTime = 12.1;

      // Advance by 100ms more - should resolve now
      await vi.advanceTimersByTimeAsync(100);
      await promise;
      expect(resolved).toBe(true);
    });

    it('should resolve immediately if stopAll() is called mid-playback', async () => {
      testService.initialize(24000);

      mockAudioContext.currentTime = 10;
      const int16Array = new Int16Array([0, 1000]);
      const rawBytes = new Uint8Array(int16Array.buffer);
      testService.processChunk(rawBytes); // schedules playing from 10 to 11

      let resolved = false;
      const promise = testService.awaitPlaybackComplete().then(() => {
        resolved = true;
      });

      // Stop all mid-playback
      testService.stopAll();

      // Advance timers - should resolve instantly now
      await vi.advanceTimersByTimeAsync(100);
      await promise;
      expect(resolved).toBe(true);
    });
  });

  describe('playStream', () => {
    async function* createMockStream(chunks: AudioStreamChunk[]): AsyncGenerator<AudioStreamChunk, void, unknown> {
      for (const chunk of chunks) {
        yield chunk;
      }
    }

    it('should consume chunks, initialize audio context on first chunk, and await completion', async () => {
      const chunk1: AudioStreamChunk = {
        decodedData: new Uint8Array([0, 100]),
        sampleRate: 16000,
        mimeType: 'audio/l16; rate=16000',
      };
      const chunk2: AudioStreamChunk = {
        decodedData: new Uint8Array([0, 200]),
        sampleRate: 16000,
        mimeType: 'audio/l16; rate=16000',
      };

      const stream = createMockStream([chunk1, chunk2]);
      const awaitSpy = vi.spyOn(service, 'awaitPlaybackComplete').mockResolvedValue(undefined);

      await service.playStream(stream, { playbackRate: 1.25 });

      expect(globalThis.AudioContext).toHaveBeenCalledWith({ sampleRate: 16000 });
      expect(mockAudioContext.createBuffer).toHaveBeenCalledTimes(2);
      expect(mockSourceNode.playbackRate.value).toBe(1.25);
      expect(awaitSpy).toHaveBeenCalled();
    });

    it('should abort immediately and stopAll when signal is already aborted', async () => {
      const abortController = new AbortController();
      abortController.abort();

      const stopSpy = vi.spyOn(service, 'stopAll');
      const stream = createMockStream([
        {
          decodedData: new Uint8Array([1, 2]),
          sampleRate: 24000,
          mimeType: 'audio/l16',
        },
      ]);

      await service.playStream(stream, { signal: abortController.signal });

      expect(stopSpy).toHaveBeenCalled();
      expect(mockAudioContext.createBuffer).not.toHaveBeenCalled();
    });

    it('should stopAll and return early if signal aborts mid-stream', async () => {
      const abortController = new AbortController();

      async function* createAbortableStream(): AsyncGenerator<AudioStreamChunk, void, unknown> {
        yield {
          decodedData: new Uint8Array([1, 2]),
          sampleRate: 24000,
          mimeType: 'audio/l16',
        };
        abortController.abort();
        yield {
          decodedData: new Uint8Array([3, 4]),
          sampleRate: 24000,
          mimeType: 'audio/l16',
        };
      }

      const stopSpy = vi.spyOn(service, 'stopAll');
      await service.playStream(createAbortableStream(), { signal: abortController.signal });

      expect(stopSpy).toHaveBeenCalled();
    });

    it('should handle an empty stream gracefully without initializing AudioContext or failing', async () => {
      const stream = createMockStream([]);
      const awaitSpy = vi.spyOn(service, 'awaitPlaybackComplete');

      await expect(service.playStream(stream)).resolves.toBeUndefined();

      expect(globalThis.AudioContext).not.toHaveBeenCalled();
      expect(awaitSpy).toHaveBeenCalled();
    });

    it('should use DEFAULT_PLAYBACK_RATE when options are omitted', async () => {
      const chunk: AudioStreamChunk = {
        decodedData: new Uint8Array([0, 100]),
        sampleRate: 16000,
        mimeType: 'audio/l16; rate=16000',
      };
      const stream = createMockStream([chunk]);
      vi.spyOn(service, 'awaitPlaybackComplete').mockResolvedValue(undefined);

      await service.playStream(stream);

      expect(mockSourceNode.playbackRate.value).toBe(DEFAULT_PLAYBACK_RATE);
    });
  });
});
