import { revokeBlobURL } from '@/core/utils/blob.util';
import { DestroyRef, inject, Injectable, linkedSignal, signal } from '@angular/core';

@Injectable()
export class AssetRegistry {
  readonly #destroyRef = inject(DestroyRef);

  readonly #file = signal<File | undefined>(undefined);
  readonly file = this.#file.asReadonly();

  readonly previewUrl = linkedSignal<File | undefined, string | undefined>({
    source: this.#file,
    computation: (currentFile, previous) => {
      if (previous?.value) {
        revokeBlobURL(previous.value);
      }
      return currentFile ? URL.createObjectURL(currentFile) : undefined;
    },
  });

  constructor() {
    this.#destroyRef.onDestroy(() => {
      const finalUrl = this.previewUrl();
      if (finalUrl) {
        revokeBlobURL(finalUrl);
      }
    });
  }

  register(file: File | undefined): void {
    this.#file.set(file);
  }
}
