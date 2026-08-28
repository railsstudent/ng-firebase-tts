import { GenerateSpeechMode } from '@/features/dashboard/types/generate-speech-mode.type';
import { SpinnerIconComponent } from '@/shared/ui/icons/spinner-icon.component';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-text-to-speech',
  templateUrl: './text-to-speech.component.html',
  styleUrl: './text-to-speech.component.css',
  imports: [SpinnerIconComponent, NgTemplateOutlet],
})
export class TextToSpeechComponent {
  isLoadingSync = input(false);
  isLoadingStream = input(false);
  isLoadingWebAudio = input(false);
  audioUrl = input<string | undefined>(undefined);
  playbackRate = input.required<number>();

  isLoading = computed(
    () => this.isLoadingSync() || this.isLoadingStream() || this.isLoadingWebAudio(),
  );

  generateSpeech = output<GenerateSpeechMode>();
}
