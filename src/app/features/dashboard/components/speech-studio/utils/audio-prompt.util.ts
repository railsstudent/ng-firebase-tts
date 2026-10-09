import { AudioPromptData } from '@/features/dashboard/interfaces/audio-prompt-data.interface';

export interface AudioPrompt extends AudioPromptData {
  transcript: string;
}

const SCENE_DICTIONARY = [
  'A dimly lit, dusty library filled with ancient leather-bound books.\n' +
    'The air is thick with history. A scholarly archivist is leaning closely into a warm, vintage ribbon microphone.\n' +
    'They speak with an infectious, hushed intensity, eager to share a forgotten secret they just uncovered in a decaying manuscript.',

  'It is 10:00 PM in a glass-walled studio overlooking the moonlit London skyline, but inside, it is blindingly bright.\n' +
    "The red 'ON AIR' tally light is blazing. The speaker is standing up, bouncing on the balls of their heels to the rhythm of a thumping backing track.\n" +
    'It is a chaotic, caffeine-fueled cockpit designed to wake up an entire nation.',

  'A meticulously sound-treated bedroom in a suburban home.\n' +
    'The space is deadened by plush velvet curtains and a heavy rug, creating an intimate, close-up acoustic environment.\n' +
    'The speaker delivers the information like a trusted friend sharing an inside joke.',

  'A high-tech, minimalist laboratory humming with servers.\n' +
    'Crisp, clean acoustics reflect off glass and steel.\n' +
    'A brilliant but eccentric scientist is pacing back and forth, speaking rapidly and enthusiastically into a headset microphone, excited to explain a complex phenomenon.',
];

function sanitizeScene(text: string): string {
  return (text || '')
    .trim()
    .replace(/\r?\n/g, '\\n')
    .replace(/^[#\s]+/gm, '');
}

function sanitizeTranscript(text: string): string {
  return (text || '').trim().replace(/\r?\n/g, '\\n').replace(/^#+/gm, '').replace(/"""/g, '"');
}

function makeTag(value: string): string {
  const trimmedValue = value.trim();
  return trimmedValue ? `[${trimmedValue}] ` : '';
}

function insertAudioTagsToTranscript({ transcript, pace, emotion }: AudioPrompt): string {
  const audioTags = `${makeTag(emotion)}${makeTag(pace)}`;
  const cleanedTranscript = sanitizeTranscript(transcript);

  const parts = cleanedTranscript.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|i\.e|e\.g))([.!?\n\r]+[”"’']*\s*)/);
  return parts
    .map((text, i, arr) => {
      if (i % 2 !== 0) {
        return '';
      }
      const delimiter = arr[i + 1] || '';
      return text.trim() ? `${audioTags}${text.trim()}${delimiter}` : delimiter;
    })
    .join('');
}

/**
 * Formats prompt with scene and transcript with audio tags.
 */
export function buildAudioPrompt(data: AudioPrompt): string {
  const randomIndex = Math.floor(Math.random() * SCENE_DICTIONARY.length);
  const selectedScene = SCENE_DICTIONARY[randomIndex];

  const trimmedScene = (data.scene || '').trim() || selectedScene;
  const escapedScene = sanitizeScene(trimmedScene);

  const transcript = insertAudioTagsToTranscript(data);

  return `## Scene:
${escapedScene}

## Transcript:
"""
${transcript}
"""
`;
}
