import { ImageAnalysisResponse } from '@/core/interfaces/image-analysis.interface';
import { AltTextPanel } from '@/features/dashboard/components/alt-text-panel/alt-text-panel';
import { PhotoPanel } from '@/features/dashboard/components/photo-panel/photo-panel';
import { Component, injectAsync, model, signal } from '@angular/core';

@Component({
  selector: 'app-analyzer-panel',
  imports: [PhotoPanel, AltTextPanel],
  templateUrl: './analyzer-panel.component.html',
  styleUrl: './analyzer-panel.component.css',
})
export class AnalyzerPanelComponent {
  private readonly asyncVisionService = injectAsync(() =>
    import('@/core/services/vision.service').then((m) => m.VisionService),
  );

  analysis = model<ImageAnalysisResponse | undefined>(undefined);
  error = signal<string | undefined>(undefined);
  isLoading = signal(false);

  async handleGenerateClick(file: File | undefined) {
    if (!file) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(undefined);
    this.analysis.set(undefined);

    try {
      const service = await this.asyncVisionService();
      const results = await service.generateAltText(file);
      this.analysis.set(results);
    } catch (e: unknown) {
      if (e instanceof Error) {
        this.error.set(e.message);
      } else {
        this.error.set('An unknown error occurred.');
      }
    } finally {
      this.isLoading.set(false);
    }
  }
}
