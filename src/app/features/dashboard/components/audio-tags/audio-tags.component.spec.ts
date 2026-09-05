import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DEFAULT_VOICE } from '@/features/dashboard/constants/voice-name.const';
import { AudioTagsComponent } from './audio-tags.component';

describe('AudioTagsComponent', () => {
  let component: AudioTagsComponent;
  let fixture: ComponentFixture<AudioTagsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioTagsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioTagsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Seam 1: Form Model & Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize the form model with default voice values', () => {
      const data = component.audioPromptModel();
      expect(data.voiceOption).toBe(DEFAULT_VOICE);
      expect(data.scene).toBe('A news anchor reading the news in a busy newsroom');
      expect(data.emotion).toBe('professional, slightly serious');
      expect(data.pace).toBe('moderate, clear enunciation');
    });
  });

  describe('Seam 2: Signal Form Two-Way Bindings', () => {
    it('should bind and update scene, emotion, and pace inputs through signal form', () => {
      const sceneEl = fixture.debugElement.query(By.css('#scene')).nativeElement as HTMLTextAreaElement;
      sceneEl.value = 'A quiet forest with rustling leaves';
      sceneEl.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const emotionEl = fixture.debugElement.query(By.css('#emotion')).nativeElement as HTMLInputElement;
      emotionEl.value = 'calm and soothing';
      emotionEl.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const paceEl = fixture.debugElement.query(By.css('#pace')).nativeElement as HTMLInputElement;
      paceEl.value = 'slow';
      paceEl.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const formModel = component.audioPromptModel();
      expect(formModel.scene).toBe('A quiet forest with rustling leaves');
      expect(formModel.emotion).toBe('calm and soothing');
      expect(formModel.pace).toBe('slow');
    });
  });

  describe('Seam 3: Child Voice Selector Integration', () => {
    it('should render the app-voice-selector component', () => {
      const voiceSelectorEl = fixture.debugElement.query(By.css('app-voice-selector'));
      expect(voiceSelectorEl).toBeTruthy();
    });

    it('should update voiceOption in audioPromptModel on onValueChange', () => {
      component.onValueChange('Zephyr');
      fixture.detectChanges();

      expect(component.audioPromptModel().voiceOption).toBe('Zephyr');
    });

    it('should update voiceOption when app-voice-selector emits valueChange in template', () => {
      const voiceSelectorEl = fixture.debugElement.query(By.css('app-voice-selector'));
      voiceSelectorEl.triggerEventHandler('valueChange', 'Puck');
      fixture.detectChanges();

      expect(component.audioPromptModel().voiceOption).toBe('Puck');
    });
  });
});
