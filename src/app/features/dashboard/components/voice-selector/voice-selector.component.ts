import { DEFAULT_VOICE } from '@/features/dashboard/constants/voice-name.const';
import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import { OverlayModule } from '@angular/cdk/overlay';
import { afterRenderEffect, Component, computed, output, signal, viewChild } from '@angular/core';
import { SORTED_VOICE_MAP, SORTED_VOICE_OPTIONS } from './constants/voice-options.const';

@Component({
  selector: 'app-voice-selector',
  templateUrl: './voice-selector.component.html',
  styleUrl: './voice-selector.component.css',
  imports: [Combobox, ComboboxPopup, ComboboxWidget, Listbox, Option, OverlayModule],
})
export class VoiceSelectorComponent {
  listBox = viewChild(Listbox);

  valueChange = output<string>();

  sortedVoiceOptions = SORTED_VOICE_OPTIONS;

  sortedVoiceMap = SORTED_VOICE_MAP;

  selectedValues = signal([DEFAULT_VOICE]);

  popupExpanded = signal(false);

  displayLabel = computed(() => {
    const value = this.selectedValues()?.[0] || DEFAULT_VOICE;
    return this.sortedVoiceMap.get(value) || this.sortedVoiceMap.get(DEFAULT_VOICE) || '';
  });

  constructor() {
    afterRenderEffect(() => {
      try {
        this.listBox()?.scrollActiveItemIntoView();
      } catch {
        // Safely ignored in headless / jsdom test environments
      }
    });
  }

  onCommit() {
    this.popupExpanded.set(false);
  }

  onValueChange(newValues: string[]) {
    this.selectedValues.set(newValues);
    this.valueChange.emit(newValues?.[0] || DEFAULT_VOICE);
  }
}
