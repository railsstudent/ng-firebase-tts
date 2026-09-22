import { ImageAnalysisResponse } from '@/core/interfaces/image-analysis.interface';
import { VisionService } from '@/core/services/vision.service';
import { ComponentFixture, DeferBlockState, TestBed } from '@angular/core/testing';
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

  // TEST CASE 2: Deferral Resolution & Model Propagation
  it('should resolve deferred thought summary and propagate analysis inputs when analysis is set', async () => {
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

    const deferBlocks = await fixture.getDeferBlocks();
    expect(deferBlocks.length).toBeGreaterThanOrEqual(1);

    for (const block of deferBlocks) {
      await block.render(DeferBlockState.Complete);
    }
    fixture.detectChanges();

    const thoughtSummary = fixture.debugElement.query(By.css('app-thought-summary'));
    expect(thoughtSummary).toBeTruthy();

    const thoughtComponent = thoughtSummary.componentInstance as { thought: () => string; tokenUsage: () => unknown };
    expect(thoughtComponent.thought()).toBe('Thinking...');
    expect(thoughtComponent.tokenUsage()).toEqual({ input: 10, output: 20, thought: 5, total: 35 });
  });

  // TEST CASE 3: Fallback Defaults when thought and tokenUsage are undefined
  it('should fallback to default thought string and zeroed token usage when not provided in analysis', async () => {
    component.analysis.set({
      parsed: {
        alternativeText: 'Sample image.',
        recommendations: [],
        tags: [],
        fact: 'Sample fact.',
      },
      thought: undefined,
      tokenUsage: undefined,
      metadata: { citations: [], renderedContent: '', searchQueries: [] },
    } as unknown as ImageAnalysisResponse);
    fixture.detectChanges();

    const deferBlocks = await fixture.getDeferBlocks();
    for (const block of deferBlocks) {
      await block.render(DeferBlockState.Complete);
    }
    fixture.detectChanges();

    const thoughtSummary = fixture.debugElement.query(By.css('app-thought-summary'));
    expect(thoughtSummary).toBeTruthy();

    const thoughtComponent = thoughtSummary.componentInstance as { thought: () => string; tokenUsage: () => unknown };
    expect(thoughtComponent.thought()).toBe('');
    expect(thoughtComponent.tokenUsage()).toEqual({ input: 0, output: 0, thought: 0, total: 0 });
  });
});
