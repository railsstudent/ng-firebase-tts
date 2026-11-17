import { WINDOW } from '@/core/constants/navigator.const';
import { ConfigService } from '@/core/firebase';
import { inject, Service } from '@angular/core';
import type { DecisionMaker } from '@mediapipe/tasks-decision';
import type { ImageSubjectCategory } from './image-category.type';
import { IMAGE_CATEGORY_QUESTION, MAX_NUM_TOKENS, WASM_PATH } from './image-classifier.const';

@Service()
export class ImageClassifierService {
  readonly #window = inject(WINDOW);
  readonly #configService = inject(ConfigService);
  #decisionMakerPromise: Promise<DecisionMaker> | null = null;

  async classifyImage(imageBytes: Uint8Array): Promise<ImageSubjectCategory> {
    if (imageBytes.byteLength === 0) {
      return 'general';
    }

    const { decisionModelPath, decisionConfidenceThreshold } = this.#configService.appConfig;
    const delegate = this.resolveDelegate(decisionModelPath);
    if (!delegate) {
      return 'general';
    }

    try {
      const decisionMaker = await this.getDecisionMaker(delegate);
      const result = await decisionMaker.evaluateChoice({ imageBytes }, IMAGE_CATEGORY_QUESTION);

      if (result.confidence < decisionConfidenceThreshold) {
        return 'general';
      }

      if (result.selectedKey === 'place' || result.selectedKey === 'people') {
        return result.selectedKey;
      }

      return 'general';
    } catch (error) {
      console.warn('[ImageClassifierService] On-device classification failed, falling back to general:', error);
      return 'general';
    }
  }

  private resolveDelegate(modelAssetPath: string): 'GPU' | 'CPU' | undefined {
    const hasWebGpu = Boolean(this.#window?.navigator && 'gpu' in this.#window.navigator);
    if (hasWebGpu) {
      return 'GPU';
    }
    if (modelAssetPath.endsWith('.litertlm')) {
      return undefined;
    }
    return 'CPU';
  }

  private getDecisionMaker(delegate: 'GPU' | 'CPU'): Promise<DecisionMaker> {
    if (!this.#decisionMakerPromise) {
      this.#decisionMakerPromise = this.initializeDecisionMaker(
        this.#configService.appConfig.decisionModelPath,
        delegate,
      ).catch((error) => {
        this.#decisionMakerPromise = null;
        throw error;
      });
    }
    return this.#decisionMakerPromise;
  }

  private async initializeDecisionMaker(modelAssetPath: string, delegate: 'GPU' | 'CPU'): Promise<DecisionMaker> {
    const { DecisionMaker, FilesetResolver } = await import('@mediapipe/tasks-decision');
    const wasmFileset = await FilesetResolver.forDecisionTasks(WASM_PATH);
    const decisionMaker = await DecisionMaker.createFromOptions(wasmFileset, {
      baseOptions: {
        modelAssetPath,
        delegate,
      },
      backendType: 3,
      maxNumTokens: MAX_NUM_TOKENS,
    });

    await decisionMaker.prewarm({
      context: IMAGE_CATEGORY_QUESTION.context,
      expectedInputs: [{ type: 'image' }],
      questions: [
        {
          id: 'category',
          type: 'choice',
          prompt: IMAGE_CATEGORY_QUESTION.instructions ?? '',
          options: IMAGE_CATEGORY_QUESTION.options ?? [],
          normalizePrior: IMAGE_CATEGORY_QUESTION.normalizePrior ?? true,
        },
      ],
    });

    return decisionMaker;
  }
}
