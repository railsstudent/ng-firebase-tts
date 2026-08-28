import { Component } from '@angular/core';

@Component({
  selector: 'app-header',
  template: `
    <header class="text-center mb-8">
      <h1
        class="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400"
      >
        Firebase AI Logic Obscure Fact Speech Generator
      </h1>
      <p class="mt-2 text-lg text-slate-400">
        Upload an image to generate alt text and tags with Gemini
      </p>
    </header>
  `,
})
export class HeaderComponent {}
