import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AltTextPanel } from './alt-text-panel';
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

    const emptyState = fixture.debugElement.query(By.css('.empty-state'));
    expect(emptyState).toBeTruthy();
    expect(emptyState.nativeElement.textContent).toContain('Upload an image and click "Generate" to see the results.');
  });

  // TEST CASE 2: Loading State
  it('should render spinner-icon when isLoading is true', () => {
    fixture.componentRef.setInput('analysis', undefined);
    fixture.componentRef.setInput('error', undefined);
    fixture.componentRef.setInput('isLoading', true);
    fixture.detectChanges();

    const emptyState = fixture.debugElement.query(By.css('.empty-state'));
    const loadingState = fixture.debugElement.query(By.css('.loading-state'));
    const spinner = fixture.debugElement.query(By.css('.loading-spinner'));

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

    const emptyState = fixture.debugElement.query(By.css('.empty-state'));
    const errorCard = fixture.debugElement.query(By.css('.error-card'));

    expect(emptyState).toBeNull();
    expect(errorCard).toBeTruthy();
    expect(errorCard.nativeElement.textContent).toContain('Failed to contact Vertex AI backend');
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

    const emptyState = fixture.debugElement.query(By.css('.empty-state'));
    const errorCard = fixture.debugElement.query(By.css('.error-card'));
    const results = fixture.debugElement.query(By.css('.results-wrapper'));

    expect(emptyState).toBeNull();
    expect(errorCard).toBeNull();
    expect(results).toBeTruthy();
  });
});
