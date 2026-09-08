import { Recommendation } from '@/core/interfaces/recommendation.interface';
import { AccordionContent, AccordionGroup, AccordionPanel, AccordionTrigger } from '@angular/aria/accordion';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-recommendations-display',
  templateUrl: './recommendations.component.html',
  styleUrl: './recommendations.component.css',
  imports: [AccordionGroup, AccordionTrigger, AccordionPanel, AccordionContent],
})
export class RecommendationsDisplayComponent {
  recommendations = input<Recommendation[]>([]);
}
