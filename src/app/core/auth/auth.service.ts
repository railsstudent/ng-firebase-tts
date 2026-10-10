import { AuthCredentials } from './auth-credentials.interface';
import { WINDOW } from '@/core/constants/navigator.const';
import { ConfigService } from '@/core/services/config.service';
import { isLocalhost } from '@/core/utils/host.util';
import { computed, DestroyRef, inject, Service, signal } from '@angular/core';
import type { Auth, User } from 'firebase/auth';

const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';

@Service()
export class AuthService {
  readonly #window = inject(WINDOW);
  readonly #configService = inject(ConfigService);
  readonly #destroyRef$ = inject(DestroyRef);

  readonly #user = signal<User | null>(null);
  user = this.#user.asReadonly();
  isAuthenticated = computed(() => !!this.#user());

  #auth: Auth | null = null;
  #authSdk: typeof import('firebase/auth') | null = null;
  #authReady: Promise<void> | null = null;

  private async loadAuth() {
    const [firebaseApp, authSdk] = await Promise.all([this.#configService.getApp(), import('firebase/auth')]);

    const auth = authSdk.getAuth(firebaseApp);
    if (isLocalhost(this.#window)) {
      authSdk.connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });
    }

    await authSdk.setPersistence(auth, authSdk.browserSessionPersistence);
    const unsubscribe = authSdk.onAuthStateChanged(auth, (user) => this.#user.set(user));

    this.#destroyRef$.onDestroy(unsubscribe);

    await auth.authStateReady();

    this.#auth = auth;
    this.#authSdk = authSdk;
  }

  async ensureAuth() {
    if (!this.#authReady) {
      this.#authReady = this.loadAuth();
    }

    await this.#authReady;

    if (!this.#auth) {
      throw new Error('Auth is not initialized');
    }

    if (!this.#authSdk) {
      throw new Error('Auth SDK does not exist');
    }

    return { auth: this.#auth, sdk: this.#authSdk };
  }

  async signIn({ email, password }: AuthCredentials) {
    if (!email || !password) {
      this.#user.set(null);
      return;
    }

    const { auth, sdk } = await this.ensureAuth();
    await sdk.signInWithEmailAndPassword(auth, email, password);
  }

  async signOut() {
    const { auth, sdk } = await this.ensureAuth();
    await sdk.signOut(auth);
  }
}
