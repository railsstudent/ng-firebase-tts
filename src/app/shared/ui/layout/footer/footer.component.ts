import { Component, computed } from '@angular/core';

@Component({
  selector: 'app-footer',
  template: `
    <footer class="footer-card">
      <div class="footer-content">
        <p>&copy; {{ copyrightYear() }} Image Analysis and Text-to-Speech Application.</p>
        <p>Built with Angular, Firebase AI Logic, and TailwindCSS 4.</p>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  copyrightYear = computed(() => new Date(Date.now()).getFullYear());
}
