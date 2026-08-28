import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextToSpeechComponent } from './text-to-speech.component';

describe('TextToSpeechComponent', () => {
  let component: TextToSpeechComponent;
  let fixture: ComponentFixture<TextToSpeechComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextToSpeechComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TextToSpeechComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('playbackRate', 1);
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should compute isLoading to true if any input is loading', () => {
    expect(component.isLoading()).toBe(false);

    fixture.componentRef.setInput('isLoadingSync', true);
    fixture.detectChanges();
    expect(component.isLoading()).toBe(true);

    fixture.componentRef.setInput('isLoadingSync', false);
    fixture.componentRef.setInput('isLoadingStream', true);
    fixture.detectChanges();
    expect(component.isLoading()).toBe(true);
  });

  it('should emit generateSpeech event on button click', () => {
    vi.spyOn(component.generateSpeech, 'emit');

    const button = fixture.nativeElement.querySelector('button');
    button.click();

    expect(component.generateSpeech.emit).toHaveBeenCalledWith('sync');
  });
});
