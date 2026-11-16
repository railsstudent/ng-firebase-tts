import { WINDOW } from '@/core/constants/navigator.const';
import { ConfigService } from '@/core/firebase';
import { inject, Service } from '@angular/core';
import type { ChoiceQuestion, DecisionMaker } from '@mediapipe/tasks-decision';
import type { ImageSubjectCategory } from './image-category.type';

const WASM_PATH = '/wasm';
const MAX_NUM_TOKENS = 512;

const IMAGE_CATEGORY_QUESTION: ChoiceQuestion = {
  context: 'Analyze the uploaded image for accessibility alt-text routing.',
  instructions: 'Classify the primary subject category of this image.',
  options: [
    {
      label: 'place',
      description:
        'A recognizable landmark, monument, building, streetscape, or geographic location, even if people or faces appear in the foreground.',
    },
    {
      label: 'people',
      description:
        'A portrait, close-up face, solo person, or group of people where human subjects are the primary focus without a recognizable landmark.',
    },
    {
      label: 'general',
      description:
        'Objects, animals, food, documents, nature close-ups, abstract scenes, or any image that is neither a recognizable place nor focused on people.',
    },
  ],
  normalizePrior: true,
};

@Service()
export class ImageClassifierService {
  readonly #window = inject(WINDOW);
  readonly #configService = inject(ConfigService);
  #decisionMakerPromise: Promise<DecisionMaker> | null = null;

  async classifyImage(imageBytes: Uint8Array): Promise<ImageSubjectCategory> {
    const { decisionModelPath, decisionConfidenceThreshold } = this.#configService.appConfig;
    const delegate = this.resolveDelegate(decisionModelPath);
    if (!delegate) {
      return 'general';
    }

    try {
      const decisionMaker = await this.getDecisionMaker(decisionModelPath, delegate);
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

  private getDecisionMaker(modelAssetPath: string, delegate: 'GPU' | 'CPU'): Promise<DecisionMaker> {
    if (!this.#decisionMakerPromise) {
      this.#decisionMakerPromise = this.initializeDecisionMaker(modelAssetPath, delegate).catch((error) => {
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
