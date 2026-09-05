import { VoiceSelectorComponent } from '@/features/dashboard/components/voice-selector/voice-selector.component';
import { DEFAULT_VOICE } from '@/features/dashboard/constants/voice-name.const';
import { AudioPromptData } from '@/features/dashboard/interfaces/audio-prompt-data.interface';
import { Listbox } from '@angular/aria/listbox';
import { Component, signal, viewChild } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

@Component({
  selector: 'app-audio-tags',
  imports: [FormField, VoiceSelectorComponent],
  templateUrl: './audio-tags.component.html',
  styleUrl: './audio-tags.component.css',
})
export class AudioTagsComponent {
  listBox = viewChild(Listbox);

  #audioPromptModel = signal<AudioPromptData>({
    scene: 'A news anchor reading the news in a busy newsroom',
    emotion: 'professional, slightly serious',
    pace: 'moderate, clear enunciation',
    voiceOption: DEFAULT_VOICE,
  });
  audioPromptForm = form(this.#audioPromptModel);

  audioPromptModel = this.#audioPromptModel.asReadonly();

  onValueChange(newValue: string) {
    this.#audioPromptModel.update((model) => ({
      ...model,
      voiceOption: newValue,
    }));
  }
}
