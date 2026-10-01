import { WINDOW } from '@/core/constants/navigator.const';
import { AppRemoteConfig } from '@/core/interfaces/app-remote-config.interface';
import firebaseConfig from '@/public/firebase.config.json';
import remoteConfigDefaults from '@/public/remote-config-defaults.json';
import { inject, isDevMode, Service } from '@angular/core';
import type { AI, ThinkingLevel } from 'firebase/ai';
import type { FirebaseApp } from 'firebase/app';

const SECONDS = 60;
const MILLISECONDS = 1000;
const ONE_HOUR_IN_MILLISECONDS = SECONDS * SECONDS * MILLISECONDS;
const DEV_TIMEOUT = 1000;
const PROD_TIMEOUT = 2000;
const LOCAL_DOMAINS = ['localhost', '127.0.0.1', '::1', '[::1]'];

@Service()
export class ConfigService {
  readonly #window = inject(WINDOW);
  #app: FirebaseApp | undefined = undefined;
  #ai: AI | null = null;
  #appReady: Promise<void> | null = null;
  #appCheck: Promise<void> | null = null;

  #appConfig: AppRemoteConfig = {
    useLimitedUseAppCheckTokens: remoteConfigDefaults.useLimitedUseAppCheckTokens === 'true',
    vertexAILocation: remoteConfigDefaults.vertexAILocation,
    geminiModelName: remoteConfigDefaults.geminiModelName,
    geminiTTSModelName: remoteConfigDefaults.geminiTTSModelName,
    thinkingLevel: remoteConfigDefaults.thinkingLevel as ThinkingLevel,
  };

  get appConfig(): AppRemoteConfig {
    return this.#appConfig;
  }

  #isOnline(): boolean {
    return this.#window?.navigator?.onLine ?? true;
  }

  #isLocalhost(): boolean {
    return !!this.#window && LOCAL_DOMAINS.includes(this.#window.location.hostname);
  }

  #configureAppCheckDebugToken(isLocalhost: boolean): void {
    (globalThis as Record<string, unknown>)['FIREBASE_APPCHECK_DEBUG_TOKEN'] = isLocalhost
      ? firebaseConfig.appCheckDebugToken || true
      : false;
  }

  private loadAppCheck(isLocalhost: boolean, key: string): Promise<void> {
    const appCheck = import('firebase/app-check');
    return appCheck.then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => {
      this.#configureAppCheckDebugToken(isLocalhost);
      initializeAppCheck(this.#app, {
        provider: new ReCaptchaEnterpriseProvider(key),
        isTokenAutoRefreshEnabled: true,
      });
    });
  }

  private ensureAppCheck(isLocalhost: boolean): Promise<void> {
    if (!this.#appCheck) {
      this.#appCheck = this.loadAppCheck(isLocalhost, firebaseConfig.recaptchaEnterpriseKey);
    }
    return this.#appCheck;
  }

  async getAiBackend(): Promise<AI> {
    if (this.#ai) {
      return this.#ai;
    }

    /* initialized the firebase app and fetch remote config in the background once */
    if (this.#appReady) {
      await this.#appReady;
    }

    if (!this.#app) {
      throw new Error('Firebase App has not been initialized yet.');
    }

    if (this.#isOnline() && firebaseConfig.recaptchaEnterpriseKey) {
      await this.ensureAppCheck(this.#isLocalhost());
    }

    const { getAI, AgentPlatformBackend } = await import('firebase/ai');
    this.#ai = getAI(this.#app, {
      backend: new AgentPlatformBackend(this.#appConfig.vertexAILocation),
      useLimitedUseAppCheckTokens: this.#appConfig.useLimitedUseAppCheckTokens,
    });

    return this.#ai;
  }

  private loadFirebase(): Promise<void> {
    return Promise.all([import('firebase/app'), import('firebase/remote-config')])
      .then(([{ initializeApp }, remoteConfigSdk]) => {
        this.#app = initializeApp(firebaseConfig.app);
        this.fetchRemoteConfig(remoteConfigSdk);
      })
      .catch((error) => {
        console.warn('Firebase initialization failed:', error);
        this.#appReady = null;
        this.#app = undefined;
        this.#ai = null;
      });
  }

  private fetchRemoteConfig({
    getRemoteConfig,
    fetchAndActivate,
    getValue,
  }: Pick<typeof import('firebase/remote-config'), 'getRemoteConfig' | 'fetchAndActivate' | 'getValue'>) {
    const rc = getRemoteConfig(this.#app);
    rc.defaultConfig = remoteConfigDefaults;
    const dev = isDevMode();
    rc.settings.minimumFetchIntervalMillis = dev ? 0 : ONE_HOUR_IN_MILLISECONDS;
    rc.settings.fetchTimeoutMillis = dev ? DEV_TIMEOUT : PROD_TIMEOUT;
    if (this.#isOnline()) {
      fetchAndActivate(rc)
        .then(() => {
          this.#appConfig = {
            vertexAILocation: getValue(rc, 'vertexAILocation').asString(),
            useLimitedUseAppCheckTokens: getValue(rc, 'useLimitedUseAppCheckTokens').asBoolean(),
            geminiModelName: getValue(rc, 'geminiModelName').asString(),
            thinkingLevel: getValue(rc, 'thinkingLevel').asString() as ThinkingLevel,
            geminiTTSModelName: getValue(rc, 'geminiTTSModelName').asString(),
          };
          this.#ai = null;
        })
        .catch((error) => console.warn('Remote Config fetch timed out or failed. Using defaults:', error));
    }
  }

  initialize(): void {
    if (!this.#appReady) {
      this.#appReady = this.loadFirebase();
    }
  }
}
