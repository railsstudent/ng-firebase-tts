import { AI_MODEL } from '@/core/constants/firebase.constant';
import { ImageAnalysisSchema } from '@/core/schemas/image-analysis.schema';
import { ConfigService } from '@/core/services/config.service';
import { inject, makeEnvironmentProviders } from '@angular/core';
import {
  AgentPlatformBackend,
  getAI,
  getGenerativeModel,
  HarmBlockThreshold,
  HarmCategory,
  ThinkingLevel,
} from 'firebase/ai';
import { FirebaseApp } from 'firebase/app';
import { getValue, RemoteConfig } from 'firebase/remote-config';

const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];

const TOOLS = [
  {
    googleSearch: {},
  },
];

function getGenerativeAIModel(firebaseApp: FirebaseApp, remoteConfig: RemoteConfig) {
  const model = getValue(remoteConfig, 'geminiModelName').asString();
  const vertexAILocation = getValue(remoteConfig, 'vertexAILocation').asString();
  const rawThinkingLevel = getValue(remoteConfig, 'thinkingLevel').asString();
  const thinkingLevel = ThinkingLevel[rawThinkingLevel as keyof typeof ThinkingLevel];

  const ai = getAI(firebaseApp, { backend: new AgentPlatformBackend(vertexAILocation) });

  return getGenerativeModel(ai, {
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
      provide: AI_MODEL,
      useFactory: () => {
        const configService = inject(ConfigService);

        if (!configService.remoteConfig) {
          console.error('Remote config does not exist.');
          return undefined;
        }

        if (!configService.firebaseApp) {
          console.error('Firebase App does not exist');
          return undefined;
        }

        return getGenerativeAIModel(configService.firebaseApp, configService.remoteConfig);
      },
    },
  ]);
}
