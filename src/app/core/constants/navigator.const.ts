import { isPlatformBrowser } from '@angular/common';
import { inject, InjectionToken, PLATFORM_ID } from '@angular/core';

export const IS_BROWSER = new InjectionToken<boolean>('IS_BROWSER', {
  providedIn: 'root',
  factory: () => {
    const platformId = inject(PLATFORM_ID);
    return isPlatformBrowser(platformId);
  },
});

export const WINDOW = new InjectionToken<Window | null>('WINDOW', {
  providedIn: 'root',
  factory: () => {
    const isBrowser = inject(IS_BROWSER);
    return isBrowser ? window : null;
  },
});

export const NAVIGATOR = new InjectionToken<Navigator | null>('NAVIGATOR', {
  providedIn: 'root',
  factory: () => {
    const win = inject(WINDOW);
    return win ? win.navigator : null;
  },
});
