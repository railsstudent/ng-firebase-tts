import { ConfigService } from '@/core/services/config.service';
import { ImageAnalysisResponse, VisionService } from '@/core/vision';
import { AnalyzerPanelComponent } from '@/features/dashboard/components/analyzer-panel/analyzer-panel.component';
import { ComponentFixture, DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

const mockVisionService = {
  analyzeImage: vi.spyOn(VisionService.prototype, 'analyzeImage'),
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
    expect(mockVisionService.analyzeImage).not.toHaveBeenCalled();
  });

  // TEST CASE 1: Render child elements
  it('should render app-photo-picker and defer placeholder initially without loading VisionService', () => {
    const photoPicker = fixture.debugElement.query(By.css('app-photo-picker'));
    const altTextPanel = fixture.debugElement.query(By.css('app-alt-text-panel'));
    const emptyState = fixture.debugElement.query(By.css('.panel-container .empty-message'));

    expect(photoPicker).toBeTruthy();
    expect(altTextPanel).toBeNull();
    expect(emptyState).toBeTruthy();
    expect(emptyState.nativeElement.textContent).toContain('Upload an image and click "Generate" to see the results.');
    expect(fixture.nativeElement.textContent).toContain('Suggested Tags');
    expect(fixture.nativeElement.textContent).toContain('A surprising or obscure fact about the tags');
  });

  // TEST CASE 2: File Change - Valid File via Template Binding
  it('should register valid file, set previewUrl, and reset analysis/error signals when photo-picker emits fileChange', () => {
    const photoPicker = fixture.debugElement.query(By.css('app-photo-picker'));
    expect(photoPicker).toBeTruthy();

    const mockFile = new File(['image'], 'mars.png', { type: 'image/png' });
    component.error.set('Previous error');
    component.analysis.set({
      parsed: { alternativeText: 'old', recommendations: [], tags: [], fact: 'old' },
      thought: '',
      tokenUsage: { input: 0, output: 0, thought: 0, total: 0 },
      metadata: { citations: [], renderedContent: '', searchQueries: [] },
    });

    photoPicker.triggerEventHandler('fileChange', mockFile);
    fixture.detectChanges();

    expect(component.previewUrl()).toBeDefined();
    expect(component.error()).toBeUndefined();
    expect(component.analysis()).toBeUndefined();
  });

  // TEST CASE 3: Photo Picker Invalid File Event Binding
  it('should set error signal when photo-picker emits invalidFile event', () => {
    const photoPicker = fixture.debugElement.query(By.css('app-photo-picker'));
    expect(photoPicker).toBeTruthy();

    const errorMessage = 'Invalid file type. Please select a PNG, JPG, JPEG, or WEBP image.';
    photoPicker.triggerEventHandler('invalidFile', errorMessage);
    fixture.detectChanges();

    expect(component.error()).toBe(errorMessage);
  });

  // TEST CASE 4: File Change - Remove/Undefined File via Template Binding
  it('should clear registered file preview when photo-picker emits fileChange with undefined', () => {
    const photoPicker = fixture.debugElement.query(By.css('app-photo-picker'));
    expect(photoPicker).toBeTruthy();

    const mockFile = new File(['image'], 'mars.png', { type: 'image/png' });
    photoPicker.triggerEventHandler('fileChange', mockFile);
    fixture.detectChanges();
    expect(component.previewUrl()).toBeDefined();

    photoPicker.triggerEventHandler('fileChange', undefined);
    fixture.detectChanges();
    expect(component.previewUrl()).toBeUndefined();
    expect(component.error()).toBeUndefined();
    expect(component.analysis()).toBeUndefined();
  });

  // TEST CASE 5: Photo Picker Generate Event Binding
  it('should trigger handleGenerateClick when photo-picker emits generate event', () => {
    const photoPicker = fixture.debugElement.query(By.css('app-photo-picker'));
    expect(photoPicker).toBeTruthy();
    const handleGenerateSpy = vi.spyOn(component, 'handleGenerateClick').mockResolvedValue(undefined);

    photoPicker.triggerEventHandler('generate');

    expect(handleGenerateSpy).toHaveBeenCalledOnce();
  });

  // TEST CASE 6: Successful generate flow
  it('should dynamically load visionService and set analysis response on generate click success', async () => {
    const photoPicker = fixture.debugElement.query(By.css('app-photo-picker'));
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

    mockVisionService.analyzeImage.mockResolvedValue(mockResponse);
    photoPicker.triggerEventHandler('fileChange', mockFile);
    fixture.detectChanges();

    await component.handleGenerateClick();
    fixture.detectChanges();

    expect(mockVisionService.analyzeImage).toHaveBeenCalledWith(mockFile);
    expect(component.isLoading()).toBe(false);
    expect(component.analysis()).toEqual(mockResponse);
    expect(component.error()).toBeUndefined();
  });

  // TEST CASE 7: Failed generate flow
  it('should catch error and set error signal if visionService call throws', async () => {
    const photoPicker = fixture.debugElement.query(By.css('app-photo-picker'));
    const mockFile = new File(['image'], 'mars.png', { type: 'image/png' });
    mockVisionService.analyzeImage.mockRejectedValue(new Error('Vertex AI Quota Exceeded'));
    photoPicker.triggerEventHandler('fileChange', mockFile);
    fixture.detectChanges();

    await component.handleGenerateClick();
    fixture.detectChanges();

    expect(mockVisionService.analyzeImage).toHaveBeenCalledWith(mockFile);
    expect(component.isLoading()).toBe(false);
    expect(component.analysis()).toBeUndefined();
    expect(component.error()).toBe('Vertex AI Quota Exceeded');
  });

  // TEST CASE 8: Async Service Dynamic Resolution Error
  it('should catch and set error message if dynamic vision service fails to load', async () => {
    const photoPicker = fixture.debugElement.query(By.css('app-photo-picker'));
    const mockFile = new File(['image'], 'mars.png', { type: 'image/png' });
    mockVisionService.analyzeImage.mockRejectedValue(
      new TypeError('Failed to fetch dynamically imported VisionService'),
    );
    photoPicker.triggerEventHandler('fileChange', mockFile);
    fixture.detectChanges();

    await component.handleGenerateClick();
    fixture.detectChanges();

    expect(component.isLoading()).toBe(false);
    expect(component.analysis()).toBeUndefined();
    expect(component.error()).toContain('Failed to fetch dynamically imported VisionService');
  });

  // TEST CASE 9: Lazy Execution Verification
  it('should not invoke VisionService during component instantiation, but only on handleGenerateClick', async () => {
    expect(mockVisionService.analyzeImage).not.toHaveBeenCalled();

    const photoPicker = fixture.debugElement.query(By.css('app-photo-picker'));
    const mockFile = new File(['image'], 'mars.png', { type: 'image/png' });
    mockVisionService.analyzeImage.mockResolvedValue({
      parsed: { alternativeText: 'Alt', recommendations: [], tags: [], fact: 'Fact' },
      thought: '',
      tokenUsage: { input: 1, output: 1, thought: 0, total: 2 },
      metadata: { citations: [], renderedContent: '', searchQueries: [] },
    });
    photoPicker.triggerEventHandler('fileChange', mockFile);
    fixture.detectChanges();

    await component.handleGenerateClick();
    expect(mockVisionService.analyzeImage).toHaveBeenCalledOnce();
  });

  // TEST CASE 10: Undefined File Guard
  it('should return early without initiating generation if no file is registered', async () => {
    await component.handleGenerateClick();
    fixture.detectChanges();

    expect(mockVisionService.analyzeImage).not.toHaveBeenCalled();
    expect(component.isLoading()).toBe(false);
    expect(component.analysis()).toBeUndefined();
    expect(component.error()).toBeUndefined();
  });

  // TEST CASE 11: Non-Error Catch Fallback
  it('should fallback to generic error message if thrown value is not an instance of Error', async () => {
    const photoPicker = fixture.debugElement.query(By.css('app-photo-picker'));
    const mockFile = new File(['image'], 'mars.png', { type: 'image/png' });
    mockVisionService.analyzeImage.mockRejectedValue('String rejection error');
    photoPicker.triggerEventHandler('fileChange', mockFile);
    fixture.detectChanges();

    await component.handleGenerateClick();
    fixture.detectChanges();

    expect(component.isLoading()).toBe(false);
    expect(component.analysis()).toBeUndefined();
    expect(component.error()).toBe('An unknown error occurred.');
  });
});
