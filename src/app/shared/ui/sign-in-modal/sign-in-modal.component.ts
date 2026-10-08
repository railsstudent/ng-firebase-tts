import { APP_LINKS } from '@/core/constants/routes.const';
import { AuthCredentials } from '@/core/interfaces/auth-credentials.interface';
import { AuthService } from '@/core/services/auth.service';
import { CloseIconComponent } from '@/shared/ui/icons/close-icon.component';
import { SpinnerIconComponent } from '@/shared/ui/icons/spinner-icon.component';
import { signInSchemaValidation } from '@/shared/ui/sign-in-modal/schemas/sign-in.schema';
import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { FieldTree, form, FormField, FormRoot } from '@angular/forms/signals';
import { Router } from '@angular/router';

@Component({
  imports: [FormField, FormRoot, CloseIconComponent, SpinnerIconComponent],
  selector: 'app-sign-in-modal',
  styleUrl: './sign-in-modal.component.css',
  templateUrl: './sign-in-modal.component.html',
})
export class SignInModalComponent {
  readonly #authService = inject(AuthService);
  readonly #dialogRef = inject(DialogRef, { optional: true });
  readonly #router = inject(Router);

  errorMessage = signal<string | undefined>(undefined);

  signInModel = signal<AuthCredentials>({
    email: '',
    password: '',
  });

  signInForm = form(this.signInModel, signInSchemaValidation(), {
    submission: {
      action: async (field) => this.signIn(field),
      onInvalid: (field) => {
        const firstError = field().errorSummary()[0];
        firstError?.fieldTree().focusBoundControl();
      },
    },
  });

  onClose(): void {
    this.#dialogRef?.close();
  }

  async signIn(field: FieldTree<AuthCredentials, string | number>) {
    try {
      this.errorMessage.set(undefined);
      const formValues = field().value();
      await this.#authService.signIn(formValues);
      if (this.#authService.isAuthenticated()) {
        this.#dialogRef?.close();
        await this.#router.navigate([APP_LINKS.DASHBOARD]);
        return undefined;
      }
      this.errorMessage.set('Failed to sign in. Please check your credentials and try again.');
      return { kind: 'serverError', message: 'Failed to submit form' };
    } catch {
      this.errorMessage.set('Failed to sign in. Please check your credentials and try again.');
      return { kind: 'serverError', message: 'Failed to submit form' };
    }
  }
}
