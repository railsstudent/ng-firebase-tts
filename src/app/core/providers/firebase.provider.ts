import { AI_BACKEND, SAFETY_SETTINGS, VISION_AI_MODEL } from '@/core/constants/firebase.constant';
import { ImageAnalysisSchema } from '@/core/schemas/image-analysis.schema';
import { ConfigService } from '@/core/services/config.service';
import { inject, makeEnvironmentProviders } from '@angular/core';
import { AgentPlatformBackend, getAI, getGenerativeModel, ThinkingLevel } from 'firebase/ai';
import { getValue, RemoteConfig } from 'firebase/remote-config';

const TOOLS = [
  {
    googleSearch: {},
  },
];

function getGenerativeAIModel(remoteConfig: RemoteConfig) {
  const model = getValue(remoteConfig, 'geminiModelName').asString();
  const rawThinkingLevel = getValue(remoteConfig, 'thinkingLevel').asString();
  const thinkingLevel = ThinkingLevel[rawThinkingLevel as keyof typeof ThinkingLevel];

  return getGenerativeModel(inject(AI_BACKEND), {
    model,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: ImageAnalysisSchema,
      thinkingConfig: {
        thinkingLevel,
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
        const vertexAILocation = getValue(
          configService.remoteConfig,
          'vertexAILocation',
        ).asString();

        const useLimitedUseAppCheckTokens = getValue(
          configService.remoteConfig,
          'useLimitedUseAppCheckTokens',
        ).asBoolean();

        return getAI(configService.firebaseApp, {
          backend: new AgentPlatformBackend(vertexAILocation),
          useLimitedUseAppCheckTokens,
        });
      },
    },
    {
      provide: VISION_AI_MODEL,
      useFactory: () => {
        const configService = inject(ConfigService);
        return getGenerativeAIModel(configService.remoteConfig);
      },
    },
  ]);
}
