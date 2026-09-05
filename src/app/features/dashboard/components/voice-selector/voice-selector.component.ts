import { DEFAULT_VOICE } from '@/features/dashboard/constants/voice-name.const';
import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import { OverlayModule } from '@angular/cdk/overlay';
import { afterRenderEffect, Component, computed, output, signal, viewChild } from '@angular/core';
import {
  SORTED_VOICE_MAP,
  SORTED_VOICE_OPTIONS,
} from '@/features/dashboard/components/voice-selector/constants/voice-options.const';

function getVoiceValue(newValues: string[]) {
  const candidate = newValues?.[0];
  return candidate && SORTED_VOICE_MAP.has(candidate) ? candidate : DEFAULT_VOICE;
}

@Component({
  selector: 'app-voice-selector',
  templateUrl: './voice-selector.component.html',
  styleUrl: './voice-selector.component.css',
  imports: [Combobox, ComboboxPopup, ComboboxWidget, Listbox, Option, OverlayModule],
})
export class VoiceSelectorComponent {
  listbox = viewChild(Listbox);

  valueChange = output<string>();

  sortedVoiceOptions = SORTED_VOICE_OPTIONS;

  selectedValues = signal([DEFAULT_VOICE]);

  popupExpanded = signal(false);

  displayLabel = computed(() => {
    const value = getVoiceValue(this.selectedValues());
    return SORTED_VOICE_MAP.get(value) || SORTED_VOICE_MAP.get(DEFAULT_VOICE);
  });

  constructor() {
    afterRenderEffect(() => {
      try {
        this.listbox()?.scrollActiveItemIntoView();
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
    this.valueChange.emit(getVoiceValue(newValues));
  }
}
