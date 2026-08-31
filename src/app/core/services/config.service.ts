import { AppRemoteConfig } from '@/core/interfaces/app-remote-config.type';
import { injectOnlineStatus } from '@/core/utils/connection.util';
import { configureAppCheckDebugToken, injectIsLocalhost } from '@/core/utils/platform.util';
import firebaseConfig from '@/public/firebase.config.json';
import remoteConfigDefaults from '@/public/remote-config-defaults.json';
import { isDevMode, Service } from '@angular/core';
import { AgentPlatformBackend, AI, getAI, ThinkingLevel } from 'firebase/ai';
import { FirebaseApp, FirebaseOptions, initializeApp } from 'firebase/app';
import { AppCheck, initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { fetchAndActivate, getRemoteConfig, getValue, RemoteConfig } from 'firebase/remote-config';

const SECONDS = 60;
const MILLISECONDS = 1000;
const ONE_HOUR_IN_MILLISECONDS = SECONDS * SECONDS * MILLISECONDS;
const DEV_TIMEOUT = 1000;
const PROD_TIMEOUT = 2000;

@Service()
export class ConfigService {
  #app: FirebaseApp | undefined = undefined;
  #remoteConfig: RemoteConfig | undefined = undefined;
  #isOnline = injectOnlineStatus();
  #isLocalhost = injectIsLocalhost();

  #appConfig: AppRemoteConfig = {
    useLimitedUseAppCheckTokens: remoteConfigDefaults.useLimitedUseAppCheckTokens === 'true',
    vertexAILocation: remoteConfigDefaults.vertexAILocation,
    geminiModelName: remoteConfigDefaults.geminiModelName,
    geminiTTSModelName: remoteConfigDefaults.geminiTTSModelName,
    thinkingLevel: ThinkingLevel[remoteConfigDefaults.thinkingLevel as keyof typeof ThinkingLevel],
  };

  get appConfig(): AppRemoteConfig {
    return this.#appConfig;
  }

  #aiBackend: AI | undefined = undefined;
  get aiBackend(): AI {
    if (!this.#aiBackend) {
      throw new Error('AI backend has not been initialized yet.');
    }
    return this.#aiBackend;
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
    rc.settings.fetchTimeoutMillis = isDevMode() ? DEV_TIMEOUT : PROD_TIMEOUT;
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

        const rawThinkingLevel = getValue(this.#remoteConfig, 'thinkingLevel').asString();
        const thinkingLevel = ThinkingLevel[rawThinkingLevel as keyof typeof ThinkingLevel];

        this.#appConfig = {
          vertexAILocation: getValue(this.#remoteConfig, 'vertexAILocation').asString(),
          useLimitedUseAppCheckTokens: getValue(
            this.#remoteConfig,
            'useLimitedUseAppCheckTokens',
          ).asBoolean(),
          geminiModelName: getValue(this.#remoteConfig, 'geminiModelName').asString(),
          thinkingLevel,
          geminiTTSModelName: getValue(this.#remoteConfig, 'geminiTTSModelName').asString(),
        };
      } catch (error) {
        console.warn('Remote Config fetch timed out or failed. Using defaults:', error);
      }
    }

    this.#aiBackend = getAI(this.#app, {
      backend: new AgentPlatformBackend(this.#appConfig.vertexAILocation),
      useLimitedUseAppCheckTokens: this.#appConfig.useLimitedUseAppCheckTokens,
    });
  }
}
