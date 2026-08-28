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
        URL.revokeObjectURL(previous.value);
      }
      return currentFile ? URL.createObjectURL(currentFile) : undefined;
    },
  });

  constructor() {
    this.#destroyRef.onDestroy(() => {
      const finalUrl = this.previewUrl();
      if (finalUrl) {
        URL.revokeObjectURL(finalUrl);
      }
    });
  }

  register(file: File | undefined): void {
    this.#file.set(file);
  }
}
