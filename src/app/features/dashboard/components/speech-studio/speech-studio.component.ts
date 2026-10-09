import { VoiceSelectorComponent } from '@/features/dashboard/components/voice-selector/voice-selector.component';
import { DEFAULT_VOICE } from '@/features/dashboard/constants/voice-name.const';
import { AudioPromptData } from '@/features/dashboard/interfaces/audio-prompt-data.interface';
import { GenerateSpeechMode } from '@/features/dashboard/types/generate-speech-mode.type';
import { ErrorDisplayComponent } from '@/shared/ui/error-display/error-display.component';
import { SpinnerIconComponent } from '@/shared/ui/icons/spinner-icon.component';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { SpeechStudioViewService } from './services/speech-studio-view';
import { buildAudioPrompt } from './utils/audio-prompt.util';

@Component({
  selector: 'app-speech-studio',
  templateUrl: './speech-studio.component.html',
  styleUrl: './speech-studio.component.css',
  imports: [SpinnerIconComponent, NgTemplateOutlet, FormField, VoiceSelectorComponent, ErrorDisplayComponent],
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
