import { APP_LINKS } from '@/app.routes';
import { HomeIconComponent } from '@/shared/ui/icons/home-icon.component';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [HomeIconComponent, RouterLink],
  template: `
    <header class="app-header">
      <a [routerLink]="homeLink" class="header-home-btn" aria-label="Go to Home Screen">
        <app-home-icon />
      </a>
      <h1 class="header-title">Firebase AI Logic Obscure Fact Speech Generator</h1>
    </header>
  `,
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  readonly homeLink = APP_LINKS.HOME;
}
