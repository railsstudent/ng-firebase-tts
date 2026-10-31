import { Component, computed } from '@angular/core';

@Component({
  selector: 'app-footer',
  template: `
    <footer class="surface-card footer-card text-muted">
      <p>&copy; {{ copyrightYear() }} Image Analysis and Text-to-Speech Application.</p>
      <p>Built with Angular, Firebase AI Logic, and TailwindCSS 4.</p>
    </footer>
  `,
})
export class FooterComponent {
  copyrightYear = computed(() => new Date(Date.now()).getFullYear());
}
