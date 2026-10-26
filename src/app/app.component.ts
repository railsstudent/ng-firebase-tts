import { FooterComponent } from '@/shared/ui/layout/footer/footer.component';
import { HeaderComponent } from '@/shared/ui/layout/header/header.component';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaUpdateBannerComponent } from './pwa/pwa-update-banner.component';
import { PwaUpdateService } from './pwa/pwa-update.service';

@Component({
  selector: 'app-root',
  imports: [PwaUpdateBannerComponent, HeaderComponent, FooterComponent, RouterOutlet],
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly #pwaService = inject(PwaUpdateService);
  readonly updateAvailable = this.#pwaService.updateAvailable;
}
