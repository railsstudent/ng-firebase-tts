import { ImageAnalysisResponse } from '@/core/interfaces/image-analysis.interface';
import { GroundingComponent } from '@/features/dashboard/components/grounding/grounding.component';
import { RecommendationsDisplayComponent } from '@/features/dashboard/components/recommendations-display/recommendations.component';
import { ErrorDisplayComponent } from '@/shared/ui/error-display/error-display.component';
import { SpinnerIconComponent } from '@/shared/ui/icons/spinner-icon.component';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-alt-text-panel',
  imports: [SpinnerIconComponent, RecommendationsDisplayComponent, GroundingComponent, ErrorDisplayComponent],
  templateUrl: './alt-text-panel.html',
  styleUrl: './alt-text-panel.css',
})
export class AltTextPanel {
  isLoading = input(false);
  analysis = input<ImageAnalysisResponse | undefined>(undefined);
  error = input<string | undefined>(undefined);
}
