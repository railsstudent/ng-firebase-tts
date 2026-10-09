import { SpeechModeConfig } from '@/features/dashboard/components/speech-studio/interfaces/audio.interface';
import { FormFieldConfig } from '@/features/dashboard/components/speech-studio/interfaces/form-config.interface';
import { SpeechStudioViewService } from '@/features/dashboard/components/speech-studio/services/speech-studio-view';
import { buildAudioPrompt } from '@/features/dashboard/components/speech-studio/utils/audio-prompt.util';
import { VoiceSelectorComponent } from '@/features/dashboard/components/voice-selector/voice-selector.component';
import { DEFAULT_VOICE } from '@/features/dashboard/constants/voice-name.const';
import { AudioPromptData } from '@/features/dashboard/interfaces/audio-prompt-data.interface';
import { GenerateSpeechMode } from '@/features/dashboard/types/generate-speech-mode.type';
import { ErrorDisplayComponent } from '@/shared/ui/error-display/error-display.component';
import { SpinnerIconComponent } from '@/shared/ui/icons/spinner-icon.component';
import { Component, computed, inject, input, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

@Component({
  selector: 'app-speech-studio',
  templateUrl: './speech-studio.component.html',
  styleUrl: './speech-studio.component.css',
  imports: [SpinnerIconComponent, FormField, VoiceSelectorComponent, ErrorDisplayComponent],
  providers: [SpeechStudioViewService],
})
export class SpeechStudioComponent {
  readonly #speechService = inject(SpeechStudioViewService);

  interestingFact = input<string | undefined>(undefined);

  readonly #audioPromptModel = signal<AudioPromptData>({
    scene: 'A news anchor reading the news in a busy newsroom',
    emotion: 'professional, slightly serious',
    pace: 'moderate, clear enunciation',
    voiceOption: DEFAULT_VOICE,
  });

  audioPromptForm = form(this.#audioPromptModel);
  ttsError = signal<string>('');

  selectedValue = computed(() => this.#audioPromptModel().voiceOption);

  audioPrompt = computed(() =>
    buildAudioPrompt({
      ...this.#audioPromptModel(),
      transcript: this.interestingFact() || '',
    }),
  );

  voice = computed(() => this.#audioPromptModel().voiceOption);

  audioUrl = computed(() => this.#speechService.activeAudio()?.url);
  playbackRate = this.#speechService.playbackRate;
  loadingMode = this.#speechService.loadingMode;

  isLoading = computed(() => this.loadingMode() !== 'idle');
  isGeneratedForCurrentInput = computed(() => {
    const activeAudio = this.#speechService.activeAudio();
    if (!activeAudio) {
      return false;
    }

    const trimmedVoice = activeAudio.voice.trim().toLowerCase();
    const trimmedPrompt = activeAudio.prompt.trim().toLowerCase();
    return (
      trimmedPrompt === this.audioPrompt().trim().toLowerCase() && trimmedVoice === this.voice().trim().toLowerCase()
    );
  });

  readonly speechButtonConfigs: SpeechModeConfig[] = [
    {
      mode: 'sync',
      ariaLabel: 'Play Speech (Sync)',
      buttonText: 'Play Speech (Sync)',
    },
    {
      mode: 'stream',
      ariaLabel: 'Play Speech (Stream)',
      buttonText: 'Play Speech (Stream)',
    },
    {
      mode: 'web_audio_api',
      ariaLabel: 'Stream speech',
      buttonText: 'Web Audio API',
      getGenText: () => `Speak (Playback rate: ${this.#speechService.playbackRate()})`,
    },
  ];

  readonly formFields: FormFieldConfig[] = [
    {
      id: 'scene',
      label: 'Scene Description',
      type: 'textarea',
      field: this.audioPromptForm.scene,
      placeholder: 'Describe the environment...',
      groupClass: 'form-field-group-full',
    },
    {
      id: 'emotion',
      label: 'Vocal Emotion',
      type: 'text',
      field: this.audioPromptForm.emotion,
      placeholder: 'e.g., panicked, whispers',
      groupClass: 'form-field-group',
    },
    {
      id: 'pace',
      label: 'Speaking Pace',
      type: 'text',
      field: this.audioPromptForm.pace,
      placeholder: 'e.g., very slow, rapid',
      groupClass: 'form-field-group',
    },
  ];

  onVoiceChange(newVoice: string) {
    const voiceOption = newVoice ?? DEFAULT_VOICE;
    this.#audioPromptModel.update((model) => ({
      ...model,
      voiceOption,
    }));
  }

  async generateSpeech(mode: GenerateSpeechMode) {
    try {
      const fact = this.interestingFact();
      if (!fact || (mode !== 'web_audio_api' && this.isGeneratedForCurrentInput())) {
        return;
      }

      this.ttsError.set('');
      await this.#speechService.generateSpeech(mode, {
        prompt: this.audioPrompt(),
        voice: this.voice(),
        fact,
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Error generating speech.';
      console.error('TTS Generation failed:', e);
      this.ttsError.set(errorMessage);
    }
  }
}
