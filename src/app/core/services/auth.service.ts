import { WINDOW } from '@/core/constants/navigator.const';
import { AuthCredentials } from '@/core/interfaces/auth-credentials.interface';
import { ConfigService } from '@/core/services/config.service';
import { isLocalhost } from '@/core/utils/host.util';
import { computed, DestroyRef, inject, Service, signal } from '@angular/core';
import { connectAuthEmulator, type Auth, type User } from 'firebase/auth';

const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';

@Service()
export class AuthService {
  #window = inject(WINDOW);
  #configService = inject(ConfigService);
  #destroyRef$ = inject(DestroyRef);

  #user = signal<User | null>(null);
  user = this.#user.asReadonly();
  isAuthenticated = computed(() => !!this.#user());

  #auth: Auth | null = null;
  #authSdk: typeof import('firebase/auth') | null = null;
  #authReady: Promise<void> | null = null;

  private async loadAuth() {
    const [firebaseApp, authSdk] = await Promise.all([this.#configService.getApp(), import('firebase/auth')]);

    const auth = authSdk.getAuth(firebaseApp);
    if (isLocalhost(this.#window)) {
      connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });
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
    // Simulate authentication logic (replace with real authentication)
    if (email && password) {
      const { auth, sdk } = await this.ensureAuth();
      const { user } = await sdk.signInWithEmailAndPassword(auth, email, password);
      this.#user.set(user); // Set the user email as the authenticated user
    } else {
      this.#user.set(null);
    }
  }

  async signOut() {
    try {
      const { auth, sdk } = await this.ensureAuth();
      await sdk.signOut(auth);
    } finally {
      this.#user.set(null);
    }
  }
}
