import { AuthService } from '@/core/auth/auth.service';
import { APP_LINKS } from '@/core/constants/routes.const';
import { HomeIconComponent } from '@/shared/ui/icons/home-icon.component';
import { SignOutIconComponent } from '@/shared/ui/icons/sign-out-icon.component';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [HomeIconComponent, RouterLink, SignOutIconComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  readonly homeLink = APP_LINKS.HOME;
  readonly #authService = inject(AuthService);
  readonly #router = inject(Router);
  readonly isAuthenticated = this.#authService.isAuthenticated;

  async onSignOut(): Promise<void> {
    await this.#authService.signOut();
    await this.#router.navigate([APP_LINKS.HOME]);
  }
}
