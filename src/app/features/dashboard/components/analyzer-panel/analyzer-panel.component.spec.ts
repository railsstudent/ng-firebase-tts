import { ImageAnalysisResponse } from '@/core/interfaces/image-analysis.interface';
import { ConfigService } from '@/core/services/config.service';
import { VisionService } from '@/core/services/vision.service';
import { AnalyzerPanelComponent } from '@/features/dashboard/components/analyzer-panel/analyzer-panel.component';
import { ComponentFixture, DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

const mockVisionService = {
  generateAltText: vi.spyOn(VisionService.prototype, 'generateAltText'),
};

describe('AnalyzerPanelComponent', () => {
  let component: AnalyzerPanelComponent;
  let fixture: ComponentFixture<AnalyzerPanelComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [AnalyzerPanelComponent],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            appConfig: {
              geminiModelName: 'gemini-2.5-flash',
              thinkingLevel: 'LOW',
            },
          },
        },
      ],
      deferBlockBehavior: DeferBlockBehavior.Playthrough,
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyzerPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and defer VisionService resolution', () => {
    expect(component).toBeTruthy();
    expect(mockVisionService.generateAltText).not.toHaveBeenCalled();
  });

  // TEST CASE 1: Render child elements
  it('should render app-photo-panel and defer placeholder initially without loading VisionService', () => {
    const photoPanel = fixture.debugElement.query(By.css('app-photo-panel'));
    const altTextPanel = fixture.debugElement.query(By.css('app-alt-text-panel'));
    const emptyState = fixture.debugElement.query(By.css('.empty-state'));

    expect(photoPanel).toBeTruthy();
    expect(altTextPanel).toBeNull();
    expect(emptyState).toBeTruthy();
    expect(emptyState.nativeElement.textContent).toContain('Upload an image and click "Generate" to see the results.');
  });

  // TEST CASE 2: Successful generate flow
  it('should dynamically load visionService and set analysis response on generate click success', async () => {
    const mockFile = new File(['image'], 'mars.png', { type: 'image/png' });
    const mockResponse: ImageAnalysisResponse = {
      parsed: {
        alternativeText: 'A landscape of Mars.',
        recommendations: [],
        tags: ['Mars', 'Landscape'],
        fact: 'Mars is red.',
      },
      thought: 'Thinking summary',
      tokenUsage: { input: 1, output: 2, thought: 3, total: 6 },
      metadata: { citations: [], renderedContent: '', searchQueries: [] },
    };

    mockVisionService.generateAltText.mockResolvedValue(mockResponse);

    await component.handleGenerateClick(mockFile);
    fixture.detectChanges();

    expect(mockVisionService.generateAltText).toHaveBeenCalledWith(mockFile);
    expect(component.isLoading()).toBe(false);
    expect(component.analysis()).toEqual(mockResponse);
    expect(component.error()).toBeUndefined();
  });

  // TEST CASE 3: Failed generate flow
  it('should catch error and set error signal if visionService call throws', async () => {
    const mockFile = new File(['image'], 'mars.png', { type: 'image/png' });
    mockVisionService.generateAltText.mockRejectedValue(new Error('Vertex AI Quota Exceeded'));

    await component.handleGenerateClick(mockFile);
    fixture.detectChanges();

    expect(mockVisionService.generateAltText).toHaveBeenCalledWith(mockFile);
    expect(component.isLoading()).toBe(false);
    expect(component.analysis()).toBeUndefined();
    expect(component.error()).toBe('Vertex AI Quota Exceeded');
  });

  // TEST CASE 4: Async Service Dynamic Resolution Error
  it('should catch and set error message if dynamic vision service fails to load', async () => {
    const mockFile = new File(['image'], 'mars.png', { type: 'image/png' });
    mockVisionService.generateAltText.mockRejectedValue(
      new TypeError('Failed to fetch dynamically imported VisionService'),
    );

    await component.handleGenerateClick(mockFile);
    fixture.detectChanges();

    expect(component.isLoading()).toBe(false);
    expect(component.analysis()).toBeUndefined();
    expect(component.error()).toContain('Failed to fetch dynamically imported VisionService');
  });

  // TEST CASE 5: Lazy Execution Verification
  it('should not invoke VisionService during component instantiation, but only on handleGenerateClick', async () => {
    expect(mockVisionService.generateAltText).not.toHaveBeenCalled();

    const mockFile = new File(['image'], 'mars.png', { type: 'image/png' });
    mockVisionService.generateAltText.mockResolvedValue({
      parsed: { alternativeText: 'Alt', recommendations: [], tags: [], fact: 'Fact' },
      thought: '',
      tokenUsage: { input: 1, output: 1, thought: 0, total: 2 },
      metadata: { citations: [], renderedContent: '', searchQueries: [] },
    });

    await component.handleGenerateClick(mockFile);
    expect(mockVisionService.generateAltText).toHaveBeenCalledOnce();
  });

  // TEST CASE 6: Dynamic Service Resolution on Demand
  it('should not construct or execute VisionService during component creation', () => {
    expect(mockVisionService.generateAltText).not.toHaveBeenCalled();
  });

  // TEST CASE 7: Undefined File Guard (Line 23)
  it('should return early without initiating generation if file is undefined', async () => {
    await component.handleGenerateClick(undefined);
    fixture.detectChanges();

    expect(mockVisionService.generateAltText).not.toHaveBeenCalled();
    expect(component.isLoading()).toBe(false);
    expect(component.analysis()).toBeUndefined();
    expect(component.error()).toBeUndefined();
  });

  // TEST CASE 8: Non-Error Catch Fallback (Line 38)
  it('should fallback to generic error message if thrown value is not an instance of Error', async () => {
    const mockFile = new File(['image'], 'mars.png', { type: 'image/png' });
    mockVisionService.generateAltText.mockRejectedValue('String rejection error');

    await component.handleGenerateClick(mockFile);
    fixture.detectChanges();

    expect(component.isLoading()).toBe(false);
    expect(component.analysis()).toBeUndefined();
    expect(component.error()).toBe('An unknown error occurred.');
  });
});
