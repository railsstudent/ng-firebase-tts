import { ImageAnalysisResponse } from '@/core/interfaces/image-analysis.type';
import { AltTextDisplayComponent } from '@/features/dashboard/components/alt-text-display/alt-text-display.component';
import { GroundingComponent } from '@/features/dashboard/components/grounding/grounding.component';
import { RecommendationsDisplay } from '@/features/dashboard/components/recommendations-display/recommendations.component';
import { SpinnerIconComponent } from '@/shared/ui/icons/spinner-icon.component';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-alt-text-panel',
  imports: [AltTextDisplayComponent, SpinnerIconComponent, RecommendationsDisplay, GroundingComponent],
  templateUrl: './alt-text-panel.html',
  styleUrl: './alt-text-panel.css',
})
export class AltTextPanel {
  isLoading = input(false);
  analysis = input<ImageAnalysisResponse | undefined>(undefined);
  error = input<string | undefined>(undefined);
}
