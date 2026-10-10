import { PhotoIconComponent } from '@/shared/ui/icons/photo-icon.component';
import { SpinnerIconComponent } from '@/shared/ui/icons/spinner-icon.component';
import { Component, computed, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-photo-picker',
  imports: [PhotoIconComponent, SpinnerIconComponent],
  templateUrl: './photo-picker.component.html',
  styleUrl: './photo-picker.component.css',
})
export class PhotoPickerComponent {
  previewUrl = input<string | undefined>(undefined);
  isLoading = input(false);
  acceptedFileTypes = input.required<string[]>();

  accepted = computed(() => this.acceptedFileTypes().join(', '));

  fileChange = output<File>();
  generate = output();
  removeFile = output();
  invalidFile = output<string>();

  isDragActive = signal<boolean>(false);

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.validateAndProcessFile(file);
    }
    input.value = '';
  }

  clearSelectedFile() {
    this.removeFile.emit();
  }

  handleDrag(event: DragEvent, isOver = true) {
    event.preventDefault();
    this.isDragActive.set(isOver);
  }

  onDrop(event: DragEvent) {
    this.handleDrag(event, false);

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
