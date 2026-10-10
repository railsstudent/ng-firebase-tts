import { GroundingMetadata } from '@/core/vision';
import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-grounding',
  templateUrl: './grounding.component.html',
  styleUrl: './grounding.component.css',
})
export class GroundingComponent {
  metadata = input<GroundingMetadata | undefined>(undefined);

  #sanitizer = inject(DomSanitizer);

  safeRenderedContent = computed(() => {
    const unsafeContent = this.metadata()?.renderedContent;
    if (!unsafeContent) {
      return '';
    }

    const enhanced = unsafeContent
      .replace('class="carousel"', 'class="carousel whitespace-normal"')
      .replaceAll(
        '<a ',
        '<a target="_blank" rel="noopener noreferrer nofollow external" referrerpolicy="no-referrer" title="Opens in a new tab" class="link-anchor mb-2" ',
      );

    return this.#sanitizer.bypassSecurityTrustHtml(enhanced);
  });
}
