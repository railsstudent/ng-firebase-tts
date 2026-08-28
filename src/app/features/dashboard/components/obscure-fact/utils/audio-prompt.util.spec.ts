import { buildAudioPrompt, SCENE_DICTIONARY } from './audio-prompt.util';

describe('audio-prompt.util', () => {
  it('should correctly format a prompt with custom scene and emotion/pace tags', () => {
    const data = {
      scene: 'A busy train station',
      emotion: 'excited',
      pace: 'fast',
      transcript: 'This is an obscure fact.',
      voiceOption: 'Kore',
    };

    const result = buildAudioPrompt(data);

    expect(result).toContain('## Scene:\nA busy train station');
    expect(result).toContain('## Transcript:\n"""\n[excited] [fast] This is an obscure fact.\n"""');
  });

  it('should use a random scene from the dictionary if custom scene is empty', () => {
    const data = {
      scene: '',
      emotion: 'calm',
      pace: 'slow',
      transcript: 'Another fact.',
      voiceOption: 'Zephyr',
    };

    const result = buildAudioPrompt(data);

    // Should contain one of the SCENE_DICTIONARY scenes
    const matchesDictionaryScene = SCENE_DICTIONARY.some((scene) => {
      const sanitized = scene
        .trim()
        .replace(/\r?\n/g, '\\n')
        .replace(/^[#\s]+/gm, '');
      return result.includes(sanitized);
    });

    expect(matchesDictionaryScene).toBe(true);
    expect(result).toContain('[calm] [slow] Another fact.');
  });

  it('should omit empty emotion or pace tags gracefully', () => {
    const data = {
      scene: 'A classroom',
      emotion: '   ',
      pace: 'slow',
      transcript: 'A simple fact.',
      voiceOption: 'Puck',
    };

    const result = buildAudioPrompt(data);
    expect(result).toContain('[slow] A simple fact.');
    expect(result).not.toContain('[]');
  });
});
