import { ImageAnalysisResponse } from '@/core/interfaces/image-analysis.type';
import { ObscureFactComponent } from '@/features/dashboard/components/obscure-fact/obscure-fact.component';
import { PhotoUploadComponent } from '@/features/dashboard/components/photo-upload/photo-upload.component';
import { TagsDisplayComponent } from '@/features/dashboard/components/tags-display/tags-display.component';
import { Component, inject, input, model, output } from '@angular/core';
import { AssetRegistry } from './services/asset-registry.service';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

@Component({
  selector: 'app-photo-panel',
  imports: [PhotoUploadComponent, TagsDisplayComponent, ObscureFactComponent],
  providers: [AssetRegistry],
  templateUrl: './photo-panel.html',
})
export class PhotoPanel {
  readonly #assetRegistry = inject(AssetRegistry);

  isLoading = input(false);
  analysis = model<ImageAnalysisResponse | undefined>(undefined);
  error = model<string | undefined>(undefined);

  selectedFile = this.#assetRegistry.file;
  previewUrl = this.#assetRegistry.previewUrl;

  readonly acceptedTypes = ACCEPTED_IMAGE_TYPES;

  emitFile = output<File | undefined>();

  handleGenerateClick() {
    this.emitFile.emit(this.selectedFile());
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
