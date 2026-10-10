import { PhotoIconComponent } from '@/shared/ui/icons/photo-icon.component';
import { SpinnerIconComponent } from '@/shared/ui/icons/spinner-icon.component';
import { Component, input, output, signal } from '@angular/core';
import { ACCEPTED_IMAGE_TYPES } from './constants/photo-picker.const';
import { formatAcceptedFormats } from './utils/photo-picker.util';

const ACCEPTED_FORMATS_TEXT = formatAcceptedFormats(ACCEPTED_IMAGE_TYPES);

@Component({
  selector: 'app-photo-picker',
  imports: [PhotoIconComponent, SpinnerIconComponent],
  templateUrl: './photo-picker.component.html',
  styleUrl: './photo-picker.component.css',
})
export class PhotoPickerComponent {
  previewUrl = input<string | undefined>(undefined);
  isLoading = input(false);

  fileChange = output<File | undefined>();
  generate = output();
  invalidFile = output<string>();

  isDragActive = signal<boolean>(false);
  readonly accepted = ACCEPTED_IMAGE_TYPES.join(', ');

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.validateAndProcessFile(file);
    }
    input.value = '';
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
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      this.invalidFile.emit(`Invalid file type. Please select a ${ACCEPTED_FORMATS_TEXT} image.`);
      return;
    }

    this.fileChange.emit(file);
  }
}
