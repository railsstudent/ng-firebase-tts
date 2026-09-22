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
  it('should render main dashboard wrapper, analyzer panel, and no token usage or thought summary by default', () => {
    const mainEl = fixture.debugElement.query(By.css('.dashboard-main'));
    const analyzerPanel = fixture.debugElement.query(By.css('app-analyzer-panel'));
    const tokenUsage = fixture.debugElement.query(By.css('.usage-section'));
    const thoughtSummary = fixture.debugElement.query(By.css('app-thought-summary'));

    expect(mainEl).toBeTruthy();
    expect(analyzerPanel).toBeTruthy();
    expect(tokenUsage).toBeNull();
    expect(thoughtSummary).toBeNull();
  });

  // TEST CASE 2: Deferral Resolution & Model Propagation
  it('should render token usage and resolve deferred thought summary when analysis has thought and tokenUsage', async () => {
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

    const tokenUsage = fixture.debugElement.query(By.css('.usage-section'));
    expect(tokenUsage).toBeTruthy();
    expect(tokenUsage.nativeElement.textContent).toContain('Input: 10');
    expect(tokenUsage.nativeElement.textContent).toContain('Total: 35');

    const deferBlocks = await fixture.getDeferBlocks();
    expect(deferBlocks.length).toBeGreaterThanOrEqual(1);

    for (const block of deferBlocks) {
      await block.render(DeferBlockState.Complete);
    }
    fixture.detectChanges();

    const thoughtSummary = fixture.debugElement.query(By.css('app-thought-summary'));
    expect(thoughtSummary).toBeTruthy();

    const thoughtComponent = thoughtSummary.componentInstance as { thought: () => string };
    expect(thoughtComponent.thought()).toBe('Thinking...');
  });

  // TEST CASE 3: Only Token Usage (No Thought)
  it('should render token usage and not trigger thought summary when thought is undefined', async () => {
    component.analysis.set({
      parsed: {
        alternativeText: 'Sample image.',
        recommendations: [],
        tags: [],
        fact: 'Sample fact.',
      },
      thought: undefined,
      tokenUsage: { input: 5, output: 10, thought: 0, total: 15 },
      metadata: { citations: [], renderedContent: '', searchQueries: [] },
    } as unknown as ImageAnalysisResponse);
    fixture.detectChanges();

    const tokenUsage = fixture.debugElement.query(By.css('.usage-section'));
    expect(tokenUsage).toBeTruthy();
    expect(tokenUsage.nativeElement.textContent).toContain('Input: 5');

    const thoughtSummary = fixture.debugElement.query(By.css('app-thought-summary'));
    expect(thoughtSummary).toBeNull();
  });
});
