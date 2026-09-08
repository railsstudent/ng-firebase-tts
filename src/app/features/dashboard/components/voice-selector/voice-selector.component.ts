import {
  SORTED_VOICE_MAP,
  SORTED_VOICE_OPTIONS,
} from '@/features/dashboard/components/voice-selector/constants/voice-options.const';
import { DEFAULT_VOICE } from '@/features/dashboard/constants/voice-name.const';
import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import { OverlayModule } from '@angular/cdk/overlay';
import { afterRenderEffect, Component, computed, model, signal, viewChild } from '@angular/core';

function getVoiceValue(newValue: string) {
  return newValue && SORTED_VOICE_MAP.has(newValue) ? newValue : DEFAULT_VOICE;
}

@Component({
  selector: 'app-voice-selector',
  templateUrl: './voice-selector.component.html',
  styleUrl: './voice-selector.component.css',
  imports: [Combobox, ComboboxPopup, ComboboxWidget, Listbox, Option, OverlayModule],
})
export class VoiceSelectorComponent {
  listbox = viewChild(Listbox);

  sortedVoiceOptions = SORTED_VOICE_OPTIONS;

  selectedValue = model.required<string>();

  popupExpanded = signal(false);

  displayLabel = computed(() => {
    const value = getVoiceValue(this.selectedValue());
    return SORTED_VOICE_MAP.get(value);
  });

  constructor() {
    afterRenderEffect(() => this.listbox()?.scrollActiveItemIntoView());
  }

  onCommit() {
    this.popupExpanded.set(false);
  }
}
