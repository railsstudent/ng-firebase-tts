import type { AiModelFactory } from '@/core/firebase/ai-model-factory.service';
import type { GenerationConfig, GroundingMetadata, UsageMetadata } from 'firebase/ai';
import { getGenerativeModel } from 'firebase/ai';
import { vi } from 'vitest';

interface MockVisionResponseOptions {
  altText?: string;
  tags?: string[];
  suggestions?: { title: string; reason: string }[];
  obscureFact?: string;
  thoughtSummary?: string;
  includeGrounding?: boolean;
}

interface MockTtsResponseOptions {
  base64Data?: string;
  mimeType?: string;
}

interface MockVisionPayload {
  altText: string;
  tags: string[];
  suggestions: { title: string; reason: string }[];
  obscureFact: string;
}

interface MockVisionResponse {
  response: {
    candidates: { groundingMetadata?: GroundingMetadata }[];
    text: () => string;
    thoughtSummary: () => string;
    usageMetadata: UsageMetadata;
  };
}

interface MockTtsResponse {
  response: {
    candidates: {
      content: {
        parts: { inlineData: { data: string; mimeType: string } }[];
      };
    }[];
  };
}

interface MockTtsStream {
  stream: AsyncGenerator<{
    candidates: {
      content: {
        parts: { inlineData: { data: string; mimeType: string } }[];
      };
    }[];
  }>;
}

export interface MockGenerativeModel {
  generationConfig?: GenerationConfig;
  generateContent: ReturnType<typeof vi.fn>;
  generateContentStream: ReturnType<typeof vi.fn>;
}

export interface MockAiModelFactory {
  getModel: ReturnType<typeof vi.fn>;
  getTtsModel: ReturnType<typeof vi.fn>;
}

function buildVisionPayload(options?: MockVisionResponseOptions): MockVisionPayload {
  return {
    altText: options?.altText ?? 'A beautiful sunset over the mountains',
    tags: options?.tags ?? ['sunset', 'mountains', 'scenery'],
    suggestions: options?.suggestions ?? [{ title: 'Add foreground interest', reason: 'To make composition stronger' }],
    obscureFact: options?.obscureFact ?? 'Sunsets on Mars are actually blue because of fine dust particles.',
  };
}

function buildGroundingMetadata(includeGrounding?: boolean): GroundingMetadata | undefined {
  if (includeGrounding === false) {
    return undefined;
  }
  return {
    webSearchQueries: ['blue sunset mars reason'],
    searchEntryPoint: {
      renderedContent: 'Google Search for blue sunset Mars',
    },
    groundingChunks: [
      {
        web: {
          uri: 'https://nasa.gov/mars-blue-sunset',
          title: 'Why Sunsets on Mars are Blue',
        },
      },
    ],
    groundingSupports: [
      {
        groundingChunkIndices: [0],
      },
    ],
  };
}

export function createMockVisionResponse(options?: MockVisionResponseOptions): MockVisionResponse {
  const analysisPayload = buildVisionPayload(options);
  const groundingMetadata = buildGroundingMetadata(options?.includeGrounding);

  return {
    response: {
      candidates: [{ groundingMetadata }],
      text: () => '```json\n' + JSON.stringify(analysisPayload) + '\n```',
      thoughtSummary: () => options?.thoughtSummary ?? 'Analyzing the uploaded landscape photo step-by-step.',
      usageMetadata: {
        candidatesTokenCount: 200,
        promptTokenCount: 150,
        thoughtsTokenCount: 50,
        totalTokenCount: 400,
      },
    },
  };
}

export function createMockTtsResponse(options?: MockTtsResponseOptions): MockTtsResponse {
  const data = options?.base64Data ?? 'SGVsbG8=';
  const mimeType = options?.mimeType ?? 'audio/l16; rate=24000; channels=1';

  return {
    response: {
      candidates: [
        {
          content: {
            parts: [{ inlineData: { data, mimeType } }],
          },
        },
      ],
    },
  };
}

export function createMockTtsStream(chunks?: { data: string; mimeType: string }[]): MockTtsStream {
  const defaultChunks = chunks ?? [{ data: 'SGVsbG8=', mimeType: 'audio/l16; rate=24000; channels=1' }];

  return {
    stream: (async function* () {
      for (const chunk of defaultChunks) {
        yield {
          candidates: [
            {
              content: {
                parts: [{ inlineData: { data: chunk.data, mimeType: chunk.mimeType } }],
              },
            },
          ],
        };
      }
    })(),
  };
}

export function createMockVisionModel(): MockGenerativeModel {
  return vi.mocked(getGenerativeModel)({} as never, {} as never) as unknown as MockGenerativeModel;
}

export function createMockTtsModel(): MockGenerativeModel {
  return vi.mocked(getGenerativeModel)({} as never, {
    model: 'gemini-2.0-flash-exp',
    generationConfig: { responseModalities: ['AUDIO'] },
  }) as unknown as MockGenerativeModel;
}

export function createMockAiModelFactory(options?: {
  model?: MockGenerativeModel;
  ttsModel?: MockGenerativeModel;
}): MockAiModelFactory {
  const defaultModel = options?.model ?? createMockVisionModel();
  const defaultTtsModel = options?.ttsModel ?? createMockTtsModel();

  return {
    getModel: vi.fn().mockResolvedValue(defaultModel),
    getTtsModel: vi.fn().mockResolvedValue(defaultTtsModel),
  } satisfies Partial<AiModelFactory>;
}
