import { IS_BROWSER, WINDOW } from '@/core/constants/navigator.const';
import { inject, Service } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { toSignal } from '@angular/core/rxjs-interop';
import { EMPTY } from 'rxjs';
import { filter, map } from 'rxjs/operators';

@Service()
export class PwaUpdateService {
  readonly #swUpdate = inject(SwUpdate);
  readonly #isBrowser = inject(IS_BROWSER);
  readonly #window = inject(WINDOW);

  // Checks both browser execution and active Service Worker state
  readonly updateAvailable = toSignal(
    this.#isBrowser && this.#swUpdate.isEnabled
      ? this.#swUpdate.versionUpdates.pipe(
          filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
          map(() => true),
        )
      : EMPTY,
    { initialValue: false },
  );

  reloadPage(): void {
    if (this.#isBrowser && this.#window) {
      this.#window.location.reload();
    }
  }
}
