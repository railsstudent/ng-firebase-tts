import { inject, Service } from '@angular/core';
import type { AI, GenerationConfig, ModelParams, SafetySetting } from 'firebase/ai';
import { GenerativeModel, HarmBlockThreshold, HarmCategory } from 'firebase/ai';
import type { AiModelOptions } from './ai-model-options.interface';
import { ConfigService } from './config.service';

const SAFETY_SETTINGS: SafetySetting[] = [
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

@Service()
export class AiModelFactory {
  readonly #configService = inject(ConfigService);
  readonly #models = new Map<string, GenerativeModel>();
  #ttsModel: GenerativeModel | null = null;
  #cachedBackend: AI | null = null;

  private generateKey(options?: AiModelOptions): string {
    const { geminiModelName, thinkingLevel } = this.#configService.appConfig;
    const instruction = options?.systemInstruction ?? '';
    const schemaKey = options?.schema ? JSON.stringify(options.schema) : '';
    const toolsKey = options?.tools?.length ? JSON.stringify(options.tools) : '';

    return `${geminiModelName}_${thinkingLevel}_${instruction}_${schemaKey}_${toolsKey}`;
  }

  private async createModel(backend: AI, options?: AiModelOptions): Promise<GenerativeModel> {
    const { getGenerativeModel } = await import('firebase/ai');
    const model = this.#configService.appConfig.geminiModelName;
    const { thinkingLevel } = this.#configService.appConfig;

    const generationConfig: GenerationConfig = {
      thinkingConfig: {
        thinkingLevel,
        includeThoughts: true,
      },
    };

    if (options?.schema) {
      generationConfig.responseSchema = options.schema;
      generationConfig.responseMimeType = 'application/json';
    }

    const modelParams: ModelParams = {
      model,
      generationConfig,
      safetySettings: SAFETY_SETTINGS,
    };

    if (options?.tools?.length) {
      modelParams.tools = options.tools;
    }

    if (options?.systemInstruction) {
      modelParams.systemInstruction = options.systemInstruction;
    }

    return getGenerativeModel(backend, modelParams);
  }

  async getModel(options?: AiModelOptions): Promise<GenerativeModel> {
    const key = this.generateKey(options);
    const backend = await this.getValidBackend();
    let model = this.#models.get(key);
    if (!model) {
      model = await this.createModel(backend, options);
      this.#models.set(key, model);
    }

    return model;
  }

  private async createTtsModel(ai: AI): Promise<GenerativeModel> {
    const { getGenerativeModel, ResponseModality } = await import('firebase/ai');

    return getGenerativeModel(ai, {
      model: this.#configService.appConfig.geminiTTSModelName,
      generationConfig: {
        responseModalities: [ResponseModality.AUDIO],
      },
    });
  }

  async getTtsModel(): Promise<GenerativeModel> {
    const backend = await this.getValidBackend();
    if (!this.#ttsModel) {
      this.#ttsModel = await this.createTtsModel(backend);
    }

    return this.#ttsModel;
  }

  private async getValidBackend(): Promise<AI> {
    const backend = await this.#configService.getAiBackend();
    if (backend !== this.#cachedBackend) {
      this.#cachedBackend = backend;
      this.#models.clear();
      this.#ttsModel = null;
    }

    return this.#cachedBackend;
  }
}
