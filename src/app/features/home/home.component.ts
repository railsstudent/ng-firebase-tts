import { APP_LINKS } from '@/app.routes';
import { ArrowRightIconComponent } from '@/shared/ui/icons/arrow-right-icon.component';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ArrowRightIconComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  readonly dashboard = APP_LINKS.DASHBOARD;

  readonly features = [
    { label: 'Model Pipeline', value: 'Gemini 3.8 Flash' },
    { label: 'Audio Synthesis', value: 'Gemini-TTS Streaming' },
    { label: 'Grounding', value: 'Google Search Tool' },
  ];
}
