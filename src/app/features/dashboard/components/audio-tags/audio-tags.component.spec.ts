import { ComponentFixture, TestBed } from '@angular/core/testing';
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

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize the form model with default voice values', () => {
    const data = component.audioPromptModel();
    expect(data.voiceOption).toBe('Kore');
    expect(data.scene).toBe('A news anchor reading the news in a busy newsroom');
  });

  it('should sort prebuilt voice options alphabetically', () => {
    const voiceOptions = component.sortedVoiceOptions();
    expect(voiceOptions.length).toBeGreaterThan(0);
    expect(voiceOptions[0].name.localeCompare(voiceOptions[1].name)).toBeLessThanOrEqual(0);
  });
});
