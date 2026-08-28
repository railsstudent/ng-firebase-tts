import { FirebaseOptions } from 'firebase/app';

export interface FirebaseConfigResponse {
  app: FirebaseOptions;
  recaptchaSiteKey: string;
  appCheckDebugToken?: string;
}
