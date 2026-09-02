import { AppRemoteConfig } from '@/core/interfaces/app-remote-config.type';
import { injectOnlineStatus } from '@/core/utils/connection.util';
import { configureAppCheckDebugToken, injectIsLocalhost } from '@/core/utils/platform.util';
import firebaseConfig from '@/public/firebase.config.json';
import remoteConfigDefaults from '@/public/remote-config-defaults.json';
import { isDevMode, Service } from '@angular/core';
import { AgentPlatformBackend, AI, getAI, ThinkingLevel } from 'firebase/ai';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
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
  get aiBackend(): unknown {
    if (!this.#aiBackend) {
      throw new Error('AI backend has not been initialized yet.');
    }
    return this.#aiBackend;
  }

  async initialize(): Promise<void> {
    this.#app = initializeApp(firebaseConfig.app);
    const isOnline = this.#isOnline();
    const isLocalhost = this.#isLocalhost();
    const key = firebaseConfig.recaptchaEnterpriseKey;

    if (isOnline && key) {
      configureAppCheckDebugToken(firebaseConfig.appCheckDebugToken, isLocalhost);
      initializeAppCheck(this.#app, {
        provider: new ReCaptchaEnterpriseProvider(key),
        isTokenAutoRefreshEnabled: true,
      });
    }

    this.#remoteConfig = getRemoteConfig(this.#app);
    this.#remoteConfig.defaultConfig = remoteConfigDefaults;
    const dev = isDevMode();
    this.#remoteConfig.settings.minimumFetchIntervalMillis = dev ? 0 : ONE_HOUR_IN_MILLISECONDS;
    this.#remoteConfig.settings.fetchTimeoutMillis = dev ? DEV_TIMEOUT : PROD_TIMEOUT;

    if (isOnline) {
      try {
        const activated = await fetchAndActivate(this.#remoteConfig);
        console.log('Remote Config initialized. Activated new values:', activated);

        const rc = this.#remoteConfig;
        const rawThinkingLevel = getValue(rc, 'thinkingLevel').asString();
        const thinkingLevel = ThinkingLevel[rawThinkingLevel as keyof typeof ThinkingLevel];

        this.#appConfig = {
          vertexAILocation: getValue(rc, 'vertexAILocation').asString(),
          useLimitedUseAppCheckTokens: getValue(rc, 'useLimitedUseAppCheckTokens').asBoolean(),
          geminiModelName: getValue(rc, 'geminiModelName').asString(),
          thinkingLevel,
          geminiTTSModelName: getValue(rc, 'geminiTTSModelName').asString(),
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
