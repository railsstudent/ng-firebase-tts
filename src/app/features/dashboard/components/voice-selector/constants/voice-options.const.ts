const VOICE_ENTRIES: readonly [string, string][] = [
  ['Achernar', 'Soft'],
  ['Achird', 'Friendly'],
  ['Algenib', 'Gravelly'],
  ['Algieba', 'Smooth'],
  ['Alnilam', 'Firm'],
  ['Aoede', 'Breezy'],
  ['Autonoe', 'Bright'],
  ['Callirrhoe', 'Easy-going'],
  ['Charon', 'Informative'],
  ['Despina', 'Smooth'],
  ['Enceladus', 'Breathy'],
  ['Erinome', 'Clear'],
  ['Fenrir', 'Excitable'],
  ['Gacrux', 'Mature'],
  ['Iapetus', 'Clear'],
  ['Kore', 'Firm'],
  ['Laomedeia', 'Upbeat'],
  ['Leda', 'Youthful'],
  ['Orus', 'Firm'],
  ['Puck', 'Upbeat'],
  ['Pulcherrima', 'Forward'],
  ['Schedar', 'Even'],
  ['Zephyr', 'Bright'],
];

export const SORTED_VOICE_OPTIONS = VOICE_ENTRIES.map(([name, description]) => ({
  name,
  label: `${name} - ${description}`,
}));

export const SORTED_VOICE_MAP = new Map<string, string>(
  SORTED_VOICE_OPTIONS.map((option) => [option.name, option.label]),
);
