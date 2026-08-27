import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaUpdateBanner } from './pwa-update-banner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PwaUpdateBanner],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly title = signal('ng-firebase-tts v3');
}
