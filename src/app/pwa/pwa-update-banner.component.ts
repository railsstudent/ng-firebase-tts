import { Component, inject } from '@angular/core';
import { PwaUpdateService } from './pwa-update.service';

@Component({
  selector: 'app-pwa-update-banner',
  template: `
    @if (updateAvailable()) {
      <div class="pwa-banner shadow-2xl rounded-lg">
        <span class="text-sm font-medium">A new version is available!</span>
        <button (click)="reloadApp()" class="pwa-button text-sm font-semibold">Reload</button>
      </div>
    }
  `,
  styleUrl: './pwa-update-banner.component.css',
})
export class PwaUpdateBannerComponent {
  readonly #pwaService = inject(PwaUpdateService);
  readonly updateAvailable = this.#pwaService.updateAvailable;

  async reloadApp(): Promise<void> {
    await this.#pwaService.reloadPage();
  }
}
