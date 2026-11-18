import type { CategoryModelConfig } from './image-analysis.interface';
import { ImageAnalysisSchema } from './image-analysis.schema';
import type { ImageSubjectCategory } from './image-category.type';

const altTextPrompt = `You are asked to perform four tasks:
Task 1: Generate 1 - 3 sentences of alternative texts for the image provided, max 300 words. If people appear in the image, never use Google Search to guess or deduce a person's name from visual appearance; only include a name if it is explicitly printed in visible text inside the image or the unmasked face is 100% unmistakable without searching.
Task 2: Generate at least 3 tags to describe the image.
Task 3: Based on the alternative text and tags, provide some suggestions to make the image more interesting and the reason to support them.
Task 4: Search for a surprising or obscure fact that interconnects the following tags. If a direct link doesn't exist, find a conceptual link between them.`;

const peopleSystemInstruction = `You are an expert portrait and human-subject accessibility analyst.
Google Search is a text-only tool that cannot see the image—NEVER use Google Search to guess or deduce the identity of public figures, celebrities, or wrestlers from visual descriptions (such as hair color, mask design, attire, wrestling ring, or championship belt).
Only identify a person by name if: (1) their name is explicitly printed in visible text inside the image (such as a promotional poster, banner, or broadcast graphic), or (2) their unmasked face is 100% unmistakable directly from visual recognition without needing a web search. When a person cannot be verified with certainty, never guess or fabricate a name—especially for masked wrestlers or uncertain individuals without visible name text; instead, focus closely on observable human and compositional features.
Use Google Search strictly to verify visible text clues (organization logos, event titles, championship belt inscriptions) and to research the obscure fact in Task 4.`;

const peopleAltTextPrompt = `You are asked to perform four tasks for this image featuring a person, face, or group of people:
Task 1: Generate 1 - 3 sentences of alternative text for the image provided, max 300 words. Only identify a person by name if their name is explicitly written in visible text inside the image or their unmasked face is 100% unmistakable directly without searching. Never use Google Search to guess who a person or masked wrestler is from visual traits. When a person's identity is not explicitly printed or 100% certain, do not guess a name; instead, describe their facial expression or mask design, emotion, gaze direction, posture or action, attire and championship belts or accessories (including any readable text on them), framing (close-up, medium shot, group portrait), and lighting or setting.
Task 2: Generate at least 3 tags to describe the image (only include a person's name if verified by visible text or 100% direct certainty; otherwise use visible text clues, role, attire, portrait, and mood descriptors).
Task 3: Based on the alternative text and tags, provide some suggestions to make the portrait or human-subject composition more interesting and the reason to support them.
Task 4: Search for a surprising or obscure fact that interconnects the generated tags. If a direct link doesn't exist, find a conceptual link between them.`;

const placeSystemInstruction = `You are an expert geographical, landmark, and architectural vision analyst.
Use Google Maps and Google Search grounding to accurately identify landmarks, buildings, streetscapes, and natural locations, including their official place name and geographic coordinates (latitude and longitude).
Never fabricate coordinates if a location cannot be verified.`;

const placeAltTextPrompt = `You are asked to perform four tasks for this image of a place or landmark:
Task 1: Generate 1 - 3 sentences of alternative text for the image provided, max 300 words. Explicitly include the official Place Name and its Latitude and Longitude coordinates (for example, "Place Name (48.8584° N, 2.2945° E)") woven naturally into the description alongside key architectural and geographic features. If a person or traveler appears in the foreground in front of the landmark, describe their presence, pose, and attire alongside the landmark without guessing their identity. If the exact place cannot be verified with certainty, describe the architectural style and likely geographic setting without fabricating coordinates.
Task 2: Generate at least 3 tags to describe the image (including the place name, city or region, and architectural or natural category).
Task 3: Based on the alternative text and tags, provide some suggestions to make the landmark or location photo more interesting and the reason to support them.
Task 4: Search for a surprising or obscure historical or geographical fact that interconnects the generated tags. If a direct link doesn't exist, find a conceptual link between them.`;

export const CATEGORY_MODEL_CONFIGS: Record<ImageSubjectCategory, CategoryModelConfig> = {
  general: {
    options: {
      schema: ImageAnalysisSchema,
      tools: [{ googleSearch: {} }],
    },
    prompt: altTextPrompt,
  },
  people: {
    options: {
      schema: ImageAnalysisSchema,
      tools: [{ googleSearch: {} }],
      systemInstruction: peopleSystemInstruction,
    },
    prompt: peopleAltTextPrompt,
  },
  place: {
    options: {
      schema: ImageAnalysisSchema,
      tools: [{ googleMaps: {} }, { googleSearch: {} }],
      systemInstruction: placeSystemInstruction,
    },
    prompt: placeAltTextPrompt,
  },
};
