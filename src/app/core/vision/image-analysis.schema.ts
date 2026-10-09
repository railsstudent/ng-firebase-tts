import { Schema } from 'firebase/ai';

export const ImageAnalysisSchema = Schema.object({
  properties: {
    tags: Schema.array({
      items: Schema.string(),
    }),
    alternativeText: Schema.string(),
    recommendations: Schema.array({
      items: Schema.object({
        properties: {
          id: Schema.integer(),
          text: Schema.string(),
          reason: Schema.string(),
        },
      }),
    }),
    fact: Schema.string(),
  },
});
