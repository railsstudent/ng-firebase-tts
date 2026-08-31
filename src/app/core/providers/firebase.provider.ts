import { AI_BACKEND, SAFETY_SETTINGS, VISION_AI_MODEL } from '@/core/constants/firebase.constant';
import { AppRemoteConfig } from '@/core/interfaces/app-remote-config.type';
import { ImageAnalysisSchema } from '@/core/schemas/image-analysis.schema';
import { ConfigService } from '@/core/services/config.service';
import { inject, makeEnvironmentProviders } from '@angular/core';
import { getGenerativeModel } from 'firebase/ai';

const TOOLS = [
  {
    googleSearch: {},
  },
];

function getGenerativeAIModel(appConfig: AppRemoteConfig) {
  return getGenerativeModel(inject(AI_BACKEND), {
    model: appConfig.geminiModelName,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: ImageAnalysisSchema,
      thinkingConfig: {
        thinkingLevel: appConfig.thinkingLevel,
        includeThoughts: true,
      },
    },
    safetySettings: SAFETY_SETTINGS,
    tools: TOOLS,
  });
}

export function provideFirebase() {
  return makeEnvironmentProviders([
    {
      provide: AI_BACKEND,
      useFactory: () => {
        const configService = inject(ConfigService);
        const aiBackend = configService.aiBackend();

        if (aiBackend) {
          return aiBackend;
        }

        throw new Error('aiBackend is undefined');
      },
    },
    {
      provide: VISION_AI_MODEL,
      useFactory: () => {
        const configService = inject(ConfigService);
        return getGenerativeAIModel(configService.appConfig());
      },
    },
  ]);
}
