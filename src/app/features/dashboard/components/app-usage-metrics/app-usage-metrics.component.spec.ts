import { ImageOptimizationMetrics, TokenUsage } from '@/core/vision';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppUsageMetricsComponent } from './app-usage-metrics.component';

describe('AppUsageMetricsComponent', () => {
  let component: AppUsageMetricsComponent;
  let fixture: ComponentFixture<AppUsageMetricsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppUsageMetricsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AppUsageMetricsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render token usage metrics when tokenUsage is provided', async () => {
    const mockTokenUsage: TokenUsage = {
      input: 412,
      output: 168,
      thought: 84,
      total: 664,
    };

    fixture.componentRef.setInput('tokenUsage', mockTokenUsage);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Text Generation Token Usage');
    expect(compiled.textContent).toContain('Input: 412');
    expect(compiled.textContent).toContain('Output: 168');
    expect(compiled.textContent).toContain('Thought: 84');
    expect(compiled.textContent).toContain('Total: 664');
  });

  it('should render image optimization efficiency metrics when optimizationMetrics is provided', async () => {
    const mockMetrics: ImageOptimizationMetrics = {
      originalSizeBytes: 4.8 * 1024 * 1024,
      optimizedSizeBytes: 56 * 1024,
      originalDimensions: { width: 4032, height: 3024 },
      optimizedDimensions: { width: 768, height: 576 },
      estimatedOriginalTokens: 6192,
      actualImageTokens: 258,
      tokensSaved: 5934,
      bytesSavedPercent: 98.8,
    };

    fixture.componentRef.setInput('optimizationMetrics', mockMetrics);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Image Optimization Efficiency');
    expect(compiled.textContent).toContain('Original Size: 4.8 MB');
    expect(compiled.textContent).toContain('Optimized Size: 56 KB');
    expect(compiled.textContent).toContain('Payload Saved: 98.8%');
    expect(compiled.textContent).toContain('Tokens Saved: ~5,934');
  });

  it('should not render image optimization card when optimizationMetrics is undefined', async () => {
    const mockTokenUsage: TokenUsage = {
      input: 100,
      output: 50,
      thought: 20,
      total: 170,
    };

    fixture.componentRef.setInput('tokenUsage', mockTokenUsage);
    fixture.componentRef.setInput('optimizationMetrics', undefined);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Text Generation Token Usage');
    expect(compiled.textContent).not.toContain('Image Optimization Efficiency');
    expect(component.formattedMetrics()).toEqual({
      originalSize: '0 B',
      optimizedSize: '0 B',
      payloadSaved: '0%',
      tokensSaved: '0',
    });
  });
});
