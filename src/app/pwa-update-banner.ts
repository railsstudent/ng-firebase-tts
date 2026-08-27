import { PwaUpdateService } from '@/core/services/pwa-update.service';
import { Component, inject } from '@angular/core';

@Component({
  selector: 'app-pwa-update-banner',
  template: `
    @if (pwaUpdateService.updateAvailable()) {
      <div class="pwa-banner">
        <span class="pwa-text">A new version is available!</span>
        <button (click)="pwaUpdateService.reloadPage()" class="pwa-button">Reload</button>
      </div>
    }
  `,
  styleUrl: './pwa-update-banner.css',
})
export class PwaUpdateBanner {
  readonly pwaUpdateService = inject(PwaUpdateService);
}
