import { AudioPlayerService } from '@/core/services/audio-player.service';
import { TextToSpeechService } from '@/core/services/text-to-speech.service';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ObscureFactComponent } from './obscure-fact.component';

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
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should compute audioTagsModel, audioPrompt, and voice correctly', () => {
    fixture.componentRef.setInput('interestingFact', 'Did you know that honey never spoils?');
    fixture.detectChanges();

    expect(component.audioTagsModel()).toEqual({
      scene: 'A news anchor reading the news in a busy newsroom',
      emotion: 'professional, slightly serious',
      pace: 'moderate, clear enunciation',
      voiceOption: 'Kore',
    });

    expect(component.voice()).toBe('Kore');
    expect(component.audioPrompt()).toContain('Did you know that honey never spoils?');
  });

  it('should render the app-text-to-speech component when interestingFact is present', () => {
    fixture.componentRef.setInput('interestingFact', 'Stars are beautiful.');
    fixture.detectChanges();

    const textToSpeechEl = fixture.nativeElement.querySelector('app-text-to-speech');
    expect(textToSpeechEl).toBeTruthy();

    const emptyMsgEl = fixture.nativeElement.querySelector('.obscure-fact-empty');
    expect(emptyMsgEl).toBeFalsy();
  });

  it('should show the empty placeholder message and omit app-text-to-speech when interestingFact is not present', () => {
    fixture.componentRef.setInput('interestingFact', undefined);
    fixture.detectChanges();

    const textToSpeechEl = fixture.nativeElement.querySelector('app-text-to-speech');
    expect(textToSpeechEl).toBeFalsy();

    const emptyMsgEl = fixture.nativeElement.querySelector('.obscure-fact-empty');
    expect(emptyMsgEl).toBeTruthy();
    expect(emptyMsgEl.textContent).toContain('The tag(s) does not have any interesting or obscure fact.');
  });
});
