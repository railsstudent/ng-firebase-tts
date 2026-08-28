import { TokenUsage } from '@/core/interfaces/token-usage.type';
import { Component, computed, input } from '@angular/core';
import { marked } from 'marked';

@Component({
  selector: 'app-thought-summary',
  templateUrl: './thought-summary.component.html',
  styleUrl: './thought-summary.component.css',
})
export class ThoughtSummaryComponent {
  thought = input('');
  tokenUsage = input<TokenUsage | undefined>(undefined);

  htmlThought = computed(() => marked(this.thought().replace('\n\n', '<br />')));
}
