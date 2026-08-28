import { Component, input } from '@angular/core';

@Component({
  selector: 'app-tags-display',
  templateUrl: './tags-display.component.html',
  styleUrl: './tags-display.component.css',
})
export class TagsDisplayComponent {
  tags = input<string[]>([]);
}
