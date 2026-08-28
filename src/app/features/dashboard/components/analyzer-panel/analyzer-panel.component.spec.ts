import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnalyzerPanelComponent } from './analyzer-panel.component';
import { VisionService } from '@/core/services/vision.service';
import { ImageAnalysisResponse } from '@/core/interfaces/image-analysis.type';
import { By } from '@angular/platform-browser';

describe('AnalyzerPanelComponent', () => {
  let component: AnalyzerPanelComponent;
  let fixture: ComponentFixture<AnalyzerPanelComponent>;
  let mockVisionService: { generateAltText: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockVisionService = {
      generateAltText: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AnalyzerPanelComponent],
      providers: [{ provide: VisionService, useValue: mockVisionService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyzerPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // TEST CASE 1: Render child elements
  it('should render app-photo-panel and app-alt-text-panel side-by-side', () => {
    const photoPanel = fixture.debugElement.query(By.css('app-photo-panel'));
    const altTextPanel = fixture.debugElement.query(By.css('app-alt-text-panel'));

    expect(photoPanel).toBeTruthy();
    expect(altTextPanel).toBeTruthy();
  });

  // TEST CASE 2: Successful generate flow
  it('should call visionService and set analysis response on generate click success', async () => {
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
});
