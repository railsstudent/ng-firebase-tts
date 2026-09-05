import { Listbox, Option } from '@angular/aria/listbox';
import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-tags-display',
  templateUrl: './tags-display.component.html',
  styleUrl: './tags-display.component.css',
  imports: [Listbox, Option],
})
export class TagsDisplayComponent {
  tags = input<string[]>([]);

  tagAriaLabel = computed(() => {
    const numItems = this.tags().length;
    const items = `item${numItems === 1 ? '' : 's'}`;
    return `Suggested tags, ${numItems} ${items}`;
  });
}
