import { Recommendation } from '@/core/vision';
import { ExpandMoreIconComponent } from '@/shared/ui/icons/expand-more-icon.component';
import { AccordionContent, AccordionGroup, AccordionPanel, AccordionTrigger } from '@angular/aria/accordion';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-recommendations-display',
  templateUrl: './recommendations.component.html',
  styleUrl: './recommendations.component.css',
  imports: [AccordionGroup, AccordionTrigger, AccordionPanel, AccordionContent, ExpandMoreIconComponent],
})
export class RecommendationsDisplayComponent {
  recommendations = input<Recommendation[]>([]);
}
