import { ImageAnalysisResponse } from '@/core/interfaces/image-analysis.type';
import { revokeBlobURL } from '@/core/utils/blob.util';
import { PhotoUploadComponent } from '@/features/dashboard/components/photo-upload/photo-upload.component';
import { TagsDisplayComponent } from '@/features/dashboard/components/tags-display/tags-display.component';
import { Component, computed, input, model, OnDestroy, output, signal } from '@angular/core';
import { ObscureFactComponent } from '@/features/dashboard/components/obscure-fact/obscure-fact.component';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

@Component({
  selector: 'app-photo-panel',
  imports: [PhotoUploadComponent, TagsDisplayComponent, ObscureFactComponent],
  templateUrl: './photo-panel.html',
})
export class PhotoPanel implements OnDestroy {
  isLoading = input(false);
  analysis = model<ImageAnalysisResponse | undefined>(undefined);
  error = model<string | undefined>(undefined);

  selectedFile = signal<File | undefined>(undefined);

  readonly acceptedTypes = ACCEPTED_IMAGE_TYPES;

  previewUrl = computed(() => {
    const file = this.selectedFile();
    if (file) {
      return URL.createObjectURL(file);
    }

    return undefined;
  });

  emitFile = output<File | undefined>();

  handleGenerateClick() {
    this.emitFile.emit(this.selectedFile());
  }

  handleFileChange(file: File | undefined) {
    if (file && !this.acceptedTypes.includes(file.type)) {
      this.error.set('Invalid file type. Please select a JPG, JPEG, or PNG image.');
      return;
    }

    // Revoke the old URL to prevent memory leaks
    revokeBlobURL(this.previewUrl());

    this.selectedFile.set(file);
    this.analysis.set(undefined);
    this.error.set(undefined);
  }

  ngOnDestroy() {
    revokeBlobURL(this.previewUrl());
  }
}
