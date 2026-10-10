import { formatFileSize, ImageOptimizationMetrics, TokenUsage } from '@/core/vision';
import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-usage-metrics',
  styleUrl: './app-usage-metrics.component.css',
  templateUrl: './app-usage-metrics.component.html',
})
export class AppUsageMetricsComponent {
  readonly tokenUsage = input<TokenUsage | undefined>(undefined);
  readonly optimizationMetrics = input<ImageOptimizationMetrics | undefined>(undefined);

  readonly formattedMetrics = computed(() => {
    const metrics = this.optimizationMetrics();
    return {
      originalSize: metrics ? formatFileSize(metrics.originalSizeBytes) : '0 B',
      optimizedSize: metrics ? formatFileSize(metrics.optimizedSizeBytes) : '0 B',
      payloadSaved: metrics ? `${metrics.bytesSavedPercent}%` : '0%',
      tokensSaved: metrics ? `~${metrics.tokensSaved.toLocaleString()}` : '0',
    };
  });
}
