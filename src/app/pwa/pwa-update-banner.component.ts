import { Component, inject } from '@angular/core';
import { PwaUpdateService } from './pwa-update.service';

@Component({
  selector: 'app-pwa-update-banner',
  templateUrl: './pwa-update-banner.component.html',
  styleUrl: './pwa-update-banner.component.css',
})
export class PwaUpdateBannerComponent {
  readonly #pwaService = inject(PwaUpdateService);
  readonly updateAvailable = this.#pwaService.updateAvailable;

  async reloadApp(): Promise<void> {
    await this.#pwaService.reloadPage();
  }
}
