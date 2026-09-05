import { VoiceItem } from '@/features/dashboard/components/audio-tags/interfaces/voice-item.interface';

export const VOICE_OPTIONS: VoiceItem[] = [
  { name: 'Zephyr', description: 'Bright' },
  { name: 'Kore', description: 'firm' },
  { name: 'Puck', description: 'Upbeat' },
  { name: 'Fenrir', description: 'Excitable' },
  { name: 'Leda', description: 'Youthful' },
  { name: 'Orus', description: 'Firm' },
  { name: 'Aoede', description: 'Breezy' },
  { name: 'Autonoe', description: 'Bright' },
  { name: 'Enceladus', description: 'Breathy' },
  { name: 'Umbriel', description: 'Easy-going' },
  { name: 'Algieba', description: 'Smooth' },
  { name: 'Erinome', description: 'Clear' },
  { name: 'Algenib', description: 'Gravelly' },
  { name: 'Rasalgethi', description: 'Informative' },
  { name: 'Laomedeia', description: 'Smooth' },
  { name: 'Achernar', description: 'Soft' },
  { name: 'Schedar', description: 'Mature' },
  { name: 'Achird', description: 'Friendly' },
  { name: 'Zubenelgenubi', description: 'Casual' },
  { name: 'Vindemiatrix', description: 'Gentle' },
  { name: 'Sadachbia', description: 'Lively' },
  { name: 'Sadaltager', description: 'Knowledgeable' },
  { name: 'Sulafat', description: 'Warm' },
];

export const SORTED_VOICE_OPTIONS = [...VOICE_OPTIONS]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((option) => ({
    name: option.name,
    label: `${option.name} - ${option.description}`,
  }));

export const SORTED_VOICE_MAP = new Map<string, string>(
  SORTED_VOICE_OPTIONS.map((option) => [option.name, option.label]),
);
