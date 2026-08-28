import { PhotoIconComponent } from '@/shared/ui/icons/photo-icon.component';
import { SpinnerIconComponent } from '@/shared/ui/icons/spinner-icon.component';
import { Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';

@Component({
  selector: 'app-photo-upload',
  imports: [PhotoIconComponent, SpinnerIconComponent],
  templateUrl: './photo-upload.component.html',
  styleUrl: './photo-upload.component.css',
})
export class PhotoUploadComponent {
  previewUrl = input<string | undefined>(undefined);
  isLoading = input(false);
  acceptedFileTypes = input.required<string[]>();

  accepted = computed(() => this.acceptedFileTypes().join(', '));

  fileChange = output<File>();
  generate = output();
  removeFile = output();
  invalidFile = output<string>();

  isDragActive = signal<boolean>(false);

  fileInputRef = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  fileInputElement = computed(() => this.fileInputRef().nativeElement);

  onFileChange() {
    const file = this.fileInputElement().files?.[0];
    if (file) {
      this.validateAndProcessFile(file);
    }
  }

  triggerFileSelect() {
    this.fileInputElement().click();
  }

  clearSelectedFile() {
    this.removeFile.emit();
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragActive.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragActive.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragActive.set(false);

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) {
      return;
    }

    if (files.length > 1) {
      this.invalidFile.emit('Please upload only a single image file.');
      return;
    }

    const file = files[0];
    this.validateAndProcessFile(file);
  }

  private validateAndProcessFile(file: File) {
    if (!this.acceptedFileTypes().includes(file.type)) {
      this.invalidFile.emit('Invalid file type. Please select a JPG, JPEG, or PNG image.');
      return;
    }

    this.fileChange.emit(file);
  }
}
