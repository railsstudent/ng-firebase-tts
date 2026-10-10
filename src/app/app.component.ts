import { FooterComponent } from '@/shared/ui/layout/footer/footer.component';
import { HeaderComponent } from '@/shared/ui/layout/header/header.component';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaUpdateBanner, PwaUpdateService } from './pwa';

@Component({
  selector: 'app-root',
  imports: [PwaUpdateBanner, HeaderComponent, FooterComponent, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly #pwaService = inject(PwaUpdateService);
  readonly updateAvailable = this.#pwaService.updateAvailable;
}
