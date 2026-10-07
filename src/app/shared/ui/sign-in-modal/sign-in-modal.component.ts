import { APP_LINKS } from '@/core/constants/routes.const';
import { AuthCredentials } from '@/core/interfaces/auth-credentials.interface';
import { AuthService } from '@/core/services/auth.service';
import { Component, inject, signal } from '@angular/core';
import { email, form, FormField, FormRoot, minLength, required } from '@angular/forms/signals';
import { Router } from '@angular/router';

@Component({
  imports: [FormField, FormRoot],
  selector: 'app-sign-in-modal',
  styleUrl: './sign-in-modal.component.css',
  templateUrl: './sign-in-modal.component.html',
})
export class SignInModalComponent {
  readonly #authService = inject(AuthService);
  readonly #router = inject(Router);

  errorMessage = signal<string | undefined>(undefined);

  signInModel = signal<AuthCredentials>({
    email: '',
    password: '',
  });

  signInForm = form(
    this.signInModel,
    (schemaPath) => {
      required(schemaPath.email, { message: 'Email is required' });
      email(schemaPath.email, { message: 'Invalid email format' });
      required(schemaPath.password, { message: 'Password is required' });
      const passwordLen = 8;
      minLength(schemaPath.password, passwordLen, {
        message: `Password must be at least ${passwordLen} characters long`,
      });
    },
    {
      submission: {
        action: async (field) => {
          try {
            const formValues = field().value();
            console.log('Sign-in form submitted with model:', formValues);
            const isAuthenticated = await this.#authService.signIn(formValues);
            if (isAuthenticated) {
              // close the modal and navigate to the dashboard
              await this.#router.navigate([APP_LINKS.DASHBOARD]);
            } else {
              // handle authentication failure (e.g., show an error message)
              return { kind: 'serverError', message: 'Failed to submit form' };
            }
          } catch {
            this.errorMessage.set('Failed to submit form. Please try again.');
          }

          // Here you would typically call your AuthService to handle sign-in
        },
      },
    },
  );
}
