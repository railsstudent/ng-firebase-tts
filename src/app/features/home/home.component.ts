import { APP_LINKS } from '@/core/constants/routes.const';
import { AuthService } from '@/core/services/auth.service';
import { ArrowRightIconComponent } from '@/shared/ui/icons/arrow-right-icon.component';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ArrowRightIconComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  readonly dashboard = APP_LINKS.DASHBOARD;
  readonly #authService = inject(AuthService);
  readonly isAuthenticated = this.#authService.isAuthenticated;

  readonly features = [
    { label: 'Model Pipeline', value: 'Gemini 3.8 Flash' },
    { label: 'Audio Synthesis', value: 'Gemini-TTS Streaming' },
    { label: 'Grounding', value: 'Google Search Tool' },
  ];
}
