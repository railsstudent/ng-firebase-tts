import { GeneratedAudioRecord } from '@/features/dashboard/components/text-to-speech/interfaces/audio.interface';
import { GenerateSpeechMode } from '@/features/dashboard/types/generate-speech-mode.type';
import { signal, Signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextToSpeechViewService } from './services/text-to-speech-view';
import { TextToSpeechComponent } from './text-to-speech.component';

describe('TextToSpeechComponent', () => {
  let component: TextToSpeechComponent;
  let fixture: ComponentFixture<TextToSpeechComponent>;
  let mockViewService: {
    generateSpeech: ReturnType<typeof vi.fn>;
    activeAudio: Signal<GeneratedAudioRecord | undefined>;
    playbackRate: Signal<number>;
    loadingMode: Signal<GenerateSpeechMode | 'idle'>;
  };

  beforeEach(async () => {
    const activeAudioSignal = signal<GeneratedAudioRecord | undefined>(undefined);
    const playbackRateSignal = signal(1.25);
    const loadingModeSignal = signal<GenerateSpeechMode | 'idle'>('idle');

    mockViewService = {
      generateSpeech: vi.fn(),
      activeAudio: activeAudioSignal,
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

  describe('Request Deduplication and isGeneratedForCurrentInput', () => {
    it('should compute isGeneratedForCurrentInput correctly based on activeAudio and inputs', () => {
      expect(component.isGeneratedForCurrentInput()).toBe(false);

      (mockViewService.activeAudio as unknown as WritableSignal<GeneratedAudioRecord | undefined>).set({
        url: 'blob:mock-url',
        prompt: 'Listen to honey fact.',
        voice: 'Kore',
      });
      fixture.detectChanges();
      expect(component.isGeneratedForCurrentInput()).toBe(true);

      // Changing voice makes it false
      fixture.componentRef.setInput('voice', 'Puck');
      fixture.detectChanges();
      expect(component.isGeneratedForCurrentInput()).toBe(false);

      // Reverting voice makes it true again
      fixture.componentRef.setInput('voice', 'Kore');
      fixture.detectChanges();
      expect(component.isGeneratedForCurrentInput()).toBe(true);

      // Changing prompt makes it false
      fixture.componentRef.setInput('audioPrompt', 'Different prompt');
      fixture.detectChanges();
      expect(component.isGeneratedForCurrentInput()).toBe(false);
    });

    it('should skip speech generation for sync and stream mode when isGeneratedForCurrentInput is true', async () => {
      (mockViewService.activeAudio as unknown as WritableSignal<GeneratedAudioRecord | undefined>).set({
        url: 'blob:mock-url',
        prompt: 'Listen to honey fact.',
        voice: 'Kore',
      });
      fixture.detectChanges();

      await component.generateSpeech('sync');
      await component.generateSpeech('stream');

      expect(mockViewService.generateSpeech).not.toHaveBeenCalled();
    });

    it('should still allow generation for web_audio_api mode when isGeneratedForCurrentInput is true', async () => {
      (mockViewService.activeAudio as unknown as WritableSignal<GeneratedAudioRecord | undefined>).set({
        url: 'blob:mock-url',
        prompt: 'Listen to honey fact.',
        voice: 'Kore',
      });
      fixture.detectChanges();

      await component.generateSpeech('web_audio_api');

      expect(mockViewService.generateSpeech).toHaveBeenCalledWith('web_audio_api', {
        prompt: 'Listen to honey fact.',
        voice: 'Kore',
        fact: 'Honey never spoils.',
      });
    });
  });

  describe('Audio Element Rendering & Loading State Suppression', () => {
    it('should render the audio element when audioUrl is present and loadingMode is idle', () => {
      (mockViewService.activeAudio as unknown as WritableSignal<GeneratedAudioRecord | undefined>).set({
        url: 'blob:test-url',
        prompt: 'Listen to honey fact.',
        voice: 'Kore',
      });
      (mockViewService.loadingMode as unknown as WritableSignal<GenerateSpeechMode | 'idle'>).set('idle');
      fixture.detectChanges();

      const audioElement = fixture.nativeElement.querySelector('audio.playback-audio');
      expect(audioElement).toBeTruthy();
      expect(audioElement.getAttribute('src')).toBe('blob:test-url');
    });

    it('should hide the audio element during in-flight generation even if audioUrl exists', () => {
      (mockViewService.activeAudio as unknown as WritableSignal<GeneratedAudioRecord | undefined>).set({
        url: 'blob:test-url',
        prompt: 'Listen to honey fact.',
        voice: 'Kore',
      });
      (mockViewService.loadingMode as unknown as WritableSignal<GenerateSpeechMode | 'idle'>).set('sync');
      fixture.detectChanges();

      let audioElement = fixture.nativeElement.querySelector('audio.playback-audio');
      expect(audioElement).toBeNull();

      (mockViewService.loadingMode as unknown as WritableSignal<GenerateSpeechMode | 'idle'>).set('stream');
      fixture.detectChanges();
      audioElement = fixture.nativeElement.querySelector('audio.playback-audio');
      expect(audioElement).toBeNull();

      (mockViewService.loadingMode as unknown as WritableSignal<GenerateSpeechMode | 'idle'>).set('web_audio_api');
      fixture.detectChanges();
      audioElement = fixture.nativeElement.querySelector('audio.playback-audio');
      expect(audioElement).toBeNull();

      // Restores when back to idle
      (mockViewService.loadingMode as unknown as WritableSignal<GenerateSpeechMode | 'idle'>).set('idle');
      fixture.detectChanges();
      audioElement = fixture.nativeElement.querySelector('audio.playback-audio');
      expect(audioElement).toBeTruthy();
    });
  });
});
