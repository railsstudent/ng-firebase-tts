import { isPlatformBrowser } from '@angular/common';
import { inject, InjectionToken, PLATFORM_ID } from '@angular/core';

export const WINDOW = new InjectionToken<Window | null>('WINDOW', {
  providedIn: 'root',
  factory: () => {
    const platformId = inject(PLATFORM_ID);
    return isPlatformBrowser(platformId) ? window : null;
  },
});
