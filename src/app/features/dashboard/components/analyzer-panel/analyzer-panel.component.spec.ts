import { VISION_AI_MODEL } from '@/core/constants/firebase.constant';
import { ImageAnalysisResponse } from '@/core/interfaces/image-analysis.interface';
import { VisionService } from '@/core/services/vision.service';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GenerativeModel } from 'firebase/ai';
import { AnalyzerPanelComponent } from './analyzer-panel.component';

const mockGenerativeModel: Partial<GenerativeModel> = {
  model: 'gemini-2.5-flash',
  generateContent: vi.fn(),
  generateContentStream: vi.fn(),
  countTokens: vi.fn(),
};

const aiModelFactory = vi.fn().mockReturnValue(mockGenerativeModel as GenerativeModel);

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
      providers: [{ provide: VISION_AI_MODEL, useFactory: aiModelFactory }],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyzerPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and defer VisionService resolution', () => {
    expect(component).toBeTruthy();
    expect(aiModelFactory).not.toHaveBeenCalled();
  });

  // TEST CASE 1: Render child elements
  it('should render app-photo-panel and app-alt-text-panel side-by-side without loading VisionService', () => {
    expect(aiModelFactory).not.toHaveBeenCalled();

    const photoPanel = fixture.debugElement.query(By.css('app-photo-panel'));
    const altTextPanel = fixture.debugElement.query(By.css('app-alt-text-panel'));

    expect(photoPanel).toBeTruthy();
    expect(altTextPanel).toBeTruthy();
  });

  // TEST CASE 2: Successful generate flow
  it('should dynamically load visionService and set analysis response on generate click success', async () => {
    expect(aiModelFactory).not.toHaveBeenCalled();

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

    expect(aiModelFactory).toHaveBeenCalledOnce();
    expect(mockVisionService.generateAltText).toHaveBeenCalledWith(mockFile);
    expect(component.isLoading()).toBe(false);
    expect(component.analysis()).toEqual(mockResponse);
    expect(component.error()).toBeUndefined();
  });

  // TEST CASE 3: Failed generate flow
  it('should catch error and set error signal if visionService call throws', async () => {
    expect(aiModelFactory).not.toHaveBeenCalled();

    const mockFile = new File(['image'], 'mars.png', { type: 'image/png' });
    mockVisionService.generateAltText.mockRejectedValue(new Error('Vertex AI Quota Exceeded'));

    await component.handleGenerateClick(mockFile);
    fixture.detectChanges();

    expect(aiModelFactory).toHaveBeenCalledOnce();
    expect(mockVisionService.generateAltText).toHaveBeenCalledWith(mockFile);
    expect(component.isLoading()).toBe(false);
    expect(component.analysis()).toBeUndefined();
    expect(component.error()).toBe('Vertex AI Quota Exceeded');
  });

  // TEST CASE 4: Async Service Dynamic Resolution Error
  it('should catch and set error message if dynamic vision service fails to load', async () => {
    expect(aiModelFactory).not.toHaveBeenCalled();

    const mockFile = new File(['image'], 'mars.png', { type: 'image/png' });
    mockVisionService.generateAltText.mockRejectedValue(
      new TypeError('Failed to fetch dynamically imported VisionService'),
    );

    await component.handleGenerateClick(mockFile);
    fixture.detectChanges();

    expect(aiModelFactory).toHaveBeenCalledOnce();
    expect(component.isLoading()).toBe(false);
    expect(component.analysis()).toBeUndefined();
    expect(component.error()).toContain('Failed to fetch dynamically imported VisionService');
  });

  // TEST CASE 5: Lazy Execution Verification
  it('should not invoke VisionService during component instantiation, but only on handleGenerateClick', async () => {
    expect(aiModelFactory).not.toHaveBeenCalled();
    expect(mockVisionService.generateAltText).not.toHaveBeenCalled();

    const mockFile = new File(['image'], 'mars.png', { type: 'image/png' });
    mockVisionService.generateAltText.mockResolvedValue({
      parsed: { alternativeText: 'Alt', recommendations: [], tags: [], fact: 'Fact' },
      thought: '',
      tokenUsage: { input: 1, output: 1, thought: 0, total: 2 },
      metadata: { citations: [], renderedContent: '', searchQueries: [] },
    });

    await component.handleGenerateClick(mockFile);
    expect(aiModelFactory).toHaveBeenCalledOnce();
    expect(mockVisionService.generateAltText).toHaveBeenCalledOnce();
  });

  // TEST CASE 6: Dynamic Service Resolution on Demand (must fail with synchronous inject)
  it('should not construct VisionService or request VISION_AI_MODEL during component creation', () => {
    expect(aiModelFactory).not.toHaveBeenCalled();
  });
});
