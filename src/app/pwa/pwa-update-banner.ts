import { Component, inject } from '@angular/core';
import { PwaUpdateService } from './pwa-update.service';

@Component({
  selector: 'app-pwa-update-banner',
  template: `
    @if (updateAvailable()) {
      <div class="pwa-banner">
        <span class="pwa-text">A new version is available!</span>
        <button (click)="reloadApp()" class="pwa-button">Reload</button>
      </div>
    }
  `,
  styleUrl: './pwa-update-banner.css',
})
export class PwaUpdateBanner {
  readonly #pwaService = inject(PwaUpdateService);
  readonly updateAvailable = this.#pwaService.updateAvailable;

  async reloadApp() {
    await this.#pwaService.reloadPage();
  }
}
