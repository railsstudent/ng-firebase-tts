import type { ImageOptimizationMetrics, TokenUsage } from '@/core/vision';
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
      originalSize: metrics ? this.formatFileSize(metrics.originalSizeBytes) : '0 B',
      optimizedSize: metrics ? this.formatFileSize(metrics.optimizedSizeBytes) : '0 B',
      payloadSaved: metrics ? `${metrics.bytesSavedPercent}%` : '0%',
      tokensSaved: metrics ? `~${metrics.tokensSaved.toLocaleString()}` : '0',
    };
  });

  private formatFileSize(bytes: number): string {
    if (bytes <= 0) {
      return '0 B';
    }
    const baseUnit = 1024;
    const units = ['B', 'KB', 'MB', 'GB'];
    const digitGroup = Math.min(Math.floor(Math.log(bytes) / Math.log(baseUnit)), units.length - 1);
    const value = bytes / Math.pow(baseUnit, digitGroup);
    const formatted = digitGroup === 0 ? value.toString() : Number(value.toFixed(1)).toString();
    return `${formatted} ${units[digitGroup]}`;
  }
}
