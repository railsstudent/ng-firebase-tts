import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecommendationsDisplay } from './recommendations.component';
import { By } from '@angular/platform-browser';

describe('RecommendationsDisplay', () => {
  let component: RecommendationsDisplay;
  let fixture: ComponentFixture<RecommendationsDisplay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecommendationsDisplay],
    }).compileComponents();

    fixture = TestBed.createComponent(RecommendationsDisplay);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // TEST CASE 1: Empty Fallback State
  it('should render fallback text when recommendations is empty', () => {
    fixture.componentRef.setInput('recommendations', []);
    fixture.detectChanges();

    const fallbackEl = fixture.debugElement.query(By.css('.no-recommendations'));
    const cards = fixture.debugElement.queryAll(By.css('.recommendation-card'));

    expect(fallbackEl).toBeTruthy();
    expect(fallbackEl.nativeElement.textContent).toContain('No recommendation.');
    expect(cards.length).toBe(0);
  });

  // TEST CASE 2: Render Recommendations List
  it('should render cards containing ID, text, and reason', () => {
    fixture.componentRef.setInput('recommendations', [
      {
        id: 'REC-01',
        text: 'Increase text contrast',
        reason: 'High opacity background makes it difficult to read',
      },
    ]);
    fixture.detectChanges();

    const fallbackEl = fixture.debugElement.query(By.css('.no-recommendations'));
    const cards = fixture.debugElement.queryAll(By.css('.recommendation-card'));
    const recId = fixture.debugElement.query(By.css('.recommendation-id'));
    const recText = fixture.debugElement.query(By.css('.recommendation-text'));
    const recReason = fixture.debugElement.query(By.css('.recommendation-reason-text'));

    expect(fallbackEl).toBeNull();
    expect(cards.length).toBe(1);
    expect(recId.nativeElement.textContent).toContain('REC-01:');
    expect(recText.nativeElement.textContent).toContain('Increase text contrast');
    expect(recReason.nativeElement.textContent).toContain('High opacity background makes it difficult to read');
  });
});
