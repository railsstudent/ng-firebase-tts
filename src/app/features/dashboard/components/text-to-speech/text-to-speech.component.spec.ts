import { signal, Signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GenerateSpeechMode } from '@/features/dashboard/types/generate-speech-mode.type';
import { TextToSpeechViewService } from './services/text-to-speech-view';
import { TextToSpeechComponent } from './text-to-speech.component';

describe('TextToSpeechComponent', () => {
  let component: TextToSpeechComponent;
  let fixture: ComponentFixture<TextToSpeechComponent>;
  let mockViewService: {
    generateSpeech: ReturnType<typeof vi.fn>;
    audioUrl: Signal<string | undefined>;
    playbackRate: Signal<number>;
    loadingMode: Signal<GenerateSpeechMode | 'idle'>;
  };

  beforeEach(async () => {
    const audioUrlSignal = signal<string | undefined>(undefined);
    const playbackRateSignal = signal(1.25);
    const loadingModeSignal = signal<GenerateSpeechMode | 'idle'>('idle');

    mockViewService = {
      generateSpeech: vi.fn(),
      audioUrl: audioUrlSignal,
      playbackRate: playbackRateSignal,
      loadingMode: loadingModeSignal,
    };

    await TestBed.configureTestingModule({
      imports: [TextToSpeechComponent],
    })
      .overrideComponent(TextToSpeechComponent, {
        set: {
          providers: [{ provide: TextToSpeechViewService, useValue: mockViewService }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TextToSpeechComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('interestingFact', 'Honey never spoils.');
    fixture.componentRef.setInput('audioPrompt', 'Listen to honey fact.');
    fixture.componentRef.setInput('voice', 'Kore');
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should compute isLoading correctly based on loadingRate signal', () => {
    expect(component.isLoading()).toBe(false);

    (mockViewService.loadingMode as unknown as WritableSignal<GenerateSpeechMode | 'idle'>).set('sync');
    fixture.detectChanges();
    expect(component.isLoading()).toBe(true);

    (mockViewService.loadingMode as unknown as WritableSignal<GenerateSpeechMode | 'idle'>).set('idle');
    fixture.detectChanges();
    expect(component.isLoading()).toBe(false);
  });

  it('should exit early without generating speech if interestingFact is not set', async () => {
    fixture.componentRef.setInput('interestingFact', undefined);
    fixture.detectChanges();

    await component.generateSpeech('sync');

    expect(mockViewService.generateSpeech).not.toHaveBeenCalled();
  });

  it('should delegate speech generation to the view service with correct inputs', async () => {
    await component.generateSpeech('sync');

    expect(mockViewService.generateSpeech).toHaveBeenCalledWith('sync', {
      prompt: 'Listen to honey fact.',
      voice: 'Kore',
      fact: 'Honey never spoils.',
    });
  });

  it('should set ttsError model if generateSpeech fails', async () => {
    mockViewService.generateSpeech.mockRejectedValue(new Error('Mock synthesis error'));

    await component.generateSpeech('sync');

    expect(component.ttsError()).toBe('Mock synthesis error');
  });

  it('should render playback rate in the Web Audio API button during active streaming', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button.btn-audio');
    const webAudioBtn = buttons[2];

    expect(webAudioBtn.textContent).toContain('Web Audio API');

    (mockViewService.playbackRate as unknown as WritableSignal<number>).set(1.15);
    (mockViewService.loadingMode as unknown as WritableSignal<GenerateSpeechMode | 'idle'>).set('web_audio_api');
    fixture.detectChanges();

    expect(webAudioBtn.textContent).toContain('Speak (Playback rate: 1.15)');
  });
});
