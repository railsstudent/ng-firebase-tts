import { WINDOW } from '@/core/constants/navigator.const';
import { PWA_CHECK_INTERVAL } from '@/core/constants/pwa.constant';
import { ApplicationRef, DestroyRef, inject, Service } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { concat, EMPTY, from, interval } from 'rxjs';
import { catchError, exhaustMap, filter, map, take } from 'rxjs/operators';

@Service()
export class PwaUpdateService {
  readonly #swUpdate = inject(SwUpdate);
  readonly #window = inject(WINDOW);
  readonly #destroyRef$ = inject(DestroyRef);
  readonly #pwaCheckInterval = inject(PWA_CHECK_INTERVAL);
  readonly #appRef = inject(ApplicationRef);

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

  constructor() {
    if (this.#window && this.#swUpdate.isEnabled) {
      this.#swUpdate.unrecoverable
        .pipe(takeUntilDestroyed(this.#destroyRef$))
        .subscribe(() => this.#window?.location.reload());

      const isAppStable$ = this.#appRef.isStable.pipe(
        filter((isStable) => isStable),
        take(1),
      );
      const polling$ = interval(this.#pwaCheckInterval);

      concat(isAppStable$, polling$)
        .pipe(
          exhaustMap(() =>
            from(this.#swUpdate.checkForUpdate()).pipe(
              catchError((e) => {
                console.error(e);
                return EMPTY;
              }),
            ),
          ),
          takeUntilDestroyed(this.#destroyRef$),
        )
        .subscribe();
    }
  }

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
