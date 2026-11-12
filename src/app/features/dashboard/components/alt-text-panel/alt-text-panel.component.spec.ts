import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { AltTextPanel } from './alt-text-panel.component';
import { SpinnerIconComponent } from '@/shared/ui/icons/spinner-icon.component';
import { By } from '@angular/platform-browser';

describe('AltTextPanel', () => {
  let component: AltTextPanel;
  let fixture: ComponentFixture<AltTextPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AltTextPanel, SpinnerIconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AltTextPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // TEST CASE 1: Welcome Initial State
  it('should render welcome instructions when state is empty', () => {
    fixture.componentRef.setInput('analysis', undefined);
    fixture.componentRef.setInput('error', undefined);
    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();

    const emptyState = fixture.debugElement.query(By.css('.text-center'));
    expect(emptyState).toBeTruthy();
    expect(emptyState.nativeElement.textContent).toContain('Upload an image and click "Generate" to see the results.');
  });

  // TEST CASE 2: Loading State
  it('should render spinner-icon when isLoading is true', () => {
    fixture.componentRef.setInput('analysis', undefined);
    fixture.componentRef.setInput('error', undefined);
    fixture.componentRef.setInput('isLoading', true);
    fixture.detectChanges();

    const emptyState = fixture.debugElement.query(By.css('.text-center'));
    const loadingState = fixture.debugElement.query(By.css('.loading-state'));
    const spinner = fixture.debugElement.query(By.css('app-spinner-icon'));

    expect(emptyState).toBeNull();
    expect(loadingState).toBeTruthy();
    expect(spinner).toBeTruthy();
  });

  // TEST CASE 3: Error Banner State
  it('should render error card when error message is supplied', () => {
    fixture.componentRef.setInput('analysis', undefined);
    fixture.componentRef.setInput('error', 'Failed to contact Vertex AI backend');
    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();

    const emptyState = fixture.debugElement.query(By.css('.empty-message'));
    const errorDisplay = fixture.debugElement.query(By.css('app-error-display'));
    const errorBlock = fixture.debugElement.query(By.css('.error-block'));

    expect(emptyState).toBeNull();
    expect(errorDisplay).toBeTruthy();
    expect(errorBlock).toBeTruthy();
    expect(errorBlock.nativeElement.textContent).toContain('Failed to contact Vertex AI backend');
  });

  // TEST CASE 4: Analysis Results Rendering
  it('should render display blocks when analysis payload is supplied', () => {
    fixture.componentRef.setInput('analysis', {
      parsed: {
        alternativeText: 'A high contrast graphic of Mars.',
        recommendations: [{ id: 'REC-01', text: 'Contrast adjustment', reason: 'Background is too dark' }],
      },
      metadata: {
        citations: [],
        searchQueries: [],
      },
    });
    fixture.componentRef.setInput('error', undefined);
    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();

    const emptyState = fixture.debugElement.query(By.css('.text-center'));
    const errorCard = fixture.debugElement.query(By.css('.error-card'));
    const results = fixture.debugElement.query(By.css('.results-wrapper'));
    const altTextDisplay = fixture.debugElement.query(By.css('.text-secondary'));

    expect(emptyState).toBeNull();
    expect(errorCard).toBeNull();
    expect(results).toBeTruthy();
    expect(altTextDisplay).toBeTruthy();
    expect(altTextDisplay.nativeElement.textContent).toContain('A high contrast graphic of Mars.');
  });

  // TEST CASE 5: Image Subject Category Badge Rendering
  it('should render .category-badge inside .alt-text-header when analysis.category is provided', () => {
    fixture.componentRef.setInput('analysis', {
      parsed: {
        alternativeText: 'Eiffel Tower (48.8584° N, 2.2945° E) at dusk.',
        recommendations: [],
      },
      metadata: {
        citations: [],
        searchQueries: [],
      },
      category: 'place',
    });
    fixture.componentRef.setInput('error', undefined);
    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();

    const header = fixture.debugElement.query(By.css('.alt-text-header'));
    const badge = fixture.debugElement.query(By.css('.category-badge'));

    expect(header).toBeTruthy();
    expect(badge).toBeTruthy();
    expect(badge.nativeElement.textContent.trim()).toBe('place');
  });

  // TEST CASE 6: Omit Category Badge When Undefined
  it('should not render .category-badge when analysis.category is undefined', () => {
    fixture.componentRef.setInput('analysis', {
      parsed: {
        alternativeText: 'A high contrast graphic of Mars.',
        recommendations: [],
      },
      metadata: {
        citations: [],
        searchQueries: [],
      },
    });
    fixture.componentRef.setInput('error', undefined);
    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();

    const badge = fixture.debugElement.query(By.css('.category-badge'));
    expect(badge).toBeNull();
  });
});
