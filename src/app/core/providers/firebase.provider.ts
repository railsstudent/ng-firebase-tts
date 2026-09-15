import { AI_BACKEND } from '@/core/constants/firebase.constant';
import { ConfigService } from '@/core/services/config.service';
import { inject, makeEnvironmentProviders } from '@angular/core';
import { AI } from 'firebase/ai';

export function provideFirebase() {
  return makeEnvironmentProviders([
    {
      provide: AI_BACKEND,
      useFactory: () => inject(ConfigService).aiBackend as AI,
    },
  ]);
}
