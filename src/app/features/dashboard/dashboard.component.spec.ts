import { VisionService } from '@/core/services/vision.service';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import DashboardComponent from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockVisionService: { generateAltText: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockVisionService = {
      generateAltText: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [{ provide: VisionService, useValue: mockVisionService }],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // TEST CASE 1: Render structural elements
  it('should render main dashboard wrapper, analyzer panel, and thought summary', () => {
    const mainEl = fixture.debugElement.query(By.css('.dashboard-main'));
    const analyzerPanel = fixture.debugElement.query(By.css('app-analyzer-panel'));
    const thoughtSummary = fixture.debugElement.query(By.css('app-thought-summary'));

    expect(mainEl).toBeTruthy();
    expect(analyzerPanel).toBeTruthy();
    expect(thoughtSummary).toBeNull(); // Empty by default since analysis is undefined
  });

  // TEST CASE 2: Model Sync Propagating
  it('should pass analysis data down to app-thought-summary when analysis is set', () => {
    component.analysis.set({
      parsed: {
        alternativeText: 'A blue sky.',
        recommendations: [],
        tags: ['Sky', 'Blue'],
        fact: 'The sky is blue.',
      },
      thought: 'Thinking...',
      tokenUsage: { input: 10, output: 20, thought: 5, total: 35 },
      metadata: { citations: [], renderedContent: '', searchQueries: [] },
    });
    fixture.detectChanges();

    const thoughtSummary = fixture.debugElement.query(By.css('app-thought-summary'));
    expect(thoughtSummary).toBeTruthy();
  });
});
