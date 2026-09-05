import { RecommendationsDisplay } from '@/features/dashboard/components/recommendations-display/recommendations.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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

  describe('Dimension 1: State & Reactivity', () => {
    it('should render fallback text when recommendations is empty', () => {
      fixture.componentRef.setInput('recommendations', []);
      fixture.detectChanges();

      const fallbackEl = fixture.debugElement.query(By.css('.no-recommendations'));
      const cards = fixture.debugElement.queryAll(By.css('.recommendation-card'));

      expect(fallbackEl).toBeTruthy();
      expect(fallbackEl.nativeElement.textContent).toContain('No recommendation.');
      expect(cards.length).toBe(0);
    });

    it('should reactively update the DOM when recommendations input signal changes', () => {
      fixture.componentRef.setInput('recommendations', [
        { id: 'REC-01', text: 'First Recommendation', reason: 'Reason 1' },
      ]);
      fixture.detectChanges();

      expect(fixture.debugElement.queryAll(By.css('.recommendation-card')).length).toBe(1);

      fixture.componentRef.setInput('recommendations', [
        { id: 'REC-01', text: 'First Recommendation', reason: 'Reason 1' },
        { id: 'REC-02', text: 'Second Recommendation', reason: 'Reason 2' },
      ]);
      fixture.detectChanges();

      expect(fixture.debugElement.queryAll(By.css('.recommendation-card')).length).toBe(2);
    });
  });

  describe('Dimension 2 & 4: Expansion, Lazy Rendering & Teardown Lifecycle', () => {
    const mockRecommendations = [
      {
        id: 'REC-01',
        text: 'Increase text contrast',
        reason: 'High opacity background makes it difficult to read',
      },
    ];

    beforeEach(() => {
      fixture.componentRef.setInput('recommendations', mockRecommendations);
      fixture.detectChanges();
    });

    it('should render trigger with collapsed aria-expanded and reason absent from DOM initially', () => {
      const trigger = fixture.debugElement.query(By.css('[ngAccordionTrigger]'));
      const reasonEl = fixture.debugElement.query(By.css('.recommendation-reason-text'));
      const heading = fixture.debugElement.query(By.css('h4'));
      const icon = fixture.debugElement.query(By.css('.expand-icon'));

      expect(heading).toBeTruthy();
      expect(trigger).toBeTruthy();
      expect(trigger.nativeElement.getAttribute('aria-expanded')).toBe('false');
      expect(reasonEl).toBeNull();
      expect(icon.nativeElement.classList.contains('expand-icon__expanded')).toBe(false);
    });

    it('should mount reason and toggle icon class on trigger click, and unmount on collapse', async () => {
      const trigger = fixture.debugElement.query(By.css('[ngAccordionTrigger]'));
      const icon = fixture.debugElement.query(By.css('.expand-icon'));

      // Click to expand
      trigger.nativeElement.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(trigger.nativeElement.getAttribute('aria-expanded')).toBe('true');
      expect(icon.nativeElement.classList.contains('expand-icon__expanded')).toBe(true);

      const reasonEl = fixture.debugElement.query(By.css('.recommendation-reason-text'));
      expect(reasonEl).not.toBeNull();
      expect(reasonEl.nativeElement.textContent).toContain('High opacity background makes it difficult to read');

      // Click to collapse
      trigger.nativeElement.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(trigger.nativeElement.getAttribute('aria-expanded')).toBe('false');
      expect(icon.nativeElement.classList.contains('expand-icon__expanded')).toBe(false);
      expect(fixture.debugElement.query(By.css('.recommendation-reason-text'))).toBeNull();
    });
  });

  describe('Dimension 3: Keyboard & WAI-ARIA Semantics', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('recommendations', [
        { id: 'REC-01', text: 'Increase text contrast', reason: 'Reason 1' },
      ]);
      fixture.detectChanges();
    });

    it('should toggle expansion via Enter key', async () => {
      const trigger = fixture.debugElement.query(By.css('[ngAccordionTrigger]'));

      // Simulate keyboard focus followed by Enter keydown
      trigger.nativeElement.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      trigger.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(trigger.nativeElement.getAttribute('aria-expanded')).toBe('true');
      expect(fixture.debugElement.query(By.css('.recommendation-reason-text'))).not.toBeNull();
    });

    it('should toggle expansion via Space key', async () => {
      const trigger = fixture.debugElement.query(By.css('[ngAccordionTrigger]'));

      // Simulate keyboard focus followed by Space keydown
      trigger.nativeElement.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      trigger.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(trigger.nativeElement.getAttribute('aria-expanded')).toBe('true');
      expect(fixture.debugElement.query(By.css('.recommendation-reason-text'))).not.toBeNull();
    });

    it('should link aria-controls on the trigger to the panel DOM id', () => {
      const trigger = fixture.debugElement.query(By.css('[ngAccordionTrigger]'));
      const panel = fixture.debugElement.query(By.css('[ngAccordionPanel]'));

      const controlsId = trigger.nativeElement.getAttribute('aria-controls');
      const panelId = panel.nativeElement.getAttribute('id');

      expect(controlsId).toBeTruthy();
      expect(panelId).toBeTruthy();
      expect(controlsId).toBe(panelId);
    });
  });

  describe('Dimension 4.3: Independent Multi-Panel Expansion', () => {
    it('should support multiple open panels simultaneously when multiExpandable is true', async () => {
      fixture.componentRef.setInput('recommendations', [
        { id: 'REC-01', text: 'Recommendation 1', reason: 'Reason 1' },
        { id: 'REC-02', text: 'Recommendation 2', reason: 'Reason 2' },
      ]);
      fixture.detectChanges();

      const triggers = fixture.debugElement.queryAll(By.css('[ngAccordionTrigger]'));
      expect(triggers.length).toBe(2);

      // Open panel 1
      triggers[0].nativeElement.click();
      fixture.detectChanges();
      await fixture.whenStable();

      // Open panel 2
      triggers[1].nativeElement.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const reasonElements = fixture.debugElement.queryAll(By.css('.recommendation-reason-text'));
      expect(reasonElements.length).toBe(2);
      expect(reasonElements[0].nativeElement.textContent).toContain('Reason 1');
      expect(reasonElements[1].nativeElement.textContent).toContain('Reason 2');
    });
  });
});
