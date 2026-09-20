import { VoiceSelectorComponent } from '@/features/dashboard/components/voice-selector/voice-selector.component';
import { DEFAULT_VOICE } from '@/features/dashboard/constants/voice-name.const';
import { AudioPromptData } from '@/features/dashboard/interfaces/audio-prompt-data.interface';
import { Component, computed, model } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

@Component({
  selector: 'app-audio-tags',
  imports: [FormField, VoiceSelectorComponent],
  templateUrl: './audio-tags.component.html',
  styleUrl: './audio-tags.component.css',
})
export class AudioTagsComponent {
  audioPromptModel = model.required<AudioPromptData>();

  audioPromptForm = form(this.audioPromptModel);

  selectedValue = computed(() => this.audioPromptModel().voiceOption);

  onValueChange(newValues: string) {
    const voiceOption = newValues ?? DEFAULT_VOICE;
    this.audioPromptModel.update((model) => ({
      ...model,
      voiceOption,
    }));
  }
}
