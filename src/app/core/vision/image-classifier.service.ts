import { WINDOW } from '@/core/constants/navigator.const';
import { ConfigService } from '@/core/firebase';
import { DestroyRef, inject, Service } from '@angular/core';
import type { DecisionMaker } from '@mediapipe/tasks-decision';
import type { ImageSubjectCategory } from './image-category.type';
import {
  DECISION_MODEL_CACHE_NAME,
  IMAGE_CATEGORY_QUESTION,
  MAX_NUM_TOKENS,
  WASM_PATH,
} from './image-classifier.const';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Service()
export class ImageClassifierService {
  #window = inject(WINDOW);
  #configService = inject(ConfigService);
  #destroyRef = inject(DestroyRef);
  #decisionMakerPromise: Promise<DecisionMaker> | null = null;
  #cachedModelPath: string | null = null;
  #http = inject(HttpClient);

  constructor() {
    this.#destroyRef.onDestroy(() => this.closeActiveDecisionMaker());
  }

  async classifyImage(imageBytes: Uint8Array): Promise<ImageSubjectCategory> {
    if (imageBytes.byteLength === 0) {
      return 'general';
    }

    const delegate = this.resolveDelegate();
    if (!delegate) {
      return 'general';
    }

    try {
      const decisionMaker = await this.getValidDecisionMaker(delegate);
      const { probabilities } = await decisionMaker.evaluateChoice({ imageBytes }, IMAGE_CATEGORY_QUESTION);

      let bestCategory: ImageSubjectCategory = 'general';
      let highestProbability = -1;

      for (const [key, probability] of Object.entries(probabilities)) {
        if (probability > highestProbability && (key === 'place' || key === 'people' || key === 'general')) {
          highestProbability = probability;
          bestCategory = key;
        }
      }

      return bestCategory;
    } catch (error) {
      console.warn('[ImageClassifierService] On-device classification failed, falling back to general:', error);
      return 'general';
    }
  }

  private resolveDelegate(): 'GPU' | 'CPU' | undefined {
    const hasWebGpu = Boolean(this.#window?.navigator && 'gpu' in this.#window.navigator);
    if (hasWebGpu) {
      return 'GPU';
    }
    if (this.#configService.appConfig.decisionModelPath.endsWith('.litertlm')) {
      return undefined;
    }
    return 'CPU';
  }

  private async getValidDecisionMaker(delegate: 'GPU' | 'CPU'): Promise<DecisionMaker> {
    const modelAssetPath = this.#configService.appConfig.decisionModelPath;

    if (this.#decisionMakerPromise && this.#cachedModelPath !== modelAssetPath) {
      await this.closeActiveDecisionMaker();
    }

    if (!this.#decisionMakerPromise) {
      this.#cachedModelPath = modelAssetPath;
      this.#decisionMakerPromise = this.initializeDecisionMaker(modelAssetPath, delegate).catch((error) => {
        this.#decisionMakerPromise = null;
        this.#cachedModelPath = null;
        throw error;
      });
    }

    return this.#decisionMakerPromise;
  }

  private async closeActiveDecisionMaker(): Promise<void> {
    if (!this.#decisionMakerPromise) {
      return;
    }

    try {
      const decisionMaker = await this.#decisionMakerPromise;
      decisionMaker.close();
    } catch {
      // Ignore initialization or WASM teardown errors during cleanup
    } finally {
      this.#decisionMakerPromise = null;
      this.#cachedModelPath = null;
    }
  }

  private async initializeDecisionMaker(modelAssetPath: string, delegate: 'GPU' | 'CPU'): Promise<DecisionMaker> {
    const { DecisionMaker, FilesetResolver } = await import('@mediapipe/tasks-decision');
    const wasmFileset = await FilesetResolver.forDecisionTasks(WASM_PATH);
    const resolvedModelPath = await this.resolveCachedModelUrl(modelAssetPath);

    try {
      const decisionMaker = await DecisionMaker.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath: resolvedModelPath,
          delegate,
        },
        backendType: 3,
        maxNumTokens: MAX_NUM_TOKENS,
      });

      await decisionMaker.prewarmChoice(IMAGE_CATEGORY_QUESTION);

      return decisionMaker;
    } finally {
      if (resolvedModelPath.startsWith('blob:')) {
        URL.revokeObjectURL(resolvedModelPath);
      }
    }
  }

  private async resolveCachedModelUrl(modelAssetPath: string): Promise<string> {
    const cacheStorage = this.#window?.caches;
    if (!cacheStorage) {
      return modelAssetPath;
    }

    try {
      const cache = await cacheStorage.open(DECISION_MODEL_CACHE_NAME);
      const keys = await cache.keys();
      await Promise.all(keys.filter((req) => req.url !== modelAssetPath).map((req) => cache.delete(req)));

      let response = await cache.match(modelAssetPath);
      if (!response) {
        const httpResponse = await firstValueFrom(
          this.#http.get(modelAssetPath, { observe: 'response', responseType: 'blob' }),
        );
        const downloadedBlob = httpResponse.body;
        if (!downloadedBlob) {
          return modelAssetPath;
        }
        response = new Response(downloadedBlob, {
          status: httpResponse.status,
          headers: {
            'Content-Type': httpResponse.headers.get('Content-Type') ?? 'application/octet-stream',
          },
        });
        await cache.put(modelAssetPath, response.clone());
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch {
      return modelAssetPath;
    }
  }
}
