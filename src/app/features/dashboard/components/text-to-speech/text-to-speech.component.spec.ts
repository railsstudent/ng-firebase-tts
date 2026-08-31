import { AudioPlayerService } from '@/core/services/audio-player.service';
import { TextToSpeechService } from '@/core/services/text-to-speech.service';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextToSpeechComponent } from './text-to-speech.component';

describe('TextToSpeechComponent', () => {
  let component: TextToSpeechComponent;
  let fixture: ComponentFixture<TextToSpeechComponent>;
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

  beforeEach(async () => {
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

    const pbRateSignal = signal(1);
    Object.defineProperty(mockAudioPlayerService, 'playbackRate', {
      value: pbRateSignal.asReadonly(),
      writable: true,
    });

    await TestBed.configureTestingModule({
      imports: [TextToSpeechComponent],
      providers: [
        { provide: TextToSpeechService, useValue: mockSpeechService },
        { provide: AudioPlayerService, useValue: mockAudioPlayerService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TextToSpeechComponent);
    component = fixture.componentInstance;

    // Set inputs
    fixture.componentRef.setInput('interestingFact', 'Honey never spoils.');
    fixture.componentRef.setInput('audioPrompt', 'Listen to honey fact.');
    fixture.componentRef.setInput('voice', 'Kore');
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should compute isLoading to true if loadingMode is not idle', () => {
    expect(component.isLoading()).toBe(false);

    component.loadingMode.set('sync');
    fixture.detectChanges();
    expect(component.isLoading()).toBe(true);

    component.loadingMode.set('stream');
    fixture.detectChanges();
    expect(component.isLoading()).toBe(true);

    component.loadingMode.set('web_audio_api');
    fixture.detectChanges();
    expect(component.isLoading()).toBe(true);

    component.loadingMode.set('idle');
    fixture.detectChanges();
    expect(component.isLoading()).toBe(false);
  });

  it('should exit early without generating speech if interestingFact is not set', async () => {
    fixture.componentRef.setInput('interestingFact', undefined);
    fixture.detectChanges();

    await component.generateSpeech('sync');

    expect(mockSpeechService.synthesize).not.toHaveBeenCalled();
    expect(component.audioUrl()).toBeUndefined();
  });

  it('should generate speech in sync mode and set the audio URL', async () => {
    const mockBlob = new Blob(['dummy pcm data'], { type: 'audio/pcm' });
    mockSpeechService.synthesize.mockResolvedValue(mockBlob);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:dummy-url');

    await component.generateSpeech('sync');

    expect(mockSpeechService.synthesize).toHaveBeenCalledWith('Listen to honey fact.', 'Kore');
    expect(component.audioUrl()).toBe('blob:dummy-url');
    expect(component.ttsError()).toBe('');
    expect(component.loadingMode()).toBe('idle');
  });

  it('should generate speech in stream mode and set the audio URL', async () => {
    const mockBlob = new Blob(['dummy streamed pcm data'], { type: 'audio/pcm' });

    // synthesizeStream is an AsyncGenerator that yields chunks and then yields the Blob!
    const mockGenerator = {
      async *[Symbol.asyncIterator]() {
        yield { decodedData: new Uint8Array([1, 2]), sampleRate: 24000 };
        yield mockBlob;
      },
    };

    mockSpeechService.synthesizeStream.mockReturnValue(mockGenerator);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:streamed-dummy-url');

    await component.generateSpeech('stream');

    expect(mockSpeechService.synthesizeStream).toHaveBeenCalledWith(
      'Listen to honey fact.',
      'Kore',
    );
    expect(mockAudioPlayerService.initialize).toHaveBeenCalledWith(24000);
    expect(mockAudioPlayerService.processChunk).toHaveBeenCalledWith(new Uint8Array([1, 2]));
    expect(mockAudioPlayerService.awaitPlaybackComplete).toHaveBeenCalled();
    expect(component.audioUrl()).toBe('blob:streamed-dummy-url');
    expect(component.ttsError()).toBe('');
    expect(component.loadingMode()).toBe('idle');
  });

  it('should run zero-latency speaking via speak method in web_audio_api mode', async () => {
    const mockGenerator = {
      async *[Symbol.asyncIterator]() {
        yield { decodedData: new Uint8Array([1, 2]), sampleRate: 16000 };
      },
    };
    mockSpeechService.speak.mockReturnValue(mockGenerator);

    await component.generateSpeech('web_audio_api');

    expect(mockSpeechService.speak).toHaveBeenCalledWith('Listen to honey fact.', 'Kore');
    expect(mockAudioPlayerService.initialize).toHaveBeenCalledWith(16000);
    expect(mockAudioPlayerService.processChunk).toHaveBeenCalledWith(new Uint8Array([1, 2]));
    expect(component.audioUrl()).toBeUndefined();
    expect(component.loadingMode()).toBe('idle');
  });

  it('should catch exceptions and display appropriate error message', async () => {
    mockSpeechService.synthesize.mockRejectedValue(new Error('Error fetching content'));

    await component.generateSpeech('sync');

    expect(component.ttsError()).toBe('Error generating speech (Sync).');
    expect(component.audioUrl()).toBeUndefined();
    expect(component.loadingMode()).toBe('idle');
  });

  it('should immediately revoke previous audioUrl when generateSpeech is called', async () => {
    const mockBlob = new Blob(['dummy pcm data'], { type: 'audio/pcm' });
    mockSpeechService.synthesize.mockResolvedValue(mockBlob);

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:dummy-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

    // First generation
    await component.generateSpeech('sync');
    expect(component.audioUrl()).toBe('blob:dummy-url');

    // Second generation should revoke the first
    await component.generateSpeech('sync');
    expect(revokeSpy).toHaveBeenCalledWith('blob:dummy-url');
  });
});
