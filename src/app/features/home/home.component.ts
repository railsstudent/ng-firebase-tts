import { APP_LINKS } from '@/core/constants/routes.const';
import { AuthService } from '@/core/services/auth.service';
import { ArrowRightIconComponent } from '@/shared/ui/icons/arrow-right-icon.component';
import type { SignInModalComponent } from '@/shared/ui/sign-in-modal/sign-in-modal.component';
import type { DialogRef } from '@angular/cdk/dialog';
import { Component, inject, Injector, runInInjectionContext } from '@angular/core';
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
  readonly #injector = inject(Injector);
  #dialogRef: DialogRef<unknown, SignInModalComponent> | null = null;
  #isOpeningModal = false;

  readonly features = [
    { label: 'Model Pipeline', value: 'Gemini 3.8 Flash' },
    { label: 'Audio Synthesis', value: 'Gemini-TTS Streaming' },
    { label: 'Grounding', value: 'Google Search Tool' },
  ];

  async openSignInModal(): Promise<void> {
    if (this.#isOpeningModal || this.#dialogRef) {
      return;
    }

    this.#isOpeningModal = true;
    try {
      const [{ SignInModalComponent }, { Dialog }] = await Promise.all([
        import('@/shared/ui/sign-in-modal/sign-in-modal.component'),
        import('@angular/cdk/dialog'),
      ]);
      runInInjectionContext(this.#injector, () => {
        const dialog = inject(Dialog);
        const dialogRef = dialog.open(SignInModalComponent, {
          backdropClass: ['backdrop-blur-sm', 'bg-black/40'],
        });

        this.#dialogRef = dialogRef;
        dialogRef.closed.subscribe(() => {
          this.#dialogRef = null;
        });
      });
    } finally {
      this.#isOpeningModal = false;
    }
  }
}
