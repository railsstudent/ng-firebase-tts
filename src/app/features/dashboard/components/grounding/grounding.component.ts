import { Metadata } from '@/core/interfaces/grounding.type';
import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  Renderer2,
  signal,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-grounding',
  templateUrl: './grounding.component.html',
  styleUrl: './grounding.component.css',
})
export class GroundingComponent {
  metadata = input<Metadata | undefined>(undefined);

  sanitizer = inject(DomSanitizer);
  renderer2 = inject(Renderer2);
  document = inject(ElementRef);

  isLoading = signal(false);
  audioUrl = signal<string | undefined>(undefined);

  safeRenderedContent = computed(() => {
    const unsafeContent = this.metadata()?.renderedContent;
    return unsafeContent ? this.sanitizer.bypassSecurityTrustHtml(unsafeContent) : '';
  });

  constructor() {
    afterRenderEffect({
      write: () => {
        if (this.safeRenderedContent()) {
          this.styleSources();
        }
      },
    });
  }

  private styleSources() {
    const nativeElement = this.document.nativeElement;

    if (nativeElement && nativeElement instanceof HTMLElement) {
      const firstCarousel = nativeElement.getElementsByClassName('carousel')?.item(0);
      if (firstCarousel) {
        this.renderer2.setStyle(firstCarousel, 'white-space', 'normal');
        const tags = firstCarousel.getElementsByTagName('a');
        for (const tag of tags) {
          this.renderer2.setStyle(tag, 'margin-bottom', '0.5rem');
          this.renderer2.setAttribute(tag, 'target', '_blank');
          this.renderer2.setAttribute(tag, 'rel', 'noopener noreferrer');
        }
      }
    }
  }
}
