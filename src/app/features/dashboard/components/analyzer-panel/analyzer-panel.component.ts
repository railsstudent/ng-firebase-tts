import { ImageAnalysisResponse } from '@/core/vision';
import { AltTextPanel } from '@/features/dashboard/components/alt-text-panel/alt-text-panel';
import { AssetRegistry } from '@/features/dashboard/components/analyzer-panel/services/asset-registry.service';
import { ObscureFactComponent } from '@/features/dashboard/components/obscure-fact/obscure-fact.component';
import { PhotoPickerComponent } from '@/features/dashboard/components/photo-picker/photo-picker.component';
import { TagsDisplayComponent } from '@/features/dashboard/components/tags-display/tags-display.component';
import { Component, inject, injectAsync, model, signal } from '@angular/core';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

@Component({
  selector: 'app-analyzer-panel',
  imports: [PhotoPickerComponent, TagsDisplayComponent, ObscureFactComponent, AltTextPanel],
  templateUrl: './analyzer-panel.component.html',
  styleUrl: './analyzer-panel.component.css',
  providers: [AssetRegistry],
})
export class AnalyzerPanelComponent {
  readonly #assetRegistry = inject(AssetRegistry);
  #asyncVisionService = injectAsync(() => import('@/core/vision').then((m) => m.VisionService));

  analysis = model<ImageAnalysisResponse | undefined>(undefined);
  error = signal<string | undefined>(undefined);
  isLoading = signal(false);

  previewUrl = this.#assetRegistry.previewUrl.asReadonly();

  readonly acceptedTypes = ACCEPTED_IMAGE_TYPES;

  async handleGenerateClick() {
    const file = this.#assetRegistry.file();

    if (!file) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(undefined);
    this.analysis.set(undefined);

    try {
      const service = await this.#asyncVisionService();
      const results = await service.analyzeImage(file);
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

  handleFileChange(file: File | undefined) {
    if (file && !this.acceptedTypes.includes(file.type)) {
      this.error.set('Invalid file type. Please select a JPG, JPEG, or PNG image.');
      return;
    }

    this.#assetRegistry.register(file);
    this.analysis.set(undefined);
    this.error.set(undefined);
  }
}
