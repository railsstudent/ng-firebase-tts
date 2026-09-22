import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ObscureFactComponent } from './obscure-fact.component';

describe('ObscureFactComponent', () => {
  let component: ObscureFactComponent;
  let fixture: ComponentFixture<ObscureFactComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObscureFactComponent],
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
    expect(emptyMsgEl.textContent).toContain('Upload an image to discover an obscure fact and generate speech.');
  });
});
