import { AudioPlayerService } from '@/core/services/audio-player.service';
import { TextToSpeechService } from '@/core/services/text-to-speech.service';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ObscureFactComponent } from './obscure-fact.component';
import { ModeWithAudioTags } from '@/features/dashboard/interfaces/mode-audio-tags.interface';

describe('ObscureFactComponent', () => {
  let component: ObscureFactComponent;
  let fixture: ComponentFixture<ObscureFactComponent>;
  let mockSpeechService: {
    synthesize: ReturnType<typeof vi.fn>;
    synthesizeStream: ReturnType<typeof vi.fn>;
    speak: ReturnType<typeof vi.fn>;
  };
  let mockAudioPlayerService: {
    playbackRate: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockSpeechService = {
      synthesize: vi.fn(),
      synthesizeStream: vi.fn(),
      speak: vi.fn(),
    };
    mockAudioPlayerService = {
      playbackRate: vi.fn(),
    };

    // Define playbackRate as a signal mock
    const pbRateSignal = signal(1);
    Object.defineProperty(mockAudioPlayerService, 'playbackRate', {
      value: pbRateSignal.asReadonly(),
      writable: true,
    });

    await TestBed.configureTestingModule({
      imports: [ObscureFactComponent],
      providers: [
        { provide: TextToSpeechService, useValue: mockSpeechService },
        { provide: AudioPlayerService, useValue: mockAudioPlayerService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ObscureFactComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should generate speech in sync mode and set the audio URL', async () => {
    const mockBlob = new Blob(['dummy pcm data'], { type: 'audio/pcm' });
    mockSpeechService.synthesize.mockResolvedValue(mockBlob);

    fixture.componentRef.setInput('interestingFact', 'Did you know that honey never spoils?');
    fixture.detectChanges();

    const mockPayload: ModeWithAudioTags = {
      mode: 'sync',
      audioTags: {
        scene: 'A quiet room',
        emotion: 'happy',
        pace: 'normal',
        voiceOption: 'Kore',
      },
    };

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:dummy-url');

    await component.generateSpeech(mockPayload);

    expect(mockSpeechService.synthesize).toHaveBeenCalled();
    expect(component.audioUrl()).toBe('blob:dummy-url');
    expect(component.ttsError()).toBe('');
  });

  it('should generate speech in stream mode and set the audio URL', async () => {
    const mockBlob = new Blob(['dummy streamed pcm data'], { type: 'audio/pcm' });
    mockSpeechService.synthesizeStream.mockResolvedValue(mockBlob);

    fixture.componentRef.setInput('interestingFact', 'Another fun fact about stars.');
    fixture.detectChanges();

    const mockPayload: ModeWithAudioTags = {
      mode: 'stream',
      audioTags: {
        scene: 'Space',
        emotion: 'calm',
        pace: 'slow',
        voiceOption: 'Zephyr',
      },
    };

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:streamed-dummy-url');

    await component.generateSpeech(mockPayload);

    expect(mockSpeechService.synthesizeStream).toHaveBeenCalled();
    expect(component.audioUrl()).toBe('blob:streamed-dummy-url');
  });

  it('should run zero-latency speaking via speak method in web_audio_api mode', async () => {
    mockSpeechService.speak.mockResolvedValue(undefined);

    fixture.componentRef.setInput(
      'interestingFact',
      'Sound travels underwater faster than in air.',
    );
    fixture.detectChanges();

    const mockPayload: ModeWithAudioTags = {
      mode: 'web_audio_api',
      audioTags: {
        scene: 'Underwater lab',
        emotion: 'serious',
        pace: 'moderate',
        voiceOption: 'Puck',
      },
    };

    await component.generateSpeech(mockPayload);

    expect(mockSpeechService.speak).toHaveBeenCalled();
    expect(component.audioUrl()).toBeUndefined();
    expect(component.isLoadingWebAudio()).toBe(false);
  });

  it('should catch exceptions and display appropriate error message', async () => {
    mockSpeechService.synthesize.mockRejectedValue(new Error('Error fetching content'));

    fixture.componentRef.setInput('interestingFact', 'Error case fact.');
    fixture.detectChanges();

    const mockPayload: ModeWithAudioTags = {
      mode: 'sync',
      audioTags: {
        scene: 'A library',
        emotion: 'sad',
        pace: 'slow',
        voiceOption: 'Kore',
      },
    };

    await component.generateSpeech(mockPayload);

    expect(component.ttsError()).toBe('Error generating speech (Sync).');
    expect(component.audioUrl()).toBeUndefined();
  });
});
