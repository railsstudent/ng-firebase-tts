import { WINDOW } from '@/core/constants/navigator.const';
import { inject, Service } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { EMPTY } from 'rxjs';
import { filter, map } from 'rxjs/operators';

@Service()
export class PwaUpdateService {
  readonly #swUpdate = inject(SwUpdate);
  readonly #window = inject(WINDOW);

  // Checks both browser execution and active Service Worker state
  readonly updateAvailable = toSignal(
    this.#window && this.#swUpdate.isEnabled
      ? this.#swUpdate.versionUpdates.pipe(
          filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
          map(() => true),
        )
      : EMPTY,
    { initialValue: false },
  );

  async reloadPage(): Promise<void> {
    if (this.#window) {
      if (this.#swUpdate.isEnabled) {
        try {
          await this.#swUpdate.activateUpdate();
        } catch (error) {
          console.error('Failed to activate service worker update:', error);
        }
      }
      this.#window.location.reload();
    }
  }
}
