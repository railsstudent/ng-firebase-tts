import { AppRemoteConfig } from '@/core/interfaces/app-remote-config.type';
import { injectOnlineStatus } from '@/core/utils/connection.util';
import { configureAppCheckDebugToken, injectIsLocalhost } from '@/core/utils/platform.util';
import firebaseConfig from '@/public/firebase.config.json';
import remoteConfigDefaults from '@/public/remote-config-defaults.json';
import { isDevMode, Service, signal } from '@angular/core';
import { AgentPlatformBackend, AI, getAI, ThinkingLevel } from 'firebase/ai';
import { FirebaseApp, FirebaseOptions, initializeApp } from 'firebase/app';
import { AppCheck, initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { fetchAndActivate, getRemoteConfig, getValue, RemoteConfig } from 'firebase/remote-config';

const SECONDS = 60;
const MILLISECONDS = 1000;
const ONE_HOUR_IN_MILLISECONDS = SECONDS * SECONDS * MILLISECONDS;

@Service()
export class ConfigService {
  #app: FirebaseApp | undefined = undefined;
  #remoteConfig: RemoteConfig | undefined = undefined;
  #isOnline = injectOnlineStatus();
  #isLocalhost = injectIsLocalhost();

  #appConfig = signal<AppRemoteConfig>({
    useLimitedUseAppCheckTokens: false,
    vertexAILocation: 'global',
    geminiModelName: '',
    geminiTTSModelName: '',
    thinkingLevel: ThinkingLevel.LOW,
  });
  appConfig = this.#appConfig.asReadonly();

  #aiBackend = signal<AI | undefined>(undefined);
  aiBackend = this.#aiBackend.asReadonly();

  get firebaseApp(): FirebaseApp {
    if (!this.#app) {
      throw new Error('Firebase app has not been initialized yet.');
    }
    return this.#app;
  }

  // Testable helper methods to allow mocking of read-only ESM imports
  protected initializeFirebaseApp(config: FirebaseOptions): FirebaseApp {
    return initializeApp(config);
  }

  protected initializeAppCheckInstance(app: FirebaseApp, key: string): AppCheck {
    return initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(key),
      isTokenAutoRefreshEnabled: true,
    });
  }

  protected setupRemoteConfig(app: FirebaseApp): RemoteConfig {
    const rc = getRemoteConfig(app);
    rc.defaultConfig = remoteConfigDefaults;
    rc.settings.minimumFetchIntervalMillis = isDevMode() ? 0 : ONE_HOUR_IN_MILLISECONDS;
    return rc;
  }

  protected fetchRemoteConfig(rc: RemoteConfig): Promise<boolean> {
    return fetchAndActivate(rc);
  }

  async initialize(): Promise<void> {
    this.#app = this.initializeFirebaseApp(firebaseConfig.app);

    const isOnline = this.#isOnline();
    const isLocalhost = this.#isLocalhost();

    if (isOnline && firebaseConfig.recaptchaEnterpriseKey) {
      configureAppCheckDebugToken(firebaseConfig.appCheckDebugToken, isLocalhost);
      this.initializeAppCheckInstance(this.#app, firebaseConfig.recaptchaEnterpriseKey);
    }

    this.#remoteConfig = this.setupRemoteConfig(this.#app);

    if (isOnline) {
      try {
        const activated = await this.fetchRemoteConfig(this.#remoteConfig);
        console.log('Remote Config initialized. Activated new values:', activated);

        const vertexAILocation = getValue(this.#remoteConfig, 'vertexAILocation').asString();
        const useLimitedUseAppCheckTokens = getValue(
          this.#remoteConfig,
          'useLimitedUseAppCheckTokens',
        ).asBoolean();

        const model = getValue(this.#remoteConfig, 'geminiModelName').asString();
        const rawThinkingLevel = getValue(this.#remoteConfig, 'thinkingLevel').asString();
        const thinkingLevel = ThinkingLevel[rawThinkingLevel as keyof typeof ThinkingLevel];
        const ttsModelName = getValue(this.#remoteConfig, 'geminiTTSModelName').asString();

        this.#appConfig.set({
          vertexAILocation,
          useLimitedUseAppCheckTokens,
          geminiModelName: model,
          thinkingLevel,
          geminiTTSModelName: ttsModelName,
        });

        const firebaseAI = getAI(this.#app, {
          backend: new AgentPlatformBackend(this.#appConfig().vertexAILocation),
          useLimitedUseAppCheckTokens: this.#appConfig().useLimitedUseAppCheckTokens,
        });
        this.#aiBackend.set(firebaseAI);
      } catch (error) {
        console.warn('Remote Config fetch timed out or failed. Using defaults:', error);
      }
    }
  }
}
