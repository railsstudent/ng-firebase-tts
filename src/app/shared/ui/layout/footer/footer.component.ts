import { Component, computed } from '@angular/core';

@Component({
  selector: 'app-footer',
  template: `
    <footer class="bg-slate-800/50 border border-slate-700 rounded-2xl mt-auto">
      <div class="container mx-auto px-6 py-4 text-center text-gray-400">
        <p>&copy; {{ copyrightYear() }} Image Analysis and TTS Application.</p>
        <p>Built with Angular, Firebase AI Logic, and TailwindCSS 4.</p>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  copyrightYear = computed(() => new Date(Date.now()).getFullYear());
}
