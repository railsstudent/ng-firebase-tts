import { Recommendation } from '@/core/interfaces/recommendation.type';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-recommendations-display',
  templateUrl: './recommendations.component.html',
  styleUrl: './recommendations.component.css',
})
export class RecommendationsDisplay {
  recommendations = input<Recommendation[]>([]);
}
