import {
  altTextPrompt,
  peopleAltTextPrompt,
  peopleSystemInstruction,
  placeAltTextPrompt,
  placeSystemInstruction,
} from './vision.prompt';

function assertTaskPrefixes(altTextPrompt: string): void {
  expect(altTextPrompt).toContain('Task 1:');
  expect(altTextPrompt).toContain('Task 2:');
  expect(altTextPrompt).toContain('Task 3:');
  expect(altTextPrompt).toContain('Task 4:');
}

describe('vision.prompt', () => {
  it('should define peopleSystemInstruction and peopleAltTextPrompt with strict identity verification and visual feature fallback', () => {
    expect(peopleSystemInstruction).toContain('public figures');
    expect(peopleSystemInstruction).toContain('never guess or fabricate a name');
    expect(peopleSystemInstruction).toContain('NEVER use Google Search to guess or deduce');

    assertTaskPrefixes(peopleAltTextPrompt);
    expect(peopleAltTextPrompt).toContain('facial expression');
    expect(peopleAltTextPrompt).toContain('do not guess a name');
    expect(peopleAltTextPrompt).toContain('Never use Google Search to guess');
  });

  it('should define placeSystemInstruction and placeAltTextPrompt with Place Name, Latitude and Longitude, and foreground traveler handling', () => {
    expect(placeSystemInstruction).toContain('Google Maps and Google Search');
    expect(placeSystemInstruction).toContain('latitude and longitude');
    expect(placeSystemInstruction).toContain('Never fabricate coordinates');

    assertTaskPrefixes(placeAltTextPrompt);
    expect(placeAltTextPrompt).toContain('Place Name');
    expect(placeAltTextPrompt).toContain('Latitude and Longitude');
    expect(placeAltTextPrompt).toContain('person or traveler appears in the foreground');
  });

  it('should preserve altTextPrompt for the general model with all four tasks', () => {
    assertTaskPrefixes(altTextPrompt);
  });
});
