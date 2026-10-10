import { Component, computed, input } from '@angular/core';
import snarkdown from 'snarkdown';
import dompurify from 'dompurify';

@Component({
  selector: 'app-thought-summary',
  templateUrl: './thought-summary.component.html',
  styleUrl: './thought-summary.component.css',
})
export class ThoughtSummaryComponent {
  thought = input('');

  htmlThought = computed(() => dompurify.sanitize(snarkdown(this.thought().replaceAll('\n\n', '<br />'))));
}
