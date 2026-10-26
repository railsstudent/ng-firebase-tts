import { Component } from '@angular/core';

@Component({
  selector: 'app-arrow-drop-down-icon',
  host: {
    class: 'app-icon text-muted transition-transform duration-200',
  },
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="w-full h-full"
      aria-hidden="true"
    >
      <path d="M7 10l5 5 5-5z" />
    </svg>
  `,
})
export class ArrowDropDownIconComponent {}
