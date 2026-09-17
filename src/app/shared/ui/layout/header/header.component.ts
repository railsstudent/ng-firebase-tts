import { Component } from '@angular/core';

@Component({
  selector: 'app-header',
  template: `
    <header class="app-header">
      <h1 class="header-title">Firebase AI Logic Obscure Fact Speech Generator</h1>
      <p class="header-subtitle">Upload an image to generate alt text and tags with Gemini</p>
    </header>
  `,
  styleUrl: './header.component.css',
})
export class HeaderComponent {}
