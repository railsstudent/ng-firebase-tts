import { inject, InjectionToken, isDevMode } from '@angular/core';
import { WINDOW } from '@/core/constants/navigator.const';

/**
 * Injection token representing hostnames that are considered localhost.
 */
export const LOCAL_DOMAINS = new InjectionToken<string[]>('LOCAL_DOMAINS', {
  providedIn: 'root',
  factory: () => ['localhost', '127.0.0.1', '::1', '[::1]'],
});

/**
 * Utility to check if the application is running locally on any registered local domain.
 * Must be invoked during an active injection context (e.g., field initializers or constructors).
 *
 * @returns A function that queries the localhost status.
 */
export function injectIsLocalhost(): () => boolean {
  const win = inject(WINDOW);
  const localDomains = inject(LOCAL_DOMAINS);

  return () => !!win && localDomains.includes(win.location.hostname);
}

/**
 * Configures the Firebase App Check debug token on the global scope.
 * App Check uses this global variable to determine if it should run in debug/sandbox mode.
 *
 * @param configToken A custom persistent debug token supplied from the firebase configuration.
 * @param isLocalhost Whether the application is currently running on a local development domain.
 */
export function configureAppCheckDebugToken(configToken?: string, isLocalhost?: boolean): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).FIREBASE_APPCHECK_DEBUG_TOKEN = configToken || isDevMode() || !!isLocalhost;
}
