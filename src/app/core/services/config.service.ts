import { WINDOW } from '@/core/constants/navigator.const';
import { AppRemoteConfig } from '@/core/interfaces/app-remote-config.interface';
import firebaseConfig from '@/public/firebase.config.json';
import remoteConfigDefaults from '@/public/remote-config-defaults.json';
import { inject, isDevMode, Service } from '@angular/core';
import type { AI, ThinkingLevel } from 'firebase/ai';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { fetchAndActivate, getRemoteConfig, getValue, RemoteConfig } from 'firebase/remote-config';

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

  #ai: AI | null = null;
  #appCheck: Promise<void> | null = null;

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

  private ensureAppCheck(isLocalhost: boolean, key: string): Promise<void> {
    if (!this.#appCheck) {
      this.#appCheck = this.loadAppCheck(isLocalhost, key);
    }
    return this.#appCheck;
  }

  async getAiBackend(): Promise<AI> {
    if (!this.#app) {
      throw new Error('Firebase App has not been initialized yet.');
    }

    if (this.#ai) {
      return this.#ai;
    }

    const isOnline = this.#isOnline();
    const isLocalhost = this.#isLocalhost();
    const key = firebaseConfig.recaptchaEnterpriseKey;
    if (isOnline && key) {
      await this.ensureAppCheck(isLocalhost, key);
    }

    const { getAI, AgentPlatformBackend } = await import('firebase/ai');
    this.#ai = getAI(this.#app, {
      backend: new AgentPlatformBackend(this.#appConfig.vertexAILocation),
      useLimitedUseAppCheckTokens: this.#appConfig.useLimitedUseAppCheckTokens,
    });

    return this.#ai;
  }

  initialize() {
    this.#app = initializeApp(firebaseConfig.app);
    const isOnline = this.#isOnline();

    const rc = getRemoteConfig(this.#app);
    rc.defaultConfig = remoteConfigDefaults;
    const dev = isDevMode();
    rc.settings.minimumFetchIntervalMillis = dev ? 0 : ONE_HOUR_IN_MILLISECONDS;
    rc.settings.fetchTimeoutMillis = dev ? DEV_TIMEOUT : PROD_TIMEOUT;

    if (isOnline) {
      fetchAndActivate(rc)
        .then((activated) => {
          console.log('Remote Config initialized. Activated new values:', activated);
          this.applyRemoteConfigValues(rc);
        })
        .catch((error) => {
          console.warn('Remote Config fetch timed out or failed. Using defaults:', error);
        });
    }
  }

  private applyRemoteConfigValues(rc: RemoteConfig): void {
    const rawThinkingLevel = getValue(rc, 'thinkingLevel').asString();
    const thinkingLevel = rawThinkingLevel as ThinkingLevel;

    this.#appConfig = {
      vertexAILocation: getValue(rc, 'vertexAILocation').asString(),
      useLimitedUseAppCheckTokens: getValue(rc, 'useLimitedUseAppCheckTokens').asBoolean(),
      geminiModelName: getValue(rc, 'geminiModelName').asString(),
      thinkingLevel,
      geminiTTSModelName: getValue(rc, 'geminiTTSModelName').asString(),
    };

    this.#ai = null;
  }

  private loadAppCheck(isLocalhost: boolean, key: string): Promise<void> {
    const appCheck = import('firebase/app-check');
    return appCheck.then((m) => {
      this.#configureAppCheckDebugToken(isLocalhost);
      m.initializeAppCheck(this.#app, {
        provider: new m.ReCaptchaEnterpriseProvider(key),
        isTokenAutoRefreshEnabled: true,
      });
    });
  }
}
