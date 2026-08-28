import { Component, input } from '@angular/core';

@Component({
  selector: 'app-alt-text-display',
  templateUrl: './alt-text-display.component.html',
  styleUrl: './alt-text-display.component.css',
})
export class AltTextDisplayComponent {
  altText = input<string>('');
}
