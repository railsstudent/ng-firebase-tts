import { Component } from '@angular/core';

@Component({
  selector: 'app-check-icon',
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="w-full h-full"
      aria-hidden="true"
    >
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  `,
  styleUrl: './check-icon.component.css',
})
export class CheckIconComponent {}
