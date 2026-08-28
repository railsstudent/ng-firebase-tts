import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaUpdateBanner } from './pwa-update-banner';
import { FooterComponent } from './shared/ui/layout/footer/footer.component';
import { HeaderComponent } from './shared/ui/layout/header/header.component';

@Component({
  selector: 'app-root',
  imports: [PwaUpdateBanner, HeaderComponent, FooterComponent, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly title = signal('ng-firebase-tts v3');
}
